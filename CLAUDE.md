# CLAUDE.md — Ma Boutique (POS)

Ce fichier est lu automatiquement à chaque session. Il donne l'essentiel ; les détails sont dans
`docs/`, à lire **avant** de travailler sur le sujet concerné (voir « Où trouver quoi »).

## Le projet en bref

Application de caisse et de gestion pour un **mini-supermarché à Lomé (Togo)**, installée sur le
terminal **OMA POS M120w** (Windows 10, Celeron, 4 Go, écran tactile 15,6″ + écran client 11,6″),
avec l'imprimante thermique **Xprinter M804** (ESC/POS, 80 mm, port tiroir-caisse) et une
**douchette laser USB** (émulation clavier). Elle fonctionne **entièrement hors ligne**.

Vision : chaque franc et chaque boîte sont tracés. Le patron peut expliquer à tout instant son
stock, ses marges et sa caisse, preuves à l'appui. La caissière sert un client en moins de 30 s
sans jamais être bloquée.

Stack **validée sur site (Phase 0)** : Electron 37 · React 18 · TypeScript strict · SQLite via
`node:sqlite` (intégré, pas de module natif). Tests : Vitest sur bases SQLite en mémoire.

## Qui tu aides — ton brief de passation

Deux développeurs travaillent en parallèle, chacun sur sa machine avec sa propre session de Claude
Code. La conception a été menée en amont avec le chef de projet ; **tout ce qui a été décidé est dans
ce dépôt**, et chaque développeur a un **brief de passation** complet :

| Développeur                         | Brief (ta mémoire du projet)      | Carnet de bord (mémoire des sessions) |
|-------------------------------------|-----------------------------------|---------------------------------------|
| **Dev A** — comptoir et matériel    | `docs/claude/BRIEF_DEV_A.md`      | `docs/claude/CARNET_DEV_A.md`         |
| **Dev B** — back-office et données  | `docs/claude/BRIEF_DEV_B.md`      | `docs/claude/CARNET_DEV_B.md`         |

Sur chaque poste, `CLAUDE.local.md` (créé par `scripts/configurer-dev.ps1`, non versionné) charge
automatiquement le bon brief et le bon carnet.

**Si aucun brief n'est chargé** (tu ne vois pas de section « Brief de passation » dans ton contexte) :
identifie le développeur par la branche (`a/…` → Dev A, `b/…` → Dev B, sinon demande), puis lis
**entièrement** son brief et son carnet **avant toute autre action**.

**Continuité** : tu n'as aucune mémoire entre deux sessions et tu ne vois pas la session de l'autre
développeur. La seule mémoire partagée est le dépôt git. D'où deux commandes obligatoires :
**`/reprendre`** en début de session, **`/cloturer`** en fin de session (carnet, avancement, commit).
Ne modifie jamais un fichier du périmètre de l'autre développeur : signale le besoin.

## Où trouver quoi

| Besoin                                                        | Fichier                           |
|---------------------------------------------------------------|-----------------------------------|
| Vision, objectifs, périmètre inclus/exclu, droits, exigences  | `docs/PROJET.md`                  |
| Règles métier précises (calculs, flux, cas limites)           | `docs/REGLES_METIER.md`           |
| Interface : design, écrans validés, textes, ergonomie         | `docs/UI_UX.md`                   |
| Tables, vues, triggers, qui écrit où                          | `docs/MODELE_DONNEES.md`          |
| Décisions déjà prises et pourquoi (ne pas les rediscuter)     | `docs/DECISIONS.md`               |
| Scénario de référence avec chiffres attendus (recette)        | `docs/SCENARIO_REFERENCE.md`      |
| Ce qui est fait, en cours, à faire                            | `docs/ETAT_AVANCEMENT.md`         |
| Tâches détaillées de chaque développeur                       | `docs/DEV_A_COMPTOIR.md`, `docs/DEV_B_BACKOFFICE.md` |
| Brief de passation et carnet de bord de chaque développeur    | `docs/claude/`                    |
| Démarrage, architecture, workflow git, rendez-vous            | `README.md`                       |

Les dossiers `src/main/`, `src/renderer/` et `tests/` ont leur propre `CLAUDE.md` avec les règles
propres à chaque couche.

## Commandes

```bash
npm run dev        # lance l'application (base de démo créée au 1er lancement)
npm run verifier   # typecheck + tests — OBLIGATOIRE avant de proposer un commit
npm test           # tests seuls
npm run build      # compilation complète
```

Comptes de démo : Patron `1234` (admin), Kossi `5678` (gérant), Afi `0000` (caissière).

