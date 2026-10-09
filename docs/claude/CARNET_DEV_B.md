# Carnet de bord — Claude Code de Dev B

Mémoire de session à session. **Nouvelle entrée en haut** à chaque fin de session (commande
`/cloturer`), lue à chaque début de session (commande `/reprendre`). L'autre Claude Code lit la
dernière entrée de ce carnet pour savoir ce que fait Dev B : écrire clairement, sans jargon interne
à la session.

Format d'une entrée :

```
## AAAA-MM-JJ — <branche> — <tâche>
**Fait** : …
**En cours** : … (fichiers, état exact)
**Prochaine étape** : … (assez précise pour reprendre sans rien relire d'autre)
**Questions ouvertes** : … (pour Dev B, pour l'autre développeur, pour la cliente)
**Contrats** : livrés / attendus / modifiés (impact pour l'autre développeur)
```

---

## 2026-10-07 / 08 — b/inventaires, b/inventaires-ecran — B11 et B12 fusionnées (B12 Inventaires)
**Fait** :
- **B11 fusionnée** (PR #39, #40) ; la PR de documentation **#41** (`b/docs-b11-fusion`) a rattrapé
  les deux commits restés hors de la PR #40 (B10 → ✅, carnet B11) et passé B11 à ✅.
- **Règles validées par Dev B**, écrites dans `REGLES_METIER.md` § 9.0 (et § 1.4 pour le journal) :
  - gérant seul (ouvrir, compter, valider, annuler) ; **un seul inventaire en cours** ; numéro `INV`
    dès l'ouverture ;
  - total, ou partiel = un rayon **et ses sous-rayons** (ou un sous-rayon) ;
  - chaque comptage **enregistré aussitôt**, théorique photographié à ce moment (une vente faite
    ensuite reste dans le stock) ; **recomptage = remplace** tant que l'inventaire est en cours ;
  - motif obligatoire au comptage si écart (liste du schéma : casse, vol, erreur de saisie,
    péremption, don, autre) + commentaire facultatif ;
  - **produits non comptés : stock inchangé** (avertissement avant validation) ;
  - périssables comptés **par produit** : un manquant est retiré des lots, date la plus ancienne
    d'abord (périmés compris), le reste sans lot ; un surplus entre sans lot ;
  - démarque = manquants × CUMP ; surplus chiffrés à part ; net ;
  - annulation d'un inventaire en cours : motif, journalisée (`annulation_inventaire`), aucun
    mouvement ; validé ou annulé = figé.
- **PR #42 `b/inventaires`** : migration `20261007_0900_inventaires.sql` (`inventaires.categorie_id`,
  `motif_annulation` ; `lignes_inventaire.compte_le`, `commentaire` ; index unique inventaire +
  produit ; triggers : pas de suppression, inventaire figé), module `src/main/modules/inventaires/`,
  contrat `src/shared/ipc/inventaires.ts`, règles pures `src/shared/inventaires.ts`
  (`repartirManquant`, `valeurEcart`, libellés). 18 tests (`tests/inventaires.test.ts` : 41 = écart
  nul ; savon 29 → 27 = **300 F** ; vente après comptage → 26 ; lots A −3 / B −2 ; panne → tout annulé).
- **PR #43 `b/inventaires-ecran`** : menu « Inventaires » (`modules/inventaires/PageInventaires.tsx`),
  logique pure `saisieInventaire.ts` (7 tests). Choix d'écran : **tableau + comptage en fenêtre**
  (règle des formulaires en fenêtre modale) au lieu de cartes dans la page ; `UI_UX.md` § 5.11
  réécrit. **Scénario complet testé à la main par Dev B.**
