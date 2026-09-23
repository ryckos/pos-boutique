# Ma Boutique — application de gestion (POS)

Application de caisse et de gestion pour mini-supermarché, installée sur le terminal
OMA POS M120w (double écran), avec imprimante Xprinter M804 et douchette code-barres.
Fonctionne entièrement hors ligne. Référence fonctionnelle : le **cahier des charges signé**.

Stack validée en Phase 0 : **Electron 37 · React 18 · TypeScript · SQLite** (`node:sqlite`,
intégré à Electron : aucune compilation native, aucun outil Visual Studio à installer).

> **Première mise en place ?** Lisez [`DEMARRAGE.md`](DEMARRAGE.md) : création du dépôt GitHub,
> configuration de chaque poste, première session.

- Tâches de **Dev A (comptoir et matériel)** : [`docs/DEV_A_COMPTOIR.md`](docs/DEV_A_COMPTOIR.md)
- Tâches de **Dev B (back-office et données)** : [`docs/DEV_B_BACKOFFICE.md`](docs/DEV_B_BACKOFFICE.md)

### Documentation du projet

| Document                                                   | Contenu                                        |
|------------------------------------------------------------|------------------------------------------------|
| [`docs/PROJET.md`](docs/PROJET.md)                         | Vision, contexte, périmètre, droits, exigences |
| [`docs/REGLES_METIER.md`](docs/REGLES_METIER.md)           | Toutes les règles de gestion, avec formules    |
| [`docs/UI_UX.md`](docs/UI_UX.md)                           | Design, écrans validés, textes, ergonomie      |
| [`docs/MODELE_DONNEES.md`](docs/MODELE_DONNEES.md)         | Tables, vues, triggers, qui écrit où           |
| [`docs/DECISIONS.md`](docs/DECISIONS.md)                   | Décisions prises et décisions en attente       |
| [`docs/SCENARIO_REFERENCE.md`](docs/SCENARIO_REFERENCE.md) | Semaine type avec chiffres attendus (recette)  |
| [`docs/ETAT_AVANCEMENT.md`](docs/ETAT_AVANCEMENT.md)       | Suivi des tâches — à mettre à jour à chaque PR |

### Avec Claude Code — configuration du poste (une fois par développeur)

Après le `git clone`, chaque développeur configure son poste :

```powershell
powershell -ExecutionPolicy Bypass -File scripts\configurer-dev.ps1 A   # ou B
```

Cela crée `CLAUDE.local.md` (non versionné), qui fait charger automatiquement à Claude Code le
**brief de passation** et le **carnet de bord** du bon développeur (`docs/claude/`). Dans Claude
Code, `/memory` permet de vérifier les fichiers chargés.

Chaque session commence par **`/reprendre`** et se termine par **`/cloturer`** : le carnet de bord,
versionné et poussé, est la mémoire qui relie les sessions et les deux machines.

### Mémoire du projet pour Claude Code

`CLAUDE.md` (racine) est chargé automatiquement à chaque session. Les fichiers `CLAUDE.md` de
`src/main/`, `src/renderer/` et `tests/` sont chargés quand Claude travaille dans ces dossiers.
Commandes de projet :

| Commande             | Rôle                                                        |
|----------------------|-------------------------------------------------------------|
| `/reprendre`         | Début de session : état, carnets, rendez-vous, prochaine étape |
| `/cloturer`          | Fin de session : carnet de bord, avancement, commit         |
| `/plan`              | Plan complet : fait, en cours, à faire, par dev, blocages   |
| `/tache-en-cours`    | Ce qui est en cours des deux côtés et la prochaine action   |
| `/taches-terminees`  | Ce qui est terminé et testable dès maintenant               |
| `/tache-suivante`    | La prochaine tâche à démarrer, et si elle est démarrable    |
| `/tache A1.1`        | Lit tout le contexte de la tâche et propose un plan         |
| `/verifier`          | Contrôle les règles, met à jour l'avancement, rédige la PR  |
| `/migration <sujet>` | Crée une migration conforme                                 |
| `/module <nom>`      | Crée le squelette d'un module                               |
| `/revue <branche>`   | Relit la branche de l'autre développeur                     |