Commandes de projet disponibles (dossier `.claude/commands/`) :
**Session** : `/reprendre` début · `/cloturer` fin.
**Travail** : `/tache <id>` · `/verifier` avant PR · `/migration <sujet>` · `/module <nom>` · `/revue <branche>`.
**Pilotage** (rendre compte, n'écrivent rien) : `/plan` le plan complet · `/tache-en-cours` ·
`/taches-terminees` ce qui est testable · `/tache-suivante`.

`docs/ETAT_AVANCEMENT.md` est la **source unique** de ces quatre commandes de pilotage : le tenir à
jour à chaque `/cloturer` et à chaque PR fusionnée n'est pas optionnel.

## Architecture (détails dans README.md, section 2)

```
Page React → appel('canal', req) → preload → ipc/gerer.ts → modules/<m>/ipc.ts → modules/<m>/service.ts → core/ → SQLite
```

1. **Contrat d'abord** : tout canal est déclaré dans `src/shared/ipc/<module>.ts`, puis assemblé dans `src/shared/ipc/index.ts`.
2. **Logique dans `service.ts`** : reçoit `db`, n'importe jamais `electron`, est testée. `ipc.ts` reste mince.
3. **Stock uniquement via `core/mouvements.ts`**, en unités de base.
4. **Cohérence via `avecTransaction()`**, fonction synchrone.
5. **Identité via `session.exiger(roles)`**, jamais transmise par l'interface.
6. **Argent en entiers FCFA**, affiché avec `formaterFCFA()`.

## Règles absolues — ne jamais faire

- Écrire `INSERT INTO mouvements_stock` hors de `src/main/core/mouvements.ts`.
- Faire un `UPDATE` ou un `DELETE` sur l'historique. On contre-passe, on annule par statut ou on
  désactive (`actif = 0`). Les triggers de la base le refusent de toute façon.
- Modifier une migration existante. On crée un nouveau fichier `AAAAMMJJ_HHMM_sujet.sql`.
- Utiliser un nombre à virgule pour un montant, ou arrondir ailleurs que dans les calculs de TVA
  prévus.
- Faire confiance à l'interface pour un prix, un coût ou un identifiant d'utilisateur : le service
  relit tout en base.
- Imprimer, faire un `await` ou un appel réseau à l'intérieur d'une transaction.
- Bloquer une vente parce que l'imprimante est en panne.
- Écrire une couleur en dur dans l'interface (jetons de `ui/styles.css` uniquement).
- Écrire un texte d'interface en anglais, ou avec un code technique visible par l'utilisateur.
- Ajouter une dépendance npm sans l'accord explicite du développeur.
- Trancher seul une **décision en attente** (liste dans `docs/DECISIONS.md`) : la signaler.
- Inventer une règle métier absente de `docs/REGLES_METIER.md` : demander.

## Façon de travailler

1. Avant de coder : lire la fiche de tâche, les règles métier et l'écran concernés. Proposer un plan
   court (contrat, service, tests, écran) et attendre l'accord pour une tâche de plus d'une heure.
2. Écrire les tests du service **avec** le service. Les exemples chiffrés de
   `docs/SCENARIO_REFERENCE.md` sont d'excellents cas de test.
3. Lancer `npm run verifier` et corriger jusqu'au vert.
4. Mettre à jour `docs/ETAT_AVANCEMENT.md` (statut de la tâche) et, si un contrat change, la
   documentation concernée.
5. Proposer un message de commit conventionnel (`feat(caisse): ...`) et le texte de la PR selon
   `.github/pull_request_template.md`.
6. Garder des changements petits : une branche vit 2 jours maximum.

**Branches** : `main` (version validée chez la cliente) ← `test` (intégration quotidienne) ←
`a/<sujet>` et `b/<sujet>` (une tâche). Toute PR de tâche va vers **`test`**, jamais vers `main`.
La mise à jour du matin et le rebase se font sur `test`. `test` passe dans `main` le vendredi,
après test commun.

## Conventions de code

- Noms métier **en français** (`enregistrerVente`, `quantiteBase`, `PageCaisse`). Colonnes SQL en
  `snake_case` français, converties en `camelCase` dans les requêtes (`AS quantiteBase`).
- Fichiers : `service.ts`, `ipc.ts`, `Page<Nom>.tsx`, `routes.tsx` par module.
- `ErreurMetier` pour tout message destiné à l'utilisateur ; tout autre `Error` = bug.
- Commentaires en français, qui expliquent le **pourquoi**.
- Prettier : sans point-virgule, guillemets simples, 110 colonnes.