- B12 → ✅ et deux lignes au journal des fusions (dans `test`, le statut de B12 était resté ⏳ après
  la résolution d'un conflit de fusion : corrigé ici). 480 tests verts, typecheck et build OK.
- Astuce poste de Dev B : `C:\temp` n'existe pas ; base jetable avec
  `$env:POS_DB="$env:TEMP\inventaire.db"; npm run dev` (puis `Remove-Item Env:POS_DB`).

**En cours** : PR de documentation `b/docs-b12-fusion` → `test` (B12 ✅, journal des fusions, ce
carnet, archive de l'entrée du 2026-09-25) :
https://github.com/ryckos/pos-boutique/compare/test...b/docs-b12-fusion?expand=1

**Prochaine étape** :
1. Faire fusionner `b/docs-b12-fusion`. Supprimer sur GitHub les branches fusionnées :
   `b/inventaires`, `b/inventaires-ecran`, `b/docs-b11-fusion`, `b/docs-b12-fusion`, `b/sorties`,
   `b/sorties-ecran`, `b/docs-b10-fusion`, `b/commandes`, `b/commandes-ecran`, `b/docs-b8-fusion`,
   `b/receptions`, `b/receptions-ecran`, `b/fournisseurs`, `b/fournisseurs-achats`, `b/fefo`,
   `b/peremptions`, `b/reglements`, `b/reglements-ecran`.
2. **B13 Dépenses** (`/tache B13`, branche `b/depenses` depuis `test` à jour). Relire
   `REGLES_METIER.md` § 10, `UI_UX.md` (écran des dépenses s'il existe), tables `categories_depense` et
   `depenses` (`source` `caisse` / `fonds_propres`, `session_caisse_id`), numéro `DEP`.
   - Vérifier d'abord si `enregistrerMouvementCaisse()` (Dev A, A8) est arrivé dans `test` :
     `grep -rn enregistrerMouvementCaisse src/main`. Si non, ne faire que la source
     **« fonds propres »** et prévoir la source « caisse » dans le contrat (refus clair en attendant).
   - Questions à poser à Dev B avant le plan : catégories de dépenses de départ (loyer, électricité,
     eau, salaires, transport… créables par le gérant ?) ; droits (gérant seul, ou caissière pour une
     petite dépense de caisse ?) ; pièce justificative (référence texte) ; correction = annulation
     avec motif journalisée ? ; date passée acceptée ; plafond éventuel.
3. Ensuite Phase 4 : B14 rapports de gestion (rapport des pertes par cause : dons = libellé « Don »,
   démarques d'inventaire = document `inventaire`), B15 exports Excel, B16 sauvegardes (D-A4 en attente).

**Questions ouvertes** :
- Colonne « Suivi péremption » dans l'import Excel : toujours non confirmée par Dev B.
- Plafond de remise caissier (D-A3) : en attente de la cliente.
- Réactivation (produit, compte, catégorie, fournisseur) : non prévue. Photo des produits : reportée.
- Paiement d'un fournisseur depuis le tiroir : après A8.

**Contrats** :
- Ajoutés (gérant, **sans impact pour la caisse**) : `inventaires:ouvrir`, `enCours`, `detail`,
  `liste`, `compter`, `valider`, `annuler`. Nouveau module enregistré dans `src/main/ipc/index.ts`,
  `src/shared/ipc/index.ts` et `app/routes.tsx`.
- **Pour Dev A** : nouvelle migration (tables `inventaires` et `lignes_inventaire` seulement, plus des
  triggers) ; aucune table de la caisse touchée. L'historique d'un produit affiche « Inventaire
  INV-… ».
- Attendu : `enregistrerMouvementCaisse()` (Dev A, A8, prévu fin S10) toujours pas livré ; il bloque
  B13 (source caisse) et le paiement des fournisseurs au tiroir.

---

## 2026-10-06 (suite) — b/sorties, b/sorties-ecran — B11 Sorties de stock et retours fournisseur
**Fait** :
- **B10 fusionnée** (PR #37 et #38) : B10 → ✅ et deux lignes au journal des fusions. Le commit
  `docs(etat)` de la branche `b/docs-b10-fusion` a été **repris sur `b/sorties-ecran`** : la PR
  `b/docs-b10-fusion` devient inutile (à fermer sans fusion, branche à supprimer). Branches locales
  `b/reglements` et `b/reglements-ecran` supprimées.
- **Règles validées par Dev B**, écrites dans `REGLES_METIER.md` § 8 (précisions B11), § 4.5 (avoirs)
  et § 1.4 (journal) :
  - avoir suivi dans une **table dédiée** : attendu → reçu (montant réel, peut différer) ou refusé
    (motif journalisé, `refus_avoir_fournisseur`) ; annulé avec la sortie tant qu'il est attendu ;
  - avoir reçu imputé **comme un règlement global** ; s'il dépasse la dette, le solde devient
    **négatif = avoir à valoir**, consommé par les livraisons suivantes ; désactivation d'un
    fournisseur refusée si solde ≠ 0 ou avoir attendu ;
  - coût de l'avoir : **prix du lot** s'il vient de ce fournisseur, sinon **dernier prix payé** à ce
    fournisseur, sinon CUMP ; avoir = quantité × coût arrondi au franc, corrigeable ;
  - don = `casse` + libellé « Don » (pas de type dédié) ; retour seulement pour « Défectueux ou casse »
    et « Périmé » ;
  - quantité au plus le stock du lot ou du produit ; sortie chiffrée au CUMP ; gérant ; pas de numéro ;
  - annulation par contre-passation, motif, journalisée (`annulation_sortie_stock`), refusée si
    l'avoir est reçu ou refusé ; vaut aussi pour les retraits du tableau des péremptions.
- **PR 1 `b/sorties` fusionnée (PR #39, commit de fusion)** : migration
  `20261006_1400_retours_fournisseur.sql`, `stock/sorties.ts`, `fournisseurs/avoirs.ts`, avoirs dans
  `SOLDE_DU`, l'échéancier et `v_dettes_fournisseurs`, règles pures `MOTIFS_SORTIE`, `coutRetour`,
  `avoirAttendu` (`src/shared/stock.ts`). 18 tests (`tests/sorties.test.ts`). `MODELE_DONNEES.md` à jour.
- **PR 2 `b/sorties-ecran`** (commit `49b156a`, poussée) : menu « Sorties de stock »
  (`PageSorties.tsx`), logique pure `saisieSortie.ts` (6 tests), avoirs dans `FenetreDettes.tsx`
  (« Avoir reçu », « Refusé »), page Fournisseurs (avoir à valoir hors du total dû, avoir attendu),
  `UI_UX.md` § 5.9 et 5.17. **Scénario complet testé à la main par Dev B.**
- 455 tests verts, typecheck OK.

**En cours** : PR 2 `b/sorties-ecran` → `test` à ouvrir ou en relecture
(https://github.com/ryckos/pos-boutique/compare/test...b/sorties-ecran?expand=1 ; texte fourni à
Dev B). Elle porte aussi ce carnet et le passage de B10 à ✅.

**Prochaine étape** :
1. Après la fusion de la PR 2 : B11 → ✅ et une ligne au journal des fusions de `ETAT_AVANCEMENT.md` ;
   fermer la PR `b/docs-b10-fusion` si elle a été ouverte ; supprimer `b/sorties`, `b/sorties-ecran`,
   `b/docs-b10-fusion` (local et GitHub). Sur GitHub restent aussi à supprimer : `b/commandes`,
   `b/commandes-ecran`, `b/docs-b8-fusion`, `b/receptions`, `b/receptions-ecran`, `b/fournisseurs`,
   `b/fournisseurs-achats`, `b/fefo`, `b/peremptions`, `b/reglements`, `b/reglements-ecran`.
2. **B12 Inventaires** (`/tache B12`, branche `b/inventaires` depuis `test` à jour). Relire
   `REGLES_METIER.md` § 9 (et § 9.1 pour le comptage par conditionnement déjà fait en B6 :
   `saisieStockInitial.ts`, `repartirStock`), `UI_UX.md` § 5.11, `SCENARIO_REFERENCE.md` (1 carton +
   5 lots + 2 unités = **41** ; 2 savons × 150 = **300 F** de démarque). Tables `inventaires` et
   `lignes_inventaire` (écart = colonne générée, `detail_comptage` JSON), numéro `INV`, mouvements
   `ajustement_inventaire` au CUMP avec `document_type = 'inventaire'` (l'historique B4 affiche déjà
   « Inventaire INV-… »), journal `validation_inventaire`. Questions à poser à Dev B avant le plan :
   inventaire total ou par rayon (les deux ?) ; que faire des ventes faites pendant le comptage
   (théorique photographié au comptage de chaque produit ?) ; comptage par lot pour les produits
   périssables ; liste des motifs d'écart ; qui compte (gérant seul, ou caissière qui saisit et gérant
   qui valide) ; inventaire en cours repris après une coupure.
3. B13 Dépenses reste bloquée par `enregistrerMouvementCaisse()` (Dev A, A8) pour la source
   « caisse » ; la source « fonds propres » peut démarrer seule si B12 attend.

**Questions ouvertes** :
- Colonne « Suivi péremption » dans l'import Excel : toujours non confirmée par Dev B.
- Plafond de remise caissier (D-A3) : en attente de la cliente.
- Réactivation (produit, compte, catégorie, fournisseur) : non prévue. Photo des produits : reportée.
- Paiement d'un fournisseur depuis le tiroir : après A8 (motif de mouvement de caisse à prévoir).
- Rapports de pertes (B14) : distinguer les dons des casses par le libellé « Don » (pas de type dédié).

**Contrats** :
- Ajoutés (gérant, **sans impact pour la caisse**) : `stock:ficheSortie`, `stock:enregistrerSortie`,
  `stock:sorties`, `stock:annulerSortie`, `fournisseurs:avoirRecu`, `fournisseurs:refuserAvoir` ;
  champ facultatif `Fournisseur.avoirsAttendus` ; `DettesFournisseur.avoirs` et `avoirsAttendus` ;
  `Fournisseur.soldeDu` peut désormais être **négatif** (avoir à valoir).
- **Pour Dev A** : nouvelle migration (table `retours_fournisseur`, vue `v_dettes_fournisseurs`), aucune
  table de la caisse touchée. Une casse issue d'un retour client (A7, `document_type = 'vente'`)
  n'apparaît pas dans les sorties de Dev B et ne s'y annule pas. `MOTIFS_SORTIE` et
  `LIBELLES_MOUVEMENT` (`src/shared/stock.ts`) sont réutilisables.
- Attendu : `enregistrerMouvementCaisse()` (Dev A, A8, fin S10) pas encore livré ; il bloque B13
  (source caisse) et le paiement des fournisseurs au tiroir.

---

## 2026-10-06 — b/reglements, b/reglements-ecran — B10 Règlements et dettes fournisseurs
**Fait** :
- **PR #35 (`b/fefo`) et #36 (`b/peremptions`) fusionnées** le 2026-10-06 (commits de fusion) :
  B9 → ✅, rendez-vous `allouerFefo` → ✅, deux lignes au journal des fusions (sur `b/reglements`).
  Branches supprimées en local.
- **Règles validées par Dev B**, écrites dans `REGLES_METIER.md` § 4.5 :
  - un règlement paie une **réception précise** ou le **solde global** ; le global couvre d'abord la
    réception la plus ancienne ;
  - montant en francs entiers > 0, **au plus le reste dû** (pas d'avance, dette jamais négative) ;
  - modes espèces, TMoney, Flooz, virement, autre ; référence facultative ; date du jour par défaut,
    passée acceptée, jamais future ; pas de numéro ; paiement non journalisé ;
  - **hors caisse** pour l'instant (paiement au tiroir après A8 de Dev A) ;
  - correction = **annulation avec motif**, journalisée (`annulation_reglement_fournisseur`, § 1.4) ;
    le règlement reste visible, ne compte plus ; une seule fois ;
  - échéancier : « Soldée », « À payer le … » (jour de l'échéance compris), « En retard de N j » ;
    alerte du retard par fournisseur et au total sur la page Fournisseurs.
- **PR 1 `b/reglements`** (commit `61e9dd5`, poussée) : migration
  `20261006_1000_annulation_reglement.sql` (`annule_le`, `annule_par`, `motif_annulation` ;
  `v_dettes_fournisseurs` recréée sans les annulés), règle pure `src/shared/fournisseurs.ts`
  (`imputerReglements`, `joursEntre`, `LIBELLES_MODE_REGLEMENT`), service
  `modules/fournisseurs/reglements.ts`, 3 canaux gérant, `SOLDE_DU` de `fournisseurs/service.ts`
  filtré sur les non annulés. 11 tests (`tests/reglements.test.ts` : 18 000 − 10 000 = **8 000**, 8 001
  refusé ; global 20 000 sur 18 000 + 13 200 → **11 200** ; annulation ; 5 jours de retard ; refus ;
  désactivation après paiement).
- **PR 2 `b/reglements-ecran`** (commit `30f9a62`, empilée sur la PR 1, poussée) : boutons « Dettes » et
  « Payer » sur la page Fournisseurs, retard en en-tête et par ligne, `FenetreDettes.tsx` (échéancier,
  règlements, payer, annuler), logique pure `saisieReglement.ts` (4 tests), `UI_UX.md` § 5.17.
  **Scénario complet testé à la main par Dev B.**
- 431 tests verts, typecheck OK.

**En cours** : deux PR à ouvrir sur GitHub (`gh` absent de ce poste), **dans l'ordre** ; le texte de
chacune a été fourni à Dev B dans la session :
1. `b/reglements` → `test` : https://github.com/ryckos/pos-boutique/compare/test...b/reglements?expand=1
2. `b/reglements-ecran` → `test`, après la fusion de la PR 1. Si la PR 1 est fusionnée en squash :
   `git switch b/reglements-ecran && git fetch && git rebase --onto origin/test 61e9dd5 && git push --force-with-lease`.
   Ce carnet est commité sur `b/reglements-ecran`.

**Prochaine étape** :
1. Suivre les fusions : une ligne au journal des fusions de `ETAT_AVANCEMENT.md` par PR ; après la
   PR 2, B10 → ✅ (Phase 2 terminée côté Dev B). Supprimer les branches. Sur GitHub, Dev B doit encore
   supprimer `b/commandes`, `b/commandes-ecran`, `b/docs-b8-fusion`, `b/receptions`,
   `b/receptions-ecran`, `b/fournisseurs`, `b/fournisseurs-achats`, `b/fefo`, `b/peremptions`.
2. **B11 Sorties de stock et retours fournisseur** (`/tache B11`, branche `b/sorties` depuis `test`
   à jour). Relire `REGLES_METIER.md` § 8 et § 4.5, `UI_UX.md` (écran « Sortie de stock »),
   `SCENARIO_REFERENCE.md` (2 boîtes bombées × 250 = **500 F** d'avoir). Points à trancher avec Dev B
   avant le plan :
   - où stocker l'avoir attendu et sa confirmation (aucune table d'avoirs dans le schéma → migration) ;
   - l'avoir confirmé doit **se déduire du solde dû** : à intégrer dans `SOLDE_DU`
     (`fournisseurs/service.ts`), dans `imputerReglements` / `receptionsImputees`
     (`fournisseurs/reglements.ts`) et dans `v_dettes_fournisseurs` (nouvelle migration) — un avoir
     s'impute-t-il comme un règlement global ?
   - coût de l'avoir : CUMP ou prix du lot ; sortie depuis un lot précis (FEFO) ou non ;
   - type « don » dédié (demande de recréer le CHECK : à voir avec Dev A) ou `casse` + motif « don ».

**Questions ouvertes** :
- Colonne « Suivi péremption » dans l'import Excel : toujours non confirmée par Dev B.
- Plafond de remise caissier (D-A3) : en attente de la cliente.
- Réactivation (produit, compte, catégorie, fournisseur) : non prévue. Photo des produits : reportée.
- Paiement d'un fournisseur depuis le tiroir : après A8 ; motif de mouvement de caisse à prévoir
  (`mouvements_caisse.motif` n'a que `autre` qui convienne → migration du CHECK, à décider avec Dev A).

**Contrats** :
- Ajoutés (gérant, **sans impact pour la caisse**) : `fournisseurs:enregistrerReglement`,
  `fournisseurs:annulerReglement`, `fournisseurs:dettes` ; champs facultatifs `Fournisseur.enRetard`
  et `prochaineEcheance`.
- **Pour Dev A** : nouvelle migration (table `reglements_fournisseurs` et vue `v_dettes_fournisseurs`
  seulement) ; `allouerFefo` est dans `test` (PR #35), A9 peut démarrer.
- Attendu : `enregistrerMouvementCaisse()` (Dev A, A8, fin S10) pas encore livré ; il bloque B13 et le
  paiement des fournisseurs au tiroir.

---

## 2026-10-04 — b/fefo, b/peremptions — B9 Lots, FEFO, tableau des péremptions
**Fait** :
- PR #34 (`b/docs-b8-fusion`) fusionnée ; `test` local mis à jour, branche supprimée en local.
- **Règles validées par Dev B**, écrites dans `REGLES_METIER.md` § 5.1 :
  - le FEFO ne sert que les lots en stock **non périmés** (date ≥ aujourd'hui), date la plus proche
    d'abord, puis le lot le plus ancien ;
  - la répartition couvre toujours toute la quantité : le reste sort **sans lot** (D-A1, jamais bloquer) ;
  - tableau : lots sous `peremption_seuil_jours`, **périmés compris** (« Périmé depuis 2 j »), rouge à
    3 jours ou moins, ambre au-delà ; valeur en jeu = restant × prix d'achat du lot ;
  - « Retirer » : quantité saisie (restant proposé), au plus le restant ; `perte_peremption` sur le lot,
    motif « Périmé » (+ commentaire facultatif), chiffré au CUMP, gérant, pas de journal d'audit ;
  - « Promo » : affiché inactif, à brancher avec les promotions programmées (A16, Dev A), car une
    promotion vaut pour tout le produit.
- **PR 1 `b/fefo`** (commit `c1254dc`, poussée) : `src/main/modules/stock/fefo.ts`
  (`allouerFefo`), 8 tests (`tests/fefo.test.ts` : A12 avant B03, 9 + 3, reste sans lot, lot vidé ou
  périmé ignoré, lot du jour servi, égalité de date, quantité au poids).
- **PR 2 `b/peremptions`** (commit `980ea5b`, empilée sur la PR 1, poussée) : service
  `stock/peremptions.ts`, canaux `stock:peremptions` et `stock:retirerLot`, écran
  `PagePeremptions.tsx` (menu « Péremptions », gérant), classes communes `.tableau tr.ligne-urgente`
  et `tr.ligne-proche`, `UI_UX.md` § 5.8 complété. 6 tests (`tests/peremptions.test.ts` : scénario du
  mardi 5 400 + 18 900 = **24 300**, périmés, horizon, retraits et refus). **Testé à la main par Dev B.**
- 416 tests verts, typecheck OK. Aucune migration.

**En cours** : deux PR à ouvrir sur GitHub (`gh` absent de ce poste), **dans l'ordre** :
1. `b/fefo` → `test` : https://github.com/ryckos/pos-boutique/compare/test...b/fefo?expand=1
2. `b/peremptions` → `test`, après la fusion de la PR 1. Si la PR 1 est fusionnée en squash :
   `git switch b/peremptions && git fetch && git rebase --onto origin/test c1254dc && git push --force-with-lease`.
   Ce carnet est commité sur `b/peremptions`.

**Prochaine étape** :
1. Suivre les fusions : à chaque fusion, une ligne au journal des fusions de `ETAT_AVANCEMENT.md` ;
   après la PR 1, rendez-vous `allouerFefo` → ✅ ; après la PR 2, B9 → ✅. Supprimer les branches.
   Supprimer aussi sur GitHub les branches déjà fusionnées : `b/commandes`, `b/commandes-ecran`,
   `b/docs-b8-fusion`, `b/receptions`, `b/receptions-ecran`, `b/fournisseurs`, `b/fournisseurs-achats`.
2. **B10 Règlements et dettes fournisseurs** (`/tache B10`, branche `b/reglements` depuis `test` à jour).
   Relire `REGLES_METIER.md` § 4.5 (dettes, échéance déjà figée à la réception : `receptions.date_echeance`)
   et § 4.6 ; tables `reglements_fournisseurs`, vue `v_dettes_fournisseurs` ; le solde dû est déjà
   calculé dans `fournisseurs/service.ts` (même formule que la vue). Questions à poser à Dev B avant le
   plan : règlement imputé à une réception précise ou au solde global ? modes de paiement ? règlement
   depuis la caisse (dépend de `enregistrerMouvementCaisse`, A8) ou hors caisse seulement ? numérotation ?

**Questions ouvertes** :
- Colonne « Suivi péremption » dans l'import Excel : toujours non confirmée par Dev B.
- Plafond de remise caissier (D-A3) : en attente de la cliente.
- Réactivation (produit, compte, catégorie, fournisseur) : non prévue. Photo des produits : reportée.

**Contrats** :
- **Livré à Dev A (rendez-vous fin S10, en relecture PR 1)** : `allouerFefo(db, produitId, qteBase)`
  de `src/main/modules/stock/fefo.ts`, appel direct dans le principal (pas d'IPC), lecture seule, à
  appeler **dans la transaction de la vente** → `{ lotId: number | null; quantite: number }[]`.
  Somme des parts = `qteBase` ; **un mouvement `vente` par part** (`lotId` tel quel, `null` = part non
  couverte) ; lots périmés jamais servis ; `[]` si `qteBase` ≤ 0. Débloque A9 (`service-vente.ts`,
  commentaire « Lot : null jusqu'au FEFO »).
- Ajoutés (gérant, sans impact pour la caisse) : `stock:peremptions`, `stock:retirerLot`.
- **Pour Dev A** : le bouton « Promo −20 % » du tableau attend les promotions programmées (A16) ;
  nouvelles classes communes `.tableau tr.ligne-urgente` / `tr.ligne-proche`.
- Attendus : `enregistrerMouvementCaisse()` (Dev A, A8, fin S10) pas encore livré.

---

## 2026-10-01 — b/commandes, b/commandes-ecran — B8 partie 3 : commandes fournisseur (fusionnées, B8 ✅)
**Fait** :
- **PR #25, #26, #27 fusionnées** (réceptions serveur, écran Réceptions, achats d'un fournisseur) :
  B7 → ✅ dans `ETAT_AVANCEMENT.md`, trois lignes au journal des fusions. Branches `b/receptions`,
  `b/receptions-ecran`, `b/fournisseurs-achats` supprimées **en local** ; sur GitHub, à supprimer par
  Dev B (refusé à Claude par les permissions).
- **Règles validées par Dev B**, écrites dans `REGLES_METIER.md` § 4.7 :
  - on commande **dans le conditionnement** (3 cartons) ; comparaison avec le reçu en unités de base ;
  - « Proposer depuis les alertes » liste les produits en rupture / stock bas, **sans quantité
    calculée** : le gérant coche et saisit (variante simple choisie par Dev B) ;
  - états : brouillon → « Marquer comme envoyée » (aperçu à copier pour WhatsApp, pas d'envoi
    automatique) ; à chaque réception liée, automatiquement `recue` ou `recue_partiel` ;
    « Clôturer » (reste qui ne viendra pas) et « Annuler » (non livrée) avec motif journalisé ;
  - commande reçue en partie : reste ouverte, reste à recevoir pré-rempli à la réception ; le prix
    payé à la réception l'emporte (écart affiché) ; article non commandé accepté ;
  - numéro `CA` dès le brouillon (gardé si annulé) ; **seul le brouillon se modifie** ;
  - une ligne par produit ; prix prévu facultatif ; liaison seulement à une commande envoyée ou reçue
    en partie du même fournisseur ; « Clôturer » seulement si reçue en partie.
  - Nouvelles actions au journal (§ 1.4) : `annulation_commande`, `cloture_commande`.
- **PR 1 `b/commandes`** (commit `e6b81e2`, poussée) : migration
  `20261001_0833_commande_conditionnement.sql` (`lignes_commande_achat.conditionnement_id`),
  service `modules/achats/commandes.ts`, 9 canaux gérant, `commandeId` facultatif sur
  `achats:validerReception` (statut de la commande recalculé dans la même transaction), numéro de
  commande dans le détail d'une réception. 11 tests (`tests/commandes.test.ts`).
- **PR 2 `b/commandes-ecran`** (commit `ae27ab3`, empilée sur la PR 1, poussée) : menu « Commandes »
  (`PageCommandes.tsx`), logique pure `saisieCommande.ts` (10 tests), bandeau « Livrer CA-… » sur
  l'écran Réceptions (`livrerCommande`, `changerFournisseur` dans `saisieReception.ts`), champ `unite`
  sur les lignes de commande, classe commune `.apercu`, `UI_UX.md` § 5.18.
- 376 tests verts, typecheck OK ; **scénario complet testé à la main par Dev B** (alertes, brouillon,
  envoi et copie, réception partielle avec écart de prix, clôture, annulation).

**En cours** : rien. Les deux PR ont été fusionnées pendant la clôture : **#31** (`b/commandes`) et
**#33** (`b/commandes-ecran`). **B8 → ✅** et deux lignes au journal des fusions, dans la petite PR de
documentation `b/docs-b8-fusion` → `test`, qui porte aussi ce carnet :
https://github.com/ryckos/pos-boutique/compare/test...b/docs-b8-fusion?expand=1

**Prochaine étape** :
1. Faire fusionner `b/docs-b8-fusion`. Supprimer `b/commandes`, `b/commandes-ecran` et
   `b/docs-b8-fusion`, en local et sur GitHub.
2. **B9 Lots, FEFO, tableau des péremptions** (`/tache B9`, branche `b/fefo` depuis `test` à jour) :
   - d'abord **`allouerFefo(db, produitId, qteBase)`** pour Dev A (**rendez-vous fin S10**, A9) :
     répartition par lots, date la plus proche d'abord, depuis `v_stock_lots` ; à placer dans
     `modules/stock/` ; demander à Dev B le comportement quand les lots ne suffisent pas (stock
     négatif : D-A1 en attente, ne jamais bloquer une vente) ;
   - puis le tableau des péremptions (`UI_UX.md` § 5.8, horizon `peremption_seuil_jours`, valeur en
     jeu = restant × prix d'achat du lot, actions Promo / Retirer = `perte_peremption`).
   - Relire `REGLES_METIER.md` § 5 et `SCENARIO_REFERENCE.md` avant le plan. Les lots créés par la
     réception portent `reception_id` et le coût par unité arrondi au franc.

**Questions ouvertes** :
- B9 : que renvoie `allouerFefo` quand la quantité dépasse les lots disponibles ? À poser à Dev B
  (et à accorder avec Dev A, A9).
- Colonne « Suivi péremption » dans l'import Excel : toujours non confirmée par Dev B.
- Plafond de remise caissier (D-A3) : en attente de la cliente.
- Réactivation (produit, compte, catégorie, fournisseur) : non prévue. Photo des produits : reportée.

**Contrats** :
- Ajoutés (gérant, **sans impact pour la caisse**) : `achats:creerCommande`, `modifierCommande`,
  `envoyerCommande`, `annulerCommande`, `cloturerCommande`, `commande`, `listeCommandes`,
  `commandesOuvertes`, `produitsEnAlerte` ; champ facultatif `commandeId` sur
  `achats:validerReception` ; `Reception.commande` (numéro, facultatif).
- **Pour Dev A** : nouvelle migration (aucune table de la caisse touchée) ; nouvelle classe commune
  `.apercu` (texte à copier) ; menu « Commandes » ajouté par `modules/achats/routes.tsx`.
- Prochain rendez-vous à livrer : `allouerFefo()` (fin S10, B9). Attendus : `sessionOuverte()` existe
  déjà ; `enregistrerMouvementCaisse()` (Dev A, A8, fin S10) pas encore livré.

---

## 2026-09-30 (suite) — b/receptions, b/receptions-ecran, b/fournisseurs-achats — B8 parties 1 et 2, B7 partie 2
**Fait** :
- **B7 partie 1 fusionnée** (PR #24), inscrite au journal des fusions. `b/fournisseurs` est supprimée en
  local ; **sur GitHub, sa suppression reste à faire par Dev B** (refusée à Claude par les permissions).
- **Règles validées par Dev B**, écrites dans `REGLES_METIER.md` § 4.2 (réception) :
  - le brouillon ne vit que dans l'écran, gardé sur le poste ; **numéro RC attribué à la validation** ;
  - prix proposé = dernier prix payé pour ce conditionnement, sinon prix indicatif × quantité, sinon vide ;
  - prix en francs entiers > 0 ; alerte non bloquante si coût par unité ≥ prix de vente de l'Unité ;
  - quantité entière, décimales seulement au poids ou au volume (kg, g, litre, ml) ;
  - lot et date obligatoires si périssable ; date passée refusée ; date sous le seuil = alerte ;
  - échéance figée à la validation (jour + délai du fournisseur) ;
  - **une réception validée ne se modifie ni ne s'annule** (correction par retour fournisseur ou
    inventaire) ; pas de journal d'audit ;
  - scanner deux fois le même article = **deux lignes** (`UI_UX.md` § 5.6).
- Règles de l'historique des achats (`REGLES_METIER.md` § 4.6) :
  - livraisons sur 90 jours par défaut ;
  - prix sur toute l'histoire, écart avec la livraison précédente du **même** fournisseur ;
  - pas de comparaison entre fournisseurs (renvoyée à B14).
- **Trois branches empilées, poussées, testées à la main par Dev B** (sauf la PR 1, sans écran) :
  1. `b/receptions` (commit `7db755b`) : migration `20260930_1400_echeance_reception.sql`
     (`receptions.date_echeance`), service `modules/achats/receptions.ts`, contrat `src/shared/ipc/achats.ts`,
     règles pures `src/shared/achats.ts` (`convertirLigne`, `nouveauCump`). Une transaction : lignes, lots,
     mouvements `reception` (`document_type = 'reception'`), CUMP ligne après ligne, dette, RC.
     Tests : 250 ; 262,8 ; stock ≤ 0 ; 43 200 ; panne simulée en pleine écriture → tout annulé.
  2. `b/receptions-ecran` (commits `8495aed`, `9824d72`) : menu « Réceptions » (gérant),
     `modules/achats/PageReceptions.tsx`, `saisieReception.ts` (logique pure testée),
     `FenetreDetailReception.tsx`, canal `achats:listeReceptions`, `FenetreProduit` accepte
     `libelleValider`, style commun `.tableau-saisie select`.
  3. `b/fournisseurs-achats` (commit `9c90068`) : canal `fournisseurs:achats`, `fournisseurs/achats.ts`,
     fenêtre `FenetreAchats.tsx` (bouton « Achats » sur la page Fournisseurs).
- 334 tests verts ; typecheck OK.

**En cours** : trois PR à ouvrir sur GitHub (`gh` absent de ce poste), **dans l'ordre**, chacune après la
fusion de la précédente. Le texte de chacune a été fourni à Dev B dans la session.
1. PR 1 `b/receptions` → `test` : https://github.com/ryckos/pos-boutique/compare/test...b/receptions?expand=1
2. PR 2 `b/receptions-ecran` → `test`, après la fusion de la PR 1.
   Si la PR 1 est fusionnée en squash :
   `git switch b/receptions-ecran && git fetch && git rebase --onto origin/test 7db755b && git push --force-with-lease`.
3. PR 3 `b/fournisseurs-achats` → `test`, après la fusion de la PR 2.
   Si la PR 2 est fusionnée en squash : `git rebase --onto origin/test 9824d72`.
   Ce carnet est commité sur cette branche.

**Prochaine étape** :
1. Suivre les fusions :
   - à chaque fusion, une ligne au journal des fusions de `ETAT_AVANCEMENT.md` ;
   - après la PR 3, B7 → ✅ ;
   - supprimer les branches fusionnées.
2. **B8 partie 3 : commandes fournisseur** (branche depuis `test` une fois les PR fusionnées, ou
   empilée). Avant tout code, obtenir les réponses de Dev B :
   - quantité commandée en conditionnements ou en unités de base ? `lignes_commande_achat` n'a pas de
     `conditionnement_id`, donc commander en cartons demande une migration ;
   - calcul de la quantité suggérée depuis les alertes de stock (`v_alertes_stock`) ;
   - passage à `recue` : quantités atteintes, ou décision du gérant ?
   - numéro `CA` via `prochainNumero` ; réception liée : `receptions.commande_id` ; `recue_partiel`.
3. Puis **B9** : `allouerFefo(db, produitId, qteBase)` pour Dev A, **rendez-vous fin S10** ; et le
   tableau des péremptions. Les lots créés par la réception portent `reception_id` et le coût par unité
   arrondi au franc.

**Questions ouvertes** :
- Commandes (ci-dessus) : à poser à Dev B.
- Colonne « Suivi péremption » dans l'import Excel : toujours non confirmée par Dev B.
- Plafond de remise caissier (D-A3) : en attente de la cliente.
- Réactivation (produit, compte, catégorie, fournisseur) : non prévue. Photo des produits : reportée.

**Contrats** :
- Ajoutés (gérant, **sans impact pour la caisse**) : `achats:articleReception`, `achats:validerReception`,
  `achats:reception`, `achats:listeReceptions`, `fournisseurs:achats`. Nouveau module `achats` enregistré
  dans `src/main/ipc/index.ts` et `src/shared/ipc/index.ts` ; menu « Réceptions » dans `app/routes.tsx`.
- **Pour Dev A** :
  - le CUMP bouge désormais à chaque réception : `coutConditionnement` de `ArticleCatalogue`
    le reflète sans changement de contrat ;
  - l'historique d'un produit affiche « Réception RC-… » ;
  - nouvelle classe commune `.tableau-saisie select`.
- Prochain rendez-vous à livrer : `allouerFefo()` (fin S10, B9). Attendus inchangés : `sessionOuverte()` et
  `enregistrerMouvementCaisse()` (Dev A, fin S10).

---

## 2026-09-30 — b/fournisseurs — B4 fusionnée, B7 Fournisseurs (partie 1)
**Fait** :
- **B4 fusionnée** (PR #22 et #23, le 28/09) et passée à ✅ dans `ETAT_AVANCEMENT.md`, avec deux lignes
  au journal des fusions (commit `7e613c8`).
- **Règles validées par Dev B**, écrites dans `REGLES_METIER.md` § 4.6 :
  - droits : gérant (et admin) ;
  - nom obligatoire, unique parmi les fournisseurs actifs (majuscules et espaces ignorés) ;
  - délai de paiement entier de 0 (comptant) à 365 jours ;
  - contact, téléphone, adresse facultatifs, en texte libre ;
  - désactivation avec motif obligatoire, journalisée (`desactivation_fournisseur`), **refusée tant que
    le solde dû est supérieur à 0**, sinon la dette sortirait de `v_dettes_fournisseurs`, qui ne compte
    que les actifs ;
  - modifications de la fiche non journalisées ;
  - fournisseur de démo « Grossiste Hédzranawoé », 15 jours.
- **B7 partie 1** (commit `66d9114`, poussé sur `origin/b/fournisseurs`) :
  - module `src/main/modules/fournisseurs/` (`service.ts`, `ipc.ts`) et contrat
    `src/shared/ipc/fournisseurs.ts` ;
  - écran `modules/fournisseurs/PageFournisseurs.tsx` : menu « Fournisseurs » (gérant), « Total dû »,
    fenêtres modales, `UI_UX.md` § 5.17 ;
  - seed : le grossiste de démo, présent seulement dans une base créée à neuf.
  - Aucune migration : la table `fournisseurs` existait déjà.
- Le solde dû est calculé dans le service avec la même formule que la vue (réceptions − règlements),
  pour afficher aussi celui des fournisseurs désactivés. Les avoirs (B11) ne sont pas encore déduits.
- 277 tests verts (18 nouveaux dans `tests/fournisseurs.test.ts`) ; typecheck OK. **Essai à la main fait
  par Dev B.** Le refus pour dette ne peut pas encore s'essayer à l'écran (pas de réception avant B8) :
  il est couvert par les tests, avec des réceptions et des règlements insérés directement.

**En cours** :
- PR `b/fournisseurs` → `test` à ouvrir sur GitHub (`gh` absent de ce poste) :
  https://github.com/ryckos/pos-boutique/compare/test...b/fournisseurs?expand=1. Le texte, rempli
  selon le modèle, a été fourni à Dev B. Ensuite, relecture par Dev A.
- Les branches déjà fusionnées `b/stock` et `b/stock-historique` sont **à supprimer par Dev B**, en local
  et sur GitHub. La suppression a été refusée à Claude par les permissions du poste.

**Prochaine étape** :
1. Après la fusion de la PR B7 partie 1 :
   - ajouter une ligne au journal des fusions de `ETAT_AVANCEMENT.md` ;
   - laisser B7 en 🔄, la partie 2 restant à faire.
2. **B8 Commandes et réceptions** (`/tache B8`), sur une branche `b/receptions` créée depuis `test` à jour.
   - Relire `REGLES_METIER.md` § 4.1 à 4.5, `UI_UX.md` § 5.6 et 5.7, et `SCENARIO_REFERENCE.md` (lundi 8 h).
   - Tests du CUMP : 3 cartons à 6 000 → **250** ; puis 46 boîtes en stock à 250 + 2 cartons à 6 600
     (48 boîtes à 275) → **262,8**.
   - La dette est égale au total de la réception, avec une échéance calculée depuis
     `delai_paiement_jours`. Il faut regarder où la stocker : la table `receptions` n'a pas de colonne
     d'échéance, ce qui demandera peut-être une migration.
   - Mettre `document_type = 'reception'` pour que l'historique B4 affiche le numéro `RC`.
   - Ne proposer à la réception que les fournisseurs **actifs**.
3. **B7 partie 2**, avec ou juste après B8 : historique des achats et des prix d'achat d'un fournisseur
   (lecture de `receptions` et `lignes_reception`), en fenêtre depuis la page Fournisseurs. B7 passera
   alors à ✅.

**Questions ouvertes** :
- Colonne « Suivi péremption » dans l'import Excel : toujours non confirmée par Dev B.
- Plafond de remise caissier (D-A3) : en attente de la cliente.
- Réactivation (produit, compte, catégorie, fournisseur) : non prévue. Photo des produits : reportée.

**Contrats** :
- Ajoutés (gérant, **sans impact pour la caisse**) : `fournisseurs:liste` → `Fournisseur[]` (avec
  `soldeDu` et `derniereReception`), `fournisseurs:creer`, `fournisseurs:modifier`,
  `fournisseurs:desactiver` `{ id, motif }`. Nouveau module enregistré dans `src/main/ipc/index.ts`,
  contrat dans `src/shared/ipc/index.ts`, menu dans `app/routes.tsx`.
- Prochain rendez-vous à livrer : `allouerFefo()` (fin S10, B9).
- Attendus, inchangés : `sessionOuverte()` et `enregistrerMouvementCaisse()` (Dev A, fin S10).

---

## 2026-09-28 — b/stock et b/stock-historique — B4 Écran stock et historique produit
**Fait** :
- **B6 fusionnée** (PR #21) : B6 et le rendez-vous « Stock initial » (fin S7) passés à ✅ ; branche
  `b/stock-initial` supprimée (local et GitHub).
- **Règles validées par Dev B**, écrites dans `REGLES_METIER.md` § 3.3 : dormant = produit **avec
  stock**, sans vente **terminée** (ticket ou facture) depuis `dormant_jours` ; jamais vendu → compté
  depuis la première entrée en stock ; répartition indicative en remplissant le plus grand
  conditionnement d'abord (46 = 1 carton + 7 lots + 1 unité), rien si stock ≤ 0 ou sans intérêt ;
  historique sur une période (30 jours par défaut), stock de début, stock après chaque mouvement,
  stock de fin ; documents lisibles.
- **Partie 1** (`b/stock`, commit `ab413b4`, poussé) : canal `stock:etat`, service
  `stock/etat.ts`, règle pure `src/shared/stock.ts` (`repartirStock`, réutilisable en B12), écran
  `modules/stock/PageStock.tsx` (pastilles ruptures / stocks bas / dormants, valeur totale, filtres,
  douchette). L'ancien aperçu est retiré : `catalogue:produitsStock`, `ProduitStock`,
  `PageCatalogue.tsx`. Styles communs `.tableau .detail` et espacement des pastilles. `UI_UX.md` § 5.16.
- **Partie 2** (`b/stock-historique`, partie de `b/stock`, commit `396faea`, poussé) : canal
  `stock:historiqueProduit`, service `stock/historique.ts`, `LIBELLES_MOUVEMENT` dans
  `src/shared/stock.ts`, fenêtre `FenetreHistorique.tsx` (bouton « Historique » sur chaque ligne).
- 259 tests verts (22 nouveaux dans `tests/stock.test.ts`), typecheck OK ; **les deux parties testées à
  la main par Dev B**. Aucune migration.
- Constat hors tâche : dans la base de développement de ce poste, le code d'Afi n'est plus `0000`
  (changé pendant les essais de B1 le 23/09). Pas un bug ; se règle par « Réinitialiser le code » (Patron).

**En cours** : deux PR à ouvrir sur GitHub (`gh` absent de ce poste), texte fourni à Dev B :
1. PR 1 `b/stock` → `test` : https://github.com/ryckos/pos-boutique/compare/test...b/stock?expand=1
2. PR 2 `b/stock-historique` → `test`, **seulement après la fusion de la PR 1** (elle contient le
   commit de la PR 1) : https://github.com/ryckos/pos-boutique/compare/test...b/stock-historique?expand=1

**Prochaine étape** :
1. Après fusion de la PR 1 : `git switch b/stock-historique && git fetch && git rebase origin/test`
   (si fusion en squash, le commit `ab413b4` doit tomber de lui-même ; sinon `git rebase --onto
   origin/test ab413b4`), `git push --force-with-lease`, puis ouvrir la PR 2.
2. Après fusion des deux : B4 → ✅ dans `ETAT_AVANCEMENT.md` + lignes au journal des fusions ;
   supprimer `b/stock` et `b/stock-historique` (local et GitHub).
3. Phase 2 : **B7 Fournisseurs** (`/tache B7`, branche `b/fournisseurs` depuis `test` à jour), puis
   **B8 Commandes et réceptions** (CUMP : 3 cartons à 6 000 → 250 ; puis 46 à 250 + 48 à 275 →
   262,8). En B8, compléter l'historique si le `document_type` des réceptions n'est pas `reception`
   (l'historique lit `receptions.numero` pour `reception`, `inventaires.numero` pour `inventaire`).

**Questions ouvertes** :
- Colonne « Suivi péremption » dans l'import Excel : toujours non confirmée par Dev B.
- Plafond de remise caissier (D-A3) : en attente de la cliente.
- Réactivation (produit, compte, catégorie) : non prévue. Photo des produits : reportée.

**Contrats** :
- Ajoutés (gérant, sans impact pour la caisse) : `stock:etat` → `EtatStock` ;
  `stock:historiqueProduit` `{ produitId, du?, au? }` → `HistoriqueProduit`.
- **Retiré** : `catalogue:produitsStock` et le type `ProduitStock` (utilisés seulement par l'ancien
  aperçu de Dev B). `ArticleCatalogue` et les canaux de la caisse inchangés.
- Pour Dev A : l'historique affiche « Ticket <numero_ticket> » pour `document_type = 'vente'` ; une
  annulation (A6) faite par `contrePasser()` s'affichera « Annulation » avec le même ticket et son
  motif. `LIBELLES_MOUVEMENT` (`src/shared/stock.ts`) est utilisable pour ses écrans.
- Prochain rendez-vous à livrer : `allouerFefo()` (fin S10). Attendus inchangés :
  `sessionOuverte()` / `enregistrerMouvementCaisse()` (Dev A, fin S10).

---

## 2026-09-25 (fin) — b/stock-initial — B3 fusionnée, B6 Stock initial
**Fait** :
- **B3 fusionnée** (PR #20) et passée à ✅ (commit `4dd5f42` sur cette branche) ; `b/import-excel`
  supprimée (local et GitHub).
- **Règles validées par Dev B**, écrites dans `REGLES_METIER.md` § 9.1 : comptage produit par
  produit, par conditionnement, **enregistré aussitôt** (une transaction par produit, résiste aux
  coupures) ; une seule fois par produit et seulement **sans réception** (sinon « non concerné ») ;
  la quantité comptée est le stock réel ; coût par unité en francs entiers > 0, pré-rempli par
  `prix_achat_indicatif` (B3), **CUMP = coût saisi** ; alerte non bloquante si coût ≥ prix de
  l'unité ; péremption : date obligatoire, n° de lot facultatif, un lot créé ; correction par
  « Annuler » (contre-passation, motif obligatoire, journalisée).
- Précision d'implémentation (écrite au § 9.1) : si des ventes ont eu lieu avant le comptage, **deux
  mouvements** `ajustement_inventaire` / `stock_initial` : le comptage (+41, porté par le lot s'il y
  en a un) puis la remise à zéro de l'antérieur (+3). Stock final identique, historique lisible.
- Module `src/main/modules/stock/` (`stock-initial.ts`, `ipc.ts`), contrat `src/shared/ipc/stock.ts`,
  écran `modules/stock/PageStockInitial.tsx` + logique pure `saisieStockInitial.ts`, menu « Stock
  initial » (gérant), `UI_UX.md` § 5.15. Aucune migration.
- 238 tests verts (13 nouveaux), build OK, **scénario complet testé à la main par Dev B**.
- Commit `b441cab` poussé sur `origin/b/stock-initial`.

**En cours** : PR B6 `b/stock-initial` → `test` à ouvrir sur GitHub (`gh` absent de ce poste) :
https://github.com/ryckos/pos-boutique/compare/test...b/stock-initial?expand=1 — le texte (modèle de
PR rempli) a été fourni à Dev B. Puis relecture par Dev A.

**Prochaine étape** :
1. Après fusion de la PR B6 : B6 → ✅ et rendez-vous « Stock initial de démarrage » → ✅ dans
   `ETAT_AVANCEMENT.md`, ligne au journal des fusions ; supprimer `b/stock-initial`.
2. **B4 Écran stock et historique produit** (`/tache B4`, branche `b/stock` depuis `test` à jour) :
   liste stock / valeur / alertes (rupture ≤ 0, stock bas ≤ seuil, `v_alertes_stock`), historique
   d'un produit (chaque mouvement : type, quantité, document, utilisateur, date — « pourquoi il reste
   41 boîtes »), répartition indicative par conditionnement (« 46 = 1 carton + 7 lots + 1 unité »),
   produits dormants (`dormantJours` des paramètres). Remplace l'aperçu actuel `/stock`
   (`catalogue/PageCatalogue.tsx`). À ranger dans le module `stock/` créé en B6 (contrat
   `src/shared/ipc/stock.ts`). Libellés lisibles pour les motifs `stock_initial` et `demo`.
3. Puis Phase 2 : B7 Fournisseurs, B8 Réceptions (CUMP).

**Questions ouvertes** :
- Colonne « Suivi péremption » dans l'import Excel : toujours non confirmée par Dev B.
- Plafond de remise caissier (D-A3) : en attente de la cliente.
- Réactivation (produit, compte, catégorie) : non prévue. Photo des produits : reportée.

**Contrats** :
- **Pour Dev A — rendez-vous fin S7 tenu dès la fusion de B6** : le stock initial est saisissable
  pour la recette de Phase 1 (partir de produits importés par Excel : les produits de démo, déjà
  « réceptionnés », ne sont pas concernés).
- Ajoutés (gérant, sans impact pour la caisse) : `stock:stockInitial`, `stock:ficheStockInitial`,
  `stock:enregistrerStockInitial`, `stock:annulerStockInitial`. Nouveau module `stock` enregistré
  dans `src/main/ipc/index.ts`, contrat dans `src/shared/ipc/index.ts`, menu dans `app/routes.tsx`.
- Rappel B3 (fusionnée) : **Dev A doit lancer `npm install`** (dépendance `xlsx` depuis
  `cdn.sheetjs.com`).
- Attendus inchangés : `sessionOuverte()` / `enregistrerMouvementCaisse()` (Dev A, fin S10).

---

## 2026-09-25 (suite) — b/import-excel — B3 Import Excel du catalogue
**Fait** :
- **B5 fusionnée** (PR #19) et passée à ✅. Branches fusionnées supprimées (local et GitHub) :
  `b/recherche-scan`, `b/parametres`, `b/parametres-ecran`. Le commit du carnet resté seul sur
  `b/parametres-ecran` a été repris sur `b/import-excel`.
- **Dépendance `xlsx` accordée par Dev B**, installée en **0.20.3 depuis `cdn.sheetjs.com`**
  (décision **D-18** : la 0.18.5 de npm a deux failles connues sur la lecture de fichiers). Intégrée
  au code compilé du principal (`electron.vite.config.ts`, `externalizeDepsPlugin({ exclude: ['xlsx'] })`).
- **Règles validées par Dev B** (écrites dans `REGLES_METIER.md` § 2.6) : import en deux temps
  (vérifier sans rien écrire, puis tout ou rien) ; code déjà au catalogue = ligne ignorée ; une ligne
  en erreur bloque tout ; rayon ou « Rayon / Sous-rayon » inconnu créé ; ligne sans code-barres =
  produit sans code (pas de code interne généré) ; prix d'achat gardé **à titre indicatif**.
- Migration `20260925_1100_prix_achat_indicatif.sql` : `produits.prix_achat_indicatif` (FCFA par
  unité, facultatif), **jamais lu par le CUMP** ; il servira à pré-remplir le coût en B6.
- Service `catalogue/import.ts` (lecture, analyse, import, modèle), 3 canaux gérant, fenêtre
  `FenetreImport.tsx` + bouton « Importer depuis Excel » sur la page Produits (`UI_UX.md` § 5.14),
  pastille commune `.pastille-erreur`. 225 tests verts (13 nouveaux), build OK, **scénario complet
  testé à la main par Dev B** (fichier avec erreurs, corrigé, réimport, vente en caisse).
- Commit `633b641` poussé sur `origin/b/import-excel`. **`gh` n'est pas installé sur ce poste** :
  la PR s'ouvre depuis GitHub.

**En cours** : PR B3 `b/import-excel` → `test` à ouvrir sur GitHub
(https://github.com/ryckos/pos-boutique/compare/test...b/import-excel?expand=1), texte prêt
(celui de la session : sections du modèle, zones partagées listées), puis relecture par Dev A.

**Prochaine étape** :
1. Après fusion de la PR B3 : B3 → ✅ dans `ETAT_AVANCEMENT.md` + ligne au journal des fusions
   (« 2026-09-2x · B3 · Import Excel du catalogue, prix d'achat indicatif, xlsx 0.20.3 (PR #…) ») ;
   supprimer `b/import-excel` (local et GitHub).
2. **B6 Stock initial** en priorité (rendez-vous **fin S7** pour la recette de Dev A) :
   `/tache B6`, branche `b/stock-initial` depuis `test` à jour. Mouvements `ajustement_inventaire`
   via `core/mouvements.ts`, document `stock_initial`, le coût saisi initialise le CUMP ; **pré-remplir
   le coût avec `produits.prix_achat_indicatif`** quand il existe. Relire `REGLES_METIER.md` § 3 et
   `SCENARIO_REFERENCE.md` (dimanche soir) avant le plan.
3. Puis **B4 Écran stock et historique produit**.

**Questions ouvertes** :
- Colonne « Suivi péremption » (Oui/Non) dans l'import : proposée, pas confirmée par Dev B. Pour
  l'instant tout produit importé est créé **sans** suivi de péremption (à cocher ensuite dans la fiche).
- Plafond de remise caissier (D-A3) : toujours en attente de la cliente.
- Réactivation (produit, compte, catégorie) : non prévue. Photo des produits : reportée.

**Contrats** :
- **Pour Dev A — action requise après la fusion de B3 : `npm install`** (nouvelle dépendance `xlsx`
  depuis `cdn.sheetjs.com` ; poste et CI doivent pouvoir joindre ce site).
- Ajoutés (gérant, sans impact pour la caisse) : `catalogue:telechargerModeleImport`,
  `catalogue:verifierImport`, `catalogue:importerCatalogue`, type `RapportImport`.
  `ArticleCatalogue` inchangé.
- Zones partagées touchées : `package.json`, `electron.vite.config.ts`, `ui/styles.css`
  (`.pastille-erreur` utilisable par tous), nouvelle migration.
- Pour la recette de Dev A : les produits peuvent maintenant être chargés en masse par Excel ; le
  stock initial (B6, fin S7) reste à livrer.
- Attendus inchangés : `sessionOuverte()` / `enregistrerMouvementCaisse()` (Dev A, fin S10).

---