**Garder ces documents vivants est la condition pour que Claude reste juste** : une règle tranchée va
dans `REGLES_METIER.md`, une décision dans `DECISIONS.md`, un avancement dans `ETAT_AVANCEMENT.md`.

---

## 1. Démarrer

Prérequis : Node.js 22 LTS, Git, VS Code.

```bash
git clone <url-du-depot> pos-boutique
cd pos-boutique
npm install
npm run dev
```

Au premier lancement en développement, la base est créée et remplie de données de démonstration.

| Compte  | Profil         | Code PIN |
|---------|----------------|----------|
| Patron  | Administrateur | `1234`   |
| Kossi   | Gérant         | `5678`   |
| Afi     | Caissière      | `0000`   |

Codes-barres de démo à « scanner » (tapez vite puis Entrée, ou utilisez la vraie douchette) :
`6181000000042` (tomate, unité) · `2000000000015` (lot de 3) · `16181000000049` (carton de 24) ·
`101` (baguette, code PLU).

**Base de développement** : `%APPDATA%\pos-boutique\boutique.db`. Pour repartir de zéro,
fermez l'application et supprimez ce fichier (et les fichiers `-wal` / `-shm`).
Pour utiliser une autre base : `set POS_DB=C:\temp\essai.db && npm run dev`.

### Commandes

| Commande            | Rôle                                                      |
|---------------------|-----------------------------------------------------------|
| `npm run dev`       | Lance l'application avec rechargement automatique         |
| `npm run verifier`  | Typecheck + tests. **À lancer avant chaque PR.**          |
| `npm test`          | Tests seuls (`npm run test:watch` pour le mode continu)   |
| `npm run build`     | Compile l'application                                     |
| `npm run dist`      | Produit l'installateur Windows (Phase 5)                  |

---

## 2. Architecture en une image

```
 Interface React (renderer)                 Processus principal (Node + SQLite)
 ─────────────────────────                  ──────────────────────────────────
 modules/<module>/PageX.tsx
        │  appel('catalogue:rechercherCode', { code })        ← typé par le contrat
        ▼
 lib/api.ts ──► preload (window.pos.invoke) ──► ipc/gerer.ts ──► modules/<module>/ipc.ts
                                                                          │
                                                                          ▼
                                                          modules/<module>/service.ts (db, testé)
                                                                          │
                                                                          ▼
                                                 core/ : mouvements · audit · numérotation · session
                                                                          │
                                                                          ▼
                                                                  SQLite (migrations)
```

### Les 6 règles d'architecture

1. **Le contrat d'abord.** Tout échange interface ↔ principal est déclaré dans
   `src/shared/ipc/<module>.ts` (canal, requête, réponse). TypeScript refuse tout appel non déclaré.
2. **La logique métier vit dans `service.ts`**, reçoit `db` en paramètre, n'importe jamais
   `electron`. C'est ce qui la rend testable. Le fichier `ipc.ts` reste mince : vérifier la session,
   appeler le service.
3. **Toute variation de stock passe par `core/mouvements.ts`** (`enregistrerMouvement`,
   `contrePasser`). Jamais d'`INSERT INTO mouvements_stock` ailleurs. Quantités en unités de base.
4. **Tout ce qui doit être cohérent se fait dans `avecTransaction()`** : une vente = ticket + lignes
   + paiements + mouvements, tout ou rien. La fonction est synchrone : on imprime APRÈS la transaction.
5. **L'identité vient de la session, jamais de l'interface.** Un service appelle
   `session.exiger(['gerant'])` ; l'interface n'envoie jamais d'identifiant d'utilisateur.
6. **Argent en entiers FCFA**, affiché avec `formaterFCFA()`. Aucun flottant pour un montant.

### Erreurs

Lever `new ErreurMetier('Message clair pour l’utilisateur')` : le message s'affiche tel quel.
Toute autre exception est traitée comme un bug (message générique + trace dans la console).

---

## 3. Ajouter une fonctionnalité — la recette

Exemple : Dev B ajoute la fiche fournisseur.

