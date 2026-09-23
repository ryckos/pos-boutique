# Brief de passation — Claude Code de Dev B (back-office et données)

Tu es la Claude Code qui accompagne **Dev B** sur le projet « Ma Boutique ». Ce brief est ta mémoire :
il résume toute la phase de conception, menée avec le chef de projet dans une conversation que tu
n'as pas vue, et te dit exactement où reprendre. Une autre Claude Code accompagne **Dev A** sur une
autre machine, avec son propre brief (`docs/claude/BRIEF_DEV_A.md`). Vous devez rester alignées :
**la seule mémoire commune entre vous est le dépôt git.**

Tu es aussi la **gardienne du modèle de données** : tu relis en priorité toute nouvelle migration,
y compris celles de Dev A.

---

## 1. Ta routine de session (obligatoire)

**Au début de chaque session** (ou via `/reprendre`) :
1. `git status` et `git log --oneline -15` : sur quelle branche, qu'est-ce qui a été fusionné
   récemment (y compris par Dev A).
2. Lis `docs/claude/CARNET_DEV_B.md` (ton carnet : où tu t'es arrêtée, la prochaine étape, les
   questions ouvertes) et la dernière entrée de `docs/claude/CARNET_DEV_A.md` (ce que fait l'autre).
3. Lis `docs/ETAT_AVANCEMENT.md` et `docs/DECISIONS.md` (section « en attente »).
4. Annonce à Dev B en 5 lignes : où on en est, ce qui a changé chez Dev A qui le concerne, les
   **rendez-vous proches que Dev A attend de lui**, la prochaine étape proposée.

**À la fin de chaque session** (ou via `/cloturer`) :
1. Ajoute une entrée datée **en haut** de `docs/claude/CARNET_DEV_B.md` : fait, en cours, prochaine
   étape précise, questions ouvertes, contrats livrés ou en retard.
2. Mets à jour `docs/ETAT_AVANCEMENT.md` et, si le schéma a changé, `docs/MODELE_DONNEES.md`.
3. Si une règle ou une décision a été tranchée, écris-la dans `docs/REGLES_METIER.md` ou
   `docs/DECISIONS.md`.
4. Propose le commit. **Le carnet voyage avec le code** : sans commit, l'autre machine ne le voit pas.

**Commandes de pilotage** (le chef de projet peut les taper à tout moment ; elles rendent compte et
n'écrivent aucun fichier) : `/plan`, `/tache-en-cours`, `/taches-terminees`, `/tache-suivante`.
Elles lisent `docs/ETAT_AVANCEMENT.md` : tiens-le exact, sinon elles répondent faux.

**Pendant la session**, tu ne réponds pas « de mémoire » sur une règle métier : tu vérifies dans
`docs/REGLES_METIER.md`. Si la règle n'y est pas, tu demandes à Dev B, tu ne l'inventes pas.

---

## 2. Le projet (ce qu'il faut avoir en tête en permanence)

Application de caisse et de gestion pour un **mini-supermarché à Lomé (Togo)**, installée sur le
terminal de la boutique, **entièrement hors ligne**. Cliente : la propriétaire de la boutique.

Vision : **chaque franc et chaque boîte sont tracés**. Le patron explique à tout instant son stock,
ses marges et sa caisse, preuves à l'appui ; aucune donnée ne se perd jamais.

Matériel (testé et validé sur site) : terminal **OMA POS M120w** (Windows 10, Celeron, **4 Go RAM**,
écrans 15,6″ tactile + 11,6″ client), imprimante thermique **Xprinter M804** (ESC/POS), **douchette
laser USB** en émulation clavier.

Contraintes : Internet non garanti, coupures de courant fréquentes (base en mode WAL, transactions),
4 Go de RAM (pas de requête lourde à chaque frappe), **FCFA sans décimales**, TVA 18 % (le pain à
0 %).

Stack : **Electron 37 · React 18 · TypeScript strict · SQLite (`node:sqlite`, intégré, sans module
natif) · Vitest** sur bases en mémoire.

---

## 3. Ce qui s'est passé avant toi (historique de conception)

1. **Analyse du matériel** puis **choix d'une application de bureau hors ligne**, le cloud
   uniquement pour la sauvegarde.
2. **Phase 0 — deux prototypes testés sur le terminal** (Electron et Laravel), mêmes 5 tests
   (douchette, impression, tiroir, double écran, SQLite + coupure). **Electron retenu** (D-02) :
   double écran natif, contrôle du focus clavier, profil React/TypeScript de l'équipe.
3. **`node:sqlite` plutôt que better-sqlite3** (D-03) : aucune compilation native, empaquetage fiable.
4. **Modèle de données v1 puis v2** : la cliente vend un même produit à l'unité, en lot et en carton à
   des **prix dégressifs libres** → table `conditionnements` ; stock en unité de base (D-10).
   Explication détaillée de la réception en cartons validée avec le chef de projet (§ 8).
5. **Scénario d'une semaine** joué avec maquettes (réception, nouveau produit, caisse, péremptions,
   sortie de stock, retour client, clôture, inventaire) → `docs/SCENARIO_REFERENCE.md`.
6. **Cahier des charges** rédigé et soumis à la cliente → synthèse dans `docs/PROJET.md`.
7. **Initialisation du dépôt** (le « socle ») et découpage du travail entre Dev A et Dev B.

---

## 4. Principes non négociables (valables pour tout le projet)

1. **Rien n'est jamais effacé.** Correction = contre-passation liée, changement de statut, ou
   désactivation (`actif = 0`). Triggers : pas d'`UPDATE`/`DELETE` sur `mouvements_stock` et
   `journal_audit`, pas de `DELETE` sur `ventes` et `lignes_vente`.
2. **Le stock n'est jamais stocké** : somme de `mouvements_stock`, en **unités de base**. Lecture par
   les vues `v_stock_produits`, `v_stock_lots`, `v_alertes_stock`, `v_peremptions`.
3. **Conditionnements** : un produit (unité de base) a plusieurs conditionnements, chacun avec **son
   prix libre** et son code-barres **unique dans toute la base**. Toute quantité est convertie en
   unités de base **une seule fois, à la saisie**.
4. **Photocopie au moment T** dans les lignes de vente et de réception.
5. **Argent en entiers FCFA** ; seuls CUMP, coûts unitaires et quantités sont `REAL`.
6. **Identité par la session** (`session.exiger`), jamais transmise par l'interface.
7. **Cohérence par `avecTransaction()`** (synchrone, imbricable).

---

## 5. Ton périmètre (Dev B — back-office et données)

**Tu possèdes** : `src/main/modules/auth/`, `utilisateurs/`, `catalogue/`, `stock/`, `parametres/`,
`achats/`, `inventaires/`, `depenses/`, `rapports-gestion/`, `sauvegardes/` ; les contrats
`src/shared/ipc/auth.ts`, `catalogue.ts` (et `stock.ts`, `achats.ts`… à créer) ; les écrans
correspondants sous `src/renderer/src/modules/` ; la page de connexion ; l'empaquetage (Phase 5).

**Zones partagées** (petite PR dédiée, à annoncer à Dev A) : `src/shared/types.ts`,
`src/shared/ipc/index.ts`, `src/main/core/`, `src/main/db/` (migrations, seed),
`src/main/ipc/index.ts`, `src/renderer/src/app/`, `lib/`, `ui/styles.css`, `package.json`, `docs/`.

**Tu ne modifies pas** (propriété de Dev A) : caisse, ventes, paiements, sessions de caisse, clients et
crédits, promotions, rapports de ventes, matériel, fenêtres, écran client.

**Tes contrats sont consommés par la caisse de Dev A** : un changement de forme de
`ArticleCatalogue` ou d'un canal `catalogue:*` casse son écran. Toute évolution se fait en ajoutant
(nouveau champ optionnel, nouveau canal), jamais en retirant, et s'annonce dans ton carnet.

---

## 6. Ce qui existe déjà (le socle)

| Élément                   | Où                                         | État                          |
|---------------------------|--------------------------------------------|-------------------------------|
| Schéma v2 complet         | `db/migrations/20260922_0900_schema_initial.sql` | 27 tables, 6 vues, 6 triggers |
| Séquences + boutons tactiles | `db/migrations/20260922_0910_sequences_et_boutons.sql` | `sequences`, `conditionnements.bouton_tactile`, `ordre_bouton` |
| Moteur de migrations      | `db/migrations.ts`                         | Applique les nouveaux `.sql` au démarrage |
| Connexion PIN             | `modules/auth/service.ts`, `PageConnexion.tsx` | `connexion`, `creerUtilisateur` (PIN uniques, hachés scrypt) |
| Catalogue                 | `modules/catalogue/service.ts`             | `rechercherParCode`, `rechercherTexte` (**sans gestion des accents — B2.3**), `grille`, `produitsAvecStock` |
| Page produits (aperçu)    | `modules/catalogue/PageCatalogue.tsx`      | Liste + stock, à compléter (B2, B4) |
| Noyau                     | `core/`                                    | mouvements, contre-passation, audit, numérotation, session, sécurité |
| Démo                      | `db/seed.ts`                               | 3 comptes, 4 catégories, 7 produits, 10 conditionnements, stock initial |

Comptes de démo : Patron admin `1234`, Kossi gérant `5678`, Afi caissière `0000`.

---

## 7. Tes tâches, dans l'ordre

Détail et critères de fin : `docs/DEV_B_BACKOFFICE.md`. Statut réel : `docs/ETAT_AVANCEMENT.md`.
**Point de départ : B1.** Démarre chaque tâche par `/tache <id>` (plan puis accord de Dev B).

### Phase 1 — Fondations de la gestion (S3–S8)
- **B1 (S3)** Gestion des comptes (créer, désactiver, changer PIN et rôle), **verrouillage** après 5
  échecs (délai croissant, journalisé), **revue de tous les canaux** pour `session.exiger()` selon la
  matrice des droits (**rendez-vous fin S3**), assistant de premier démarrage en production.
- **B2.1 (S3)** Catégories (sous-catégories via `parent_id`).
- **B2.2 (S4)** Fiche produit + conditionnements (maquette § 10), garde-fou prix, **générateur EAN-13
  interne préfixe 20** (clé de contrôle ; `2000000000015` est valide), journalisation des changements
  de prix, canal **`catalogue:conditionnementsProduit` pour Dev A (fin S4)**.
- **B2.3 (S5)** Recherche **insensible aux accents et à la casse** ; création de produit pré-remplie à
  partir d'un code inconnu scanné.
- **B3 (S5–S6)** Import Excel du catalogue (bibliothèque `xlsx` — **dépendance à faire valider**),
  modèle de fichier, rapport ligne par ligne, tout ou rien.
- **B4 (S6)** Écran stock : alertes, historique d'un produit (« pourquoi il reste 41 boîtes »),
  répartition indicative par conditionnement, produits dormants.
- **B5 (S7)** Paramètres : **`parametres:lire` d'abord, pour Dev A (fin S5)**, puis
  `parametres:ecrire` (admin, journalisé) et l'écran.
- **B6 (S7–S8)** Stock initial de démarrage (`ajustement_inventaire`, document `stock_initial`,
  initialise le CUMP).

### Phase 2 (S9–S12)
B7 fournisseurs · **B8 commandes et réceptions** (le cœur : § 8) · **B9 lots, `allouerFefo()` pour
Dev A (fin S10), tableau des péremptions** · B10 règlements et dettes fournisseurs.

### Phase 3 (S13–S15)
B11 sorties de stock et retours fournisseur (avoir attendu) · B12 inventaires (comptage par
conditionnements) · B13 dépenses (source caisse via les fonctions de Dev A).

### Phase 4 (S16–S18)
B14 rapports de gestion et journal d'audit · B15 exports Excel · B16 sauvegardes + **restauration
testée**.

### Phase 5 (S19–S20)
Installateur (`npm run dist`), mode kiosque et démarrage automatique, mises à jour sur site, guide du
gérant, import du vrai catalogue avec la cliente.

---

## 8. Règles métier de ton périmètre (résumé — la référence reste `docs/REGLES_METIER.md` § 2–5, 8–10, 12–13)

**Réception — ce que fait l'utilisateur** : il saisit ce qu'il a devant lui, dans le conditionnement
reçu, au prix payé. Ex. : scan du carton, qté **3**, prix **6 000** → l'écran affiche en direct
« = 72 boîtes à 250 F/boîte ». Il ne convertit jamais de tête.

**Réception — à la validation, une transaction** : lignes telles que saisies ; un lot par ligne si
périssable (**n° de lot et date obligatoires**) ; mouvement `reception` de qté × `quantite_base` ;
**recalcul du CUMP** ; dette fournisseur (échéance = délai de paiement) ; numéro `RC`.

**CUMP** : `coûtBase = prix du conditionnement / quantite_base` ;
`nouveau = (stockAvant × ancien + qteBase × coûtBase) / (stockAvant + qteBase)`. Si stockAvant ≤ 0 :
nouveau = coûtBase. Tests de référence : 3 cartons à 6 000 → CUMP **250** ; puis 46 en stock à 250 +
2 cartons à 6 600 (48 à 275) → **262,8**. Le CUMP n'est modifié que par la réception et le stock
initial.

**Cas particuliers de réception** : code inconnu → création du produit puis retour ; premier achat en
carton → création du conditionnement depuis la réception ; vrac → conditionnement « Unité » ;
commande partiellement reçue → `recue_partiel`.

**Codes-barres** : un code identifie une **référence**, jamais un exemplaire → la péremption ne vient
jamais du code, elle se saisit par lot. EAN-13 fabricant, ITF-14 cartons, codes internes EAN-13
préfixe 20–29, codes PLU courts (`101`). Codes uniques dans toute la base.

**FEFO** : `allouerFefo(db, produitId, qteBase)` renvoie la répartition par lots, les plus proches de
leur date d'abord (`v_stock_lots`). Tableau des péremptions : horizon 15 jours par défaut, valeur en
jeu = restant × prix d'achat du lot, actions « promotion » et « retirer » (`perte_peremption`).
Attention au double sens de « lot » : « Lot de 3 » = conditionnement ; table `lots` = lot d'arrivage.

**Stock négatif** : **décision en attente (D-A1)** — n'empêche jamais une vente.

**Sorties de stock** : motif obligatoire (`casse`, `perte_peremption`, `vol` ; « don » = `casse` avec
motif « don » tant qu'aucun type dédié n'existe). Retour fournisseur : `retour_fournisseur`, avoir
attendu = qté × coût (ex. 2 × 250 = **500 F**), déduit de la dette une fois confirmé.

**Inventaire** : théorique photographié au comptage, comptage **par conditionnement** converti
(1 carton + 5 lots + 2 unités = **41**), `detail_comptage` en JSON, écart = colonne générée, **motif
obligatoire par écart**, validation gérant → `ajustement_inventaire` au CUMP, démarque chiffrée
(2 savons × 150 = **300 F**), inventaire validé figé.

**Dépenses** : source `caisse` (session ouverte requise, mouvement de caisse `sortie` via la fonction
de Dev A) ou `fonds_propres` ; numéro `DEP`.

**Utilisateurs** : PIN 4 chiffres unique parmi les actifs, haché, verrouillage après 5 échecs,
désactivation plutôt que suppression, assistant admin au premier démarrage en production.

**Paramètres** (clés dans `REGLES_METIER.md` § 13) : ajoute toute nouvelle clé au tableau.

**Numérotation** : tu utilises `RC`, `CA`, `INV`, `DEP` via `prochainNumero`.

---

## 9. Gardienne du modèle de données

- Nouvelle migration = nouveau fichier `AAAAMMJJ_HHMM_sujet.sql` (commande `/migration`), jamais la
  modification d'un ancien, jamais de `PRAGMA`, jamais de suppression d'une colonne d'historique.
- Modifier un `CHECK` existant impose de recréer la table : décision à prendre avec Dev A.
- Tiens `docs/MODELE_DONNEES.md` à jour à chaque migration.
- En revue d'une PR de Dev A contenant une migration : vérifier le nom, l'absence de modification
  d'historique, l'impact sur les vues, la mise à jour de la documentation.

---

## 10. Tes écrans (spécifications complètes : `docs/UI_UX.md` § 5.1, 5.6 à 5.9, 5.11, 5.12)

- **Nouvelle réception** : fournisseur, champ « Ajouter un article » (avec `data-scan`), tableau
  Article / Qté reçue / Prix d'achat (pré-rempli du dernier prix) / Total, **conversion en direct sous
  chaque ligne**, champs lot + date exigés si périssable, total à comparer au bon de livraison,
  **« Valider la réception »**.
- **Nouveau produit** (après scan d'un code inconnu) : pastille « Code scanné », Nom, Catégorie, TVA,
  suivi de péremption, seuil, tableau des conditionnements, **« Enregistrer et ajouter à la
  réception »**.
- **Péremptions** : valeur totale en jeu, lignes rouges (≤ 3 j) ou ambre, actions Promo / Retirer.
- **Sortie de stock** : produit, quantité (unités de base), motif, commentaire, case retour
  fournisseur avec avoir attendu, **« Valider la sortie »**.
- **Inventaire** : une carte par produit, champs par conditionnement, total converti, pastille d'écart,
  motif obligatoire, **« Valider l'inventaire »**.
- **Listes de gestion** : `.page` / `.page-entete`, `.tableau` avec colonnes numériques à droite,
  pastilles d'état, jamais de suppression (« Désactiver » avec motif).

Design : jetons de `ui/styles.css` uniquement, Segoe UI, `.montant` pour l'argent, cibles ≥ 48 px,
textes en français, boutons avec verbe, erreurs qui disent quoi faire.

---

## 11. Rendez-vous avec Dev A

| Tu livres à Dev A                                   | Échéance | Utilisé pour                |
|-----------------------------------------------------|----------|-----------------------------|
| Contrôle des rôles sur tous les canaux              | fin S3   | Confiance dans les droits   |
| `catalogue:conditionnementsProduit`                 | **fin S4** | Changer le conditionnement d'une ligne |
| `parametres:lire` (puis `parametres:ecrire`)        | **fin S5** | En-tête du ticket, réglages imprimante |
| Stock initial de démarrage                          | fin S7   | Recette de Phase 1          |
| `stock/allouerFefo(db, produitId, qteBase)`         | **fin S10** | FEFO à la vente           |
| Lecture des alertes rupture et péremption           | fin S17  | Tableau de bord             |

| Tu attends de Dev A                                     | Échéance | En attendant           |
|---------------------------------------------------------|----------|------------------------|
| `sessionOuverte(db)`, `enregistrerMouvementCaisse(db…)` | fin S10  | Dépenses « fonds propres » seulement |
| `caisse:ventesPeriode`                                  | fin S16  | Rapport de résultat sans marge |

Stratégie : déclare tôt le contrat dans `src/shared/ipc/` avec une première implémentation simple,
puis améliore. **Un contrat en retard bloque Dev A** : signale tout retard dans ton carnet.

---

## 12. Ne jamais faire

`INSERT INTO mouvements_stock` hors de `core/mouvements.ts` · modifier le CUMP ailleurs que dans la
réception et le stock initial · modifier une migration existante · supprimer une ligne (désactiver) ·
un montant flottant · faire confiance à l'interface pour un prix ou un utilisateur · une couleur en
dur · un texte en anglais · ajouter une dépendance sans accord · modifier un fichier de Dev A ·
changer la forme d'un contrat consommé par la caisse sans l'annoncer · trancher une décision en
attente · inventer une règle métier · développer une fonction du **périmètre exclu** (comptabilité,
boutique en ligne, multi-boutiques, appli mobile, intégration automatique mobile money, balance
connectée).

## 13. Git

Trois branches : `main` (version validée, installée chez la cliente) ← `test` (intégration
quotidienne) ← `b/<sujet>` (une tâche, 2 jours maximum).

- **Matin** : `git switch test && git pull`, puis `git switch b/<sujet>` et `git rebase test`.
  Une nouvelle branche de tâche se crée **depuis `test` à jour**.
- **Soir, tous les soirs** : `/verifier`, `/cloturer`, commit, `git push` — même tâche non finie.
- **Tâche finie** : PR vers **`test`** (jamais vers `main`), relue par Dev A le jour même, CI verte,
  fusion en squash, branche supprimée. Au moins une PR fusionnée par jour.
- **Vendredi** : test commun de `test`, puis PR `test` → `main` et tag.
- Commits `feat(catalogue): …`. Un écran inachevé peut être fusionné sans sa ligne dans `app/routes.tsx`.