1. **Migration** si la structure change : `src/main/db/migrations/20261005_1430_fournisseurs_email.sql`
2. **Contrat** : déclarer les canaux dans `src/shared/ipc/achats.ts`, puis une ligne dans `src/shared/ipc/index.ts`
3. **Service** : `src/main/modules/achats/service.ts`, fonctions pures qui prennent `db`
4. **Test** : `tests/achats.test.ts` avec `baseAvecDemo()` (base en mémoire, jetable)
5. **IPC** : `src/main/modules/achats/ipc.ts` avec `gerer(...)`, puis une ligne dans `src/main/ipc/index.ts`
6. **Écran** : `src/renderer/src/modules/achats/PageFournisseurs.tsx`, qui appelle `appel('achats:...')`
7. **Menu** : `routes.tsx` du module, puis une ligne dans `src/renderer/src/app/routes.tsx`

Les étapes 2, 5 et 7 touchent un fichier d'assemblage partagé, **une ligne à chaque fois** :
en cas de conflit git, il suffit de garder les deux lignes.

---

## 4. Travailler à deux sans se marcher dessus

### Qui possède quoi

Chaque fichier a un propriétaire (voir `.github/CODEOWNERS` et vos fiches de tâches). On ne modifie
pas un fichier de l'autre : on lui demande, ou on propose une PR qu'il relit.

Les **zones partagées** (`src/shared/`, `src/main/core/`, `src/main/db/`, `src/main/ipc/`,
`src/preload/`, `src/renderer/src/app/`, `lib/`, `ui/`, `package.json`) se modifient par **petites PR
dédiées**, annoncées à l'autre avant de commencer.

### Git : fusionner souvent, par petits morceaux

```
a/caisse-panier ──┐
                  ├──► test ──────────► main
b/utilisateurs ───┘   (intégration)   (version validée, installable chez la cliente)
```

| Branche              | Rôle                                                    | Durée de vie          |
|----------------------|---------------------------------------------------------|-----------------------|
| `main`               | Version validée, celle qu'on installe chez la cliente   | permanente, protégée  |
| `test`               | Intégration : tout le travail arrive ici                | permanente, protégée  |
| `a/<sujet>`, `b/<sujet>` | Une tâche, un sujet                                 | 2 jours max, supprimée après fusion |

- `test` et `main` sont protégées : on n'y pousse jamais directement, uniquement via PR.
- Une branche = une tâche courte. Nom : `a/description` ou `b/description`.
- **Durée de vie maximale d'une branche : 2 jours.** Au-delà, on découpe la tâche.
- **Chaque matin** : `git switch test && git pull`, puis `git rebase test` sur sa branche.
- **Chaque soir** : `/verifier`, `/cloturer`, commit et `git push` — même si la tâche n'est pas finie.
- **Quand la tâche est finie** : PR vers `test`, relue par l'autre le jour même, CI verte, fusion en
  « squash », branche supprimée. Au moins une PR fusionnée par jour et par personne.
- **Chaque vendredi** : on teste `test` ensemble (sur le terminal si possible) ; si c'est concluant,
  PR de `test` vers `main`, fusion et tag `v0.<semaine>`.
- **Correctif urgent** sur la version installée : branche depuis `main`, PR vers `main`, puis on
  reporte le correctif dans `test`.
- Une fonctionnalité inachevée peut être fusionnée si elle n'apparaît pas encore dans le menu
  (`app/routes.tsx`). C'est ce qui permet de fusionner tous les jours sans casser la caisse.

### Messages de commit

```
feat(caisse): calcul de la monnaie à rendre
fix(catalogue): recherche insensible aux accents
test(stock): contre-passation d'une réception
docs: précise la règle des migrations
```

### Migrations : les 4 règles d'or

1. Un changement de structure = un **nouveau** fichier, jamais la modification d'un ancien.
2. Nom horodaté `AAAAMMJJ_HHMM_description.sql` : deux développeurs ne peuvent pas entrer en collision.
3. Une migration fusionnée dans `test` est **définitive**. Pour corriger, on écrit une nouvelle migration.
4. Pas de `PRAGMA` dans une migration.

Si une migration de l'autre arrive pendant que vous travaillez sur la vôtre, votre base locale se
met à jour toute seule au prochain lancement.

### Définition de « terminé »

Une tâche est terminée quand : `npm run verifier` passe, la logique métier a ses tests, la fonction
a été testée à la main dans l'application, la PR est relue et fusionnée, et la fonction apparaît
dans le menu pour les bons profils.

### Rituels

| Quand           | Quoi                                                                        |
|-----------------|-----------------------------------------------------------------------------|
| Chaque matin    | 10 min : hier, aujourd'hui, blocages. Annonce des zones partagées touchées. |
| Chaque jour     | Au moins une PR fusionnée dans `test` chacun, relecture de l'autre le jour même. |
| Chaque vendredi | Test commun de `test`, PR vers `main`, tag `v0.<semaine>`. |
| Fin de phase    | Recette de la phase avec la cliente, sur le terminal de la boutique.        |

---

## 5. Calendrier et points de rendez-vous

| Phase | Semaines | Objectif (cahier des charges, chap. 8)                       |
|-------|----------|---------------------------------------------------------------|
| 0     | S1–S2    | Validation du matériel — **terminée**                          |
| 1     | S3–S8    | Caisse et ventes : la boutique peut vendre avec l'application |
| 2     | S9–S12   | Achats, stock, péremptions, marges réelles                    |
| 3     | S13–S15  | Crédits clients, dépenses, inventaires, écran client          |
| 4     | S16–S18  | Tableau de bord, rapports, exports, sauvegardes               |
| 5     | S19–S20  | Mise en service, formation, accompagnement                    |

Les **points de rendez-vous** sont les contrats qu'un développeur livre à l'autre. Une date manquée
bloque l'autre : prévenez dès que vous voyez un retard.

| Contrat                                             | Fourni par | Utilisé par | Échéance  |
|-----------------------------------------------------|------------|-------------|-----------|
| `catalogue:rechercherCode`, `catalogue:grille`      | socle      | A           | ✅ livré  |
| `core/mouvements`, `numerotation`, `audit`, session | socle      | A et B      | ✅ livré  |
| Contrôle des rôles sur tous les canaux              | B          | A           | fin S3    |
| `catalogue:conditionnementsProduit`                 | B          | A           | fin S4    |
| `parametres:lire` (en-tête de ticket)               | B          | A           | fin S5    |
| `caisse:enregistrerVente` (modèle de transaction)   | A          | B (lecture) | fin S5    |
| Stock initial de démarrage                          | B          | A (recette) | fin S7    |
| `stock/allouerFefo()` (service main)                | B          | A           | fin S10   |
| `caisse/sessionOuverte()`, `enregistrerMouvementCaisse()` | A    | B (dépenses)| fin S10   |
| `caisse:ventesPeriode` (données des rapports)       | A          | B (résultat)| fin S16   |

---

## 6. Structure

```
pos-boutique/
├── .github/            CI, modèle de PR, propriétaires de code
├── docs/               Fiches de tâches Dev A et Dev B
├── resources/          raw-print.ps1 (impression brute, validé en Phase 0)
├── tests/              Tests automatiques (bases SQLite en mémoire)
└── src/
    ├── shared/         Types et contrats IPC (un fichier par module)
    ├── main/
    │   ├── core/       Règles transverses : mouvements, audit, numérotation, session, sécurité
    │   ├── db/         Connexion, requêtes, migrations, données de démo
    │   ├── ipc/        Enregistrement typé des canaux
    │   ├── materiel/   Imprimante, ESC/POS, tiroir (Dev A)
    │   ├── modules/    Un dossier par module : service.ts + ipc.ts
    │   ├── fenetres.ts Fenêtre caisse + écran client
    │   └── index.ts    Démarrage
    ├── preload/        Pont sécurisé (générique, ne change pas)
    └── renderer/
        ├── index.html · client.html
        └── src/
            ├── app/      Coque, menu, routes
            ├── lib/      api.ts (appel typé), useScanner (douchette)
            ├── ui/       Styles et jetons de design
            └── modules/  Écrans par module
```
