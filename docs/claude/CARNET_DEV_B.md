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

## 2026-11-01 — b/revue-a12, b/kiosque — relectures, répétition de l'essai de restauration, B-P5 codée
**Fait** :
- **PR #86** (procédure d'essai de restauration) et **PR #89** (`b/revue-a12` : PR #86 au journal des
  fusions) fusionnées. Ménage avec l'accord de Dev B : 8 branches `b/…` fusionnées supprimées (local et
  GitHub).
- **Relecture après coup des migrations de Dev A** (fusionnées sans relecture de Dev B) :
  `20261101_1400_recouvrement.sql` (A12) et `20261102_0900_promotions.sql` (A16) : **conformes** (noms,
  aucun historique modifié, pas de `PRAGMA`, triggers « ni modification ni suppression », plafonds,
  `MODELE_DONNEES` à jour). À savoir : le statut d'une créance est désormais **calculé** dans
  `v_creances_clients` ; la colonne `creances.statut` n'est plus lue. Libellés ajoutés par Dev A dans
  `src/shared/audit.ts` : corrects.
- **B16 — répétition à blanc** de `ESSAI_RESTAURATION.md` sur le PC de Dev B (rc.1 installée) : essais 1
  à 4 et remise en état **conformes**, restauration entre 30 s et 2 min, script de lancement OK. Notée
  dans `ETAT_AVANCEMENT.md`. B16 reste 🔄 (essai sur le terminal, puis D-A4).
- **B-P5** (choix validés par Dev B), branche `b/kiosque`, commit `862e3bc`, alignée sur `test` (#94) :
  - paramètre `demarrage_automatique` (§ 13, défaut oui, admin, journalisé ; Paramètres › « Ce poste ») ;
    règle pure `reglageDemarrage` (`src/shared/demarrage.ts`) et appel Windows
    `appliquerDemarrageAutomatique` (`src/main/demarrage.ts`), au lancement et à chaque changement ;
    jamais en développement ni sur une base d'essai (`POS_DB`) ;
  - application installée **en plein écran** sans barre de titre (`creerFenetrePrincipale({ pleinEcran })`),
    **une seule instance** (`requestSingleInstanceLock`, second lancement = `ramenerFenetrePrincipale`),
    sauf en développement et sur `POS_DB` ;
  - canal `auth:quitter` (gérant, admin) → `fermerApplication` journalise `fermeture_application` ;
    bouton « Quitter l'application » (icône `eteindre`) en bas du menu, avec confirmation ;
  - icône `build/icon.ico` (`scripts/generer_icone.py`, Pillow), `author` = « Projet Boutique » ;
  - **risque traité** : après une coupure de courant pendant l'essai de restauration, la vraie caisse
    s'ouvre seule avec Windows ; le verrou d'instance aurait renvoyé le script d'essai sur elle. D'où
    l'exception `POS_DB` et les étapes 3.15 / 3.19 de la fiche (fermer d'abord la caisse ouverte seule) ;
  - docs : `REGLES_METIER` § 1.4 et 13, `UI_UX` § 5.13, `DEPLOIEMENT` § 3.1, 5.6 (réécrit : le raccourci
    `shell:startup` de la rc.1 est à effacer après la mise à jour), 6, 7.3 ; guides gérant (§ 18) et
    admin ; `.docx` régénérés ;
  - 6 tests (`tests/demarrage.test.ts`) + 2 attentes dans `saisie-parametres`, `parametres` ;
    `npm run verifier` : **916 tests verts**, typecheck et build OK. Aucune migration.
  - **Pas encore testée à la main** par Dev B (scénario donné dans la session : base jetable avec
    `POS_DB` + `POS_SIMULER_PROD=1`).

**En cours** : PR `b/kiosque` → `test` à ouvrir (texte fourni à Dev B ; `gh` absent) :
https://github.com/ryckos/pos-boutique/compare/test...b/kiosque?expand=1

**Prochaine étape** :
1. Dev B teste en développement (plein écran, « Ce poste » Oui/Non journalisé, bouton Quitter absent pour
   la caissière, présent et journalisé pour le gérant).
2. Proposé, **non encore validé** : passer la version en **1.0.0-rc.2**, `npm run dist`, installer sur le
   PC de Dev B : icône, double-clic = même fenêtre, ouverture seule après redémarrage, « Non » → plus
   d'ouverture seule. Puis livrer la rc.2 chez la cliente (`DEPLOIEMENT` § 6) et effacer le raccourci
   `shell:startup`.
3. Après la fusion : B-P5 reste 🔄 (signature plus tard, import du vrai catalogue, recette avec Dev A) ;
   ligne au journal des fusions ; supprimer `b/kiosque`.
4. Jouer l'essai de restauration sur le terminal (B16), avec la fiche à jour.

**Questions ouvertes** :
- D-A1, D-A3, D-A4 (bloque la fin de B16), D-A5, D-A6 : toujours en attente.
- Rappeler à Dev A que ses migrations doivent être relues par Dev B **avant** la fusion (trois fois
  sans relecture : #79, #87, #93).
- À faire confirmer par Dev A : « un téléphone ne sert pas à deux clients actifs ».

**Contrats** :
- Ajoutés (sans impact pour la caisse) : `auth:quitter` ; champ `ParametresBoutique.demarrageAutomatique`
  (ajout seul).
- **Pour Dev A** : `src/main/fenetres.ts` (son fichier, partie kiosque attribuée à Dev B) :
  `creerFenetrePrincipale` prend désormais `{ pleinEcran: boolean }`, nouvelle fonction
  `ramenerFenetrePrincipale()` ; `src/main/index.ts` : verrou d'instance unique et démarrage automatique ;
  `Layout.tsx` : bouton « Quitter l'application » ; nouvelle icône `eteindre` dans `ui/Icone.tsx`.
- Attendus de Dev A : rien.

## 2026-10-31 (suite) — b/essai-restauration — B16 : procédure d'essai de restauration sur le terminal
**Fait** :
- **PR #83 fusionnée** (`b/libelles-clients`, libellés du journal des clients, du crédit et de 6 actions
  de la caisse) : rendez-vous « Libellés du journal des clients » → ✅ et ligne au journal des fusions de
  `ETAT_AVANCEMENT.md`. L'entrée de carnet du 31/10 (commit `ddb8222`, poussée **après** la fusion) n'était
  pas arrivée dans `test` : reprise ici par `cherry-pick`.
- **B16 — essai de restauration** (choix de Dev B : B16 avant B-P5). Branche `b/essai-restauration` depuis
  `test` à jour, commit `c7a8f33`, poussée :
  - `docs/fiches-test/ESSAI_RESTAURATION.md` (+ `.docx`) : fiche pour le technicien et la patronne, sur le
    terminal OMA POS, hors heures d'ouverture (~1 h 30). **Validé avec Dev B : l'essai se joue sur une
    copie de la vraie base, jamais sur elle** (la cliente travaille déjà sur sa vraie base avec la rc.1).
    Préparation : empreinte `Get-FileHash` de la vraie base, copie de la dernière sauvegarde en
    `C:\EssaiRestauration\boutique.db`, 5 repères (valeur du stock, total dû, dépenses du mois, nombre de
    produits, dernière ligne du journal). 9 essais : sauvegarde manuelle ; dépense repère « ESSAI
    RESTAURATION » 100 F ; restauration depuis la liste ; retour arrière depuis la clé avec la sauvegarde
    « Avant une restauration » ; refus d'un faux fichier ; restauration à la main (`DEPLOIEMENT` § 7.3) ;
    **coupure de courant** pendant une sauvegarde puis pendant une restauration (accord de Dev B) ; reprise
    sur un autre PC (facultatif). Remise en état : même empreinte, dossiers d'essai supprimés ;
  - piège traité : la copie garde le dossier de la clé USB de la boutique → **clé débranchée avant le premier
    lancement**, puis dossier `E:\EssaiRestauration` choisi sur la clé (sinon la rotation abîmerait les
    vraies sauvegardes de la clé) ;
  - `scripts/lancer-essai-restauration.cmd` : lance l'application installée avec
    `POS_DB=C:\EssaiRestauration\boutique.db` (refus si la copie manque : testé ; recherche de l'exe dans
    `%LOCALAPPDATA%\Programs` **non testée**, l'application n'est pas installée sur ce poste).
    `.gitattributes` : `*.cmd text eol=crlf` ;
  - renvois : `DEPLOIEMENT.md` § 8.2, `SCENARIOS_TEST.md` PAT-07, fiche administrateur 6.4. `.docx`
    régénérés par `scripts/md_vers_docx.py <md> <docx> "<titre>"` (le titre est obligatoire) ;
  - `npm run verifier` : **761 tests verts**, typecheck OK. Aucun code de l'application, aucune migration.

**En cours** : PR `b/essai-restauration` → `test` à ouvrir par Dev B (texte fourni dans la session) :
https://github.com/ryckos/pos-boutique/compare/test...b/essai-restauration?expand=1
Ce carnet et celui du 31/10 sont commités sur cette branche. **B16 reste 🔄** : l'essai n'est pas joué.

**Prochaine étape** :
1. Répétition à blanc de la fiche sur le PC de Dev B (rc.1 installée, une sauvegarde de démo) : au moins
   les essais 1 à 4 et la remise en état ; corriger fiche et script si un texte ne correspond pas à l'écran.
2. Jouer l'essai sur le terminal avec la patronne, fiche imprimée. Tout OK → B16 ✅ (hors envoi distant,
   D-A4) dans `ETAT_AVANCEMENT.md`, avec la date et la durée d'une restauration (partie 5 de la fiche).
   Un « Non » → remise en état, puis branche `b/…` de correction.
3. Après la fusion : supprimer `b/essai-restauration`, `b/libelles-clients`, `b/alertes-accueil`,
   `b/docs-b14-fusion` (local et GitHub ; demander l'accord de Dev B).
4. Ensuite **B-P5** : démarrage automatique (`shell:startup` ou option de l'installateur), mode kiosque,
   icône, champ `author` de `package.json` ; suivre les retours de la cliente sur la 1.0.0-rc.1.

**Questions ouvertes** :
- D-A1, D-A3, D-A4 (bloque la fin de B16), D-A5, D-A6 : toujours en attente.
- À faire confirmer par Dev A : « un téléphone ne sert pas à deux clients actifs ».
- Libellés du journal (PR #83) pas encore testés à la main par Dev B (scénario dans l'entrée précédente).

**Contrats** : aucun livré, attendu ni modifié. **Pour Dev A** : `.gitattributes` (zone partagée) gagne
`*.cmd text eol=crlf`. Sa prochaine migration (avoir en boutique, A11 partie 5) doit être relue par Dev B
avant la fusion.

---

## 2026-10-31 — b/libelles-clients — libellés du journal pour A11, alertes fusionnées
**Fait** :
- **PR #78 fusionnée** (`stock:alertesAccueil`, pour A15) : rendez-vous « Alertes rupture et péremption »
  → ✅ dans `ETAT_AVANCEMENT.md`, ligne au journal des fusions. Branches locales `b/alertes-accueil` et
  `b/docs-b14-fusion` supprimées (**sur GitHub : encore à supprimer**).
- **Relecture de la migration de Dev A** `20261031_1000_clients_credit.sql` (PR #79, fusionnée sans
  relecture de Dev B) : conforme (nom, aucune modification d'historique, pas de `PRAGMA`, vue
  `v_creances_clients` lue par le seul module clients, `MODELE_DONNEES.md` à jour). Rien à corriger.
- **Libellés du journal** (demande de Dev A, rendez-vous ⏳ → 🔄), branche `b/libelles-clients`, commit
  `ff2f76d`, **rebasée sur `test` après les PR #81 et #82 de Dev A, poussée** :
  - `src/shared/audit.ts` : `creation_client`, `modification_client`, `plafond_credit`,
    `desactivation_client`, `vente_credit`, plus 6 actions de la caisse qui s'affichaient en code brut
    (`mouvement_caisse`, `annulation_mouvement_caisse`, `retour_client`, `facture`, `edition_facture`,
    `proforma`) ; champs `client`, `telephone`, `adresse`, `nif`, `plafond` (F), `echeance` (date),
    `session`, `sens`, `typeDocument`, `document`, `contreMouvement`, `numeroRetour`, `ticketOrigine`,
    `mode`, `sort`, `sortie`, `copie` ; le `motif` est traduit seulement s'il est un code de mouvement du
    tiroir (`LIBELLES_MOTIF_CAISSE`), sinon laissé tel quel ;
  - `tests/audit.test.ts` : le test des libellés **relit toutes les actions `action: '…'` de
    `src/main`** (plus de liste fixe : c'est elle qui avait laissé passer les oublis) ; 2 tests de
    valeurs (plafond, échéance ; mouvement du tiroir et motif libre) ;
  - `REGLES_METIER.md` § 1.4 : 9 actions ajoutées au tableau, et la règle du test.
  - `npm run verifier` : **761 tests verts**, typecheck OK. Aucune migration.
- **Pas testé à la main** par Dev B (l'écran Clients n'était pas encore dans `test` au début de la
  session ; il l'est depuis la PR #81).

**En cours** : PR `b/libelles-clients` → `test` à ouvrir (`gh` absent ; texte fourni à Dev B dans la
session) : https://github.com/ryckos/pos-boutique/compare/test...b/libelles-clients?expand=1
Ce carnet est commité sur cette branche. Case « Testé à la main » décochée dans la PR.

**Prochaine étape** :
1. **Tester à la main** avant ou pendant la relecture : Kossi (`5678`) → menu « Clients » : créer un
   client, changer son téléphone, plafond 20 000 F ; à la caisse, une vente à crédit à ce client ; une
   dépense « caisse » puis son annulation. Patron (`1234`) → « Journal des opérations » : tout en
   français (« Changement du plafond de crédit » 0 F → 20 000 F, « Vente à crédit » avec l'échéance en
   JJ/MM/AAAA, « Sortie du tiroir », « Dépense »), aucun mot avec un tiret bas. Base jetable :
   `$env:POS_DB="$env:TEMP\journal.db"; npm run dev`.
2. Après la fusion : rendez-vous « Libellés du journal des clients » → ✅ (avec le n° de PR) et une ligne
   au journal des fusions de `ETAT_AVANCEMENT.md` (dans la prochaine branche) ; supprimer
   `b/libelles-clients`, `b/alertes-accueil`, `b/docs-b14-fusion` (local et GitHub).
3. Choisir avec Dev B la suite : **B16** (procédure pas à pas d'essai de restauration sur le terminal
   OMA POS, puis B16 → ✅ hors envoi distant, D-A4) ou **B-P5** (démarrage automatique, kiosque, icône,
   `author` de `package.json`) ; suivre les retours de la cliente sur la 1.0.0-rc.1.

**Questions ouvertes** :
- D-A1, D-A3, D-A4 (bloque la fin de B16), D-A5, D-A6 : toujours en attente.
- Règle de Dev A « un téléphone ne sert pas à deux clients actifs » : ajoutée par sa Claude, à faire
  confirmer par Dev A (relevé dans son carnet).
- La PR #79 a été fusionnée sans relecture de Dev B : rappeler à Dev A qu'une migration doit être relue
  par Dev B avant fusion (brief § 9).

**Contrats** :
- **Livré à Dev A (PR à ouvrir)** : libellés du journal des clients et du crédit. **Pour Dev A** : le test
  `tests/audit.test.ts` échoue désormais si une action passée à `journaliser()` n'a pas de libellé dans
  `LIBELLES_ACTION` ; ajouter aussi les champs nouveaux dans `LIBELLES_CHAMP`. `audit.ts` importe en
  lecture `LIBELLES_MOTIF_CAISSE` (`src/shared/caisse.ts`) et `LIBELLES_SORT_RETOUR`
  (`src/shared/retour.ts`), fichiers de Dev A non modifiés.
- Livré et fusionné : `stock:alertesAccueil` (PR #78). Modifiés : aucun. Attendus de Dev A : rien.

---

## 2026-10-30 / 31 — b/docs-b14-fusion, b/alertes-accueil — B14 close, contrat des alertes pour A15
**Fait** :
- **PR #76 fusionnée** (marge de B14) puis **PR #77** (`b/docs-b14-fusion`) : B14 → ✅ et UX1 → ✅
  (PR #71) dans `ETAT_AVANCEMENT.md`, ligne B14 partie 4 au journal des fusions. Branches
  `b/depenses-caisse` et `b/rapports-marge` supprimées (local et GitHub).
- **Contrat des alertes pour A15** (rendez-vous Dev A, fin S17), branche `b/alertes-accueil`, commit
  `65b3817`, poussée :
  - canal `stock:alertesAccueil` (gérant) → `AlertesAccueil` dans `src/shared/ipc/stock.ts` :
    `stock { nbRuptures, nbStockBas, produits }` et `peremptions { horizonJours, nbPerimes, nbUrgents,
    nbProches, valeurEnJeu, lots }` ; `NB_ALERTES_ACCUEIL = 5` exportée ;
  - service `src/main/modules/stock/alertes.ts` : lit `v_alertes_stock` et réutilise
    `tableauPeremptions()` (mêmes chiffres que les pages Stock et Péremptions ; ni répartition ni
    dormants, pour rester léger) ;
  - règles décidées par Claude **sur délégation explicite de Dev B**, écrites dans `REGLES_METIER.md`
    § 3.3 : gérant seul ; compteurs + 5 premiers de chaque sorte (ruptures d'abord puis stock le plus
    bas ; lots du plus proche au plus lointain, périmés d'abord) ; règle § 3.3 inchangée (un produit
    jamais approvisionné, à stock 0, est une rupture, comme sur la page Stock) ; urgents = 0 à 3 j
    (périmés comptés à part), proches = au-delà de 3 j dans l'horizon ;
  - 5 tests (`tests/alertes-accueil.test.ts`), **723 tests verts**, typecheck OK ; **testé à la main par
    Dev B** depuis la console (`await window.pos.invoke('stock:alertesAccueil')`). Aucune migration.

**En cours** : PR `b/alertes-accueil` → `test` à ouvrir (`gh` absent ; texte fourni à Dev B dans la
session) : https://github.com/ryckos/pos-boutique/compare/test...b/alertes-accueil?expand=1
Ce carnet est commité sur cette branche. Le rendez-vous « Alertes » est 🔄 dans `ETAT_AVANCEMENT.md`.

**Prochaine étape** :
1. Après la fusion : rendez-vous « Alertes rupture et péremption » → ✅ (avec le n° de PR) et une ligne
   au journal des fusions de `ETAT_AVANCEMENT.md` (à mettre dans la prochaine branche) ; supprimer
   `b/docs-b14-fusion` et `b/alertes-accueil` (local et GitHub).
2. Choisir avec Dev B la suite :
   - **B16** : préparer une procédure pas à pas d'essai de restauration sur le terminal OMA POS (copie de
     la base, restauration depuis la liste et depuis la clé, vérification des chiffres, retour arrière),
     la faire jouer, puis B16 → ✅ hors envoi distant (D-A4) ;
   - **B-P5** : démarrage automatique (raccourci `shell:startup` ou option de l'installateur), mode
     kiosque, icône de l'application, champ `author` de `package.json` ;
   - suivre les retours de la cliente sur la 1.0.0-rc.1 (`docs/fiches-test/`) ; une correction = branche
     `b/…`, puis rc.2 selon `DEPLOIEMENT.md` § 6.

**Questions ouvertes** :
- D-A1, D-A3, D-A4 (bloque la fin de B16), D-A5, D-A6 (marge TTC ou HT) : toujours en attente.
- Après l'import du vrai catalogue, l'accueil peut afficher beaucoup de ruptures (produits sans stock
  initial) : la règle est gardée ; à revoir seulement si la cliente s'en plaint.
- Journal des fusions : #72 (douchette) et #73 (A14 partie 1) de Dev A n'y figurent pas ; à lui de les
  ajouter.

**Contrats** :
- **Livré à Dev A (en relecture)** : `stock:alertesAccueil` pour l'accueil A15 — `session` gérant
  exigée ; appeler depuis l'écran par `appel('stock:alertesAccueil')` ; afficher les compteurs et les
  5 éléments, avec des liens vers `/stock` et la page Péremptions pour le reste. Ajout seul : aucun
  contrat consommé par la caisse ne change.
- Modifiés : aucun. Attendus de Dev A : rien.

---

## 2026-10-28 / 29 — b/depenses-caisse, b/rapports-marge — B13 terminée, marge de B14
**Fait** :
- **UX1 / 1.0.0-rc.1 fusionnée** (PR #71) : `test` est la base commune ; la cliente teste la rc.1.
- **B13 — dépense payée au tiroir : ✅** (PR #74 code, #75 état). Règles validées par Dev B le 28/10,
  `REGLES_METIER.md` § 10.2 :
  - la caissière paie seulement sur **sa** caisse ouverte, jamais en « fonds propres » ; page restreinte
    « Dépenses de ma caisse » (sans période, catégories ni annulation ; vide après sa clôture) ;
  - le gérant paie sur la caisse choisie, sinon la sienne, sinon la seule ouverte ; plusieurs → choisir ;
  - dépense datée du jour + mouvement de caisse `sortie` motif `depense` (`enregistrerMouvementCaisse`
    de Dev A) **dans la même transaction**, plafonné aux espèces du tiroir (sinon rien n'est écrit, pas
    de numéro DEP consommé) ; X / Z : « Dépense (libellé) » ;
  - annulation par le gérant, contre-mouvement, refusée après la clôture.
  - Test AFI-15 (`SCENARIOS_TEST.md`) **joué à la main par Dev B** : OK.
- **B14 — marge du résultat** (branche `b/rapports-marge`, commit `966083e`, poussée, rebasée sur
  `test` après #75) : `rapports-gestion/resultat.ts` appelle `ventesPeriode(db, { du, au })` de Dev A
  (A14, PR #73) → marge = chiffre d'affaires TTC − coût (retours déduits), résultat = marge − dépenses ;
  onglet « Résultat » et export détaillés (CA, coût, marge, dépenses, résultat, pertes pour info).
  Tests : vente 8 200 + retour 350 + dépense 1 000 → CA **7 850**, coût **6 250**, marge **1 600**,
  résultat **600** ; sans vente → résultat −16 000. **Testé à la main par Dev B** : OK.
  Docs : `REGLES_METIER` § 11.1, `UI_UX` § 5.20, `SCENARIOS_TEST` KOS-18 (+ `.docx` régénéré), nouvelle
  décision en attente **D-A6** (marge TTC ou HT).
- 718 tests verts, typecheck OK. Aucune migration.

**En cours** : PR `b/rapports-marge` → `test` à ouvrir (texte fourni à Dev B dans la session ; `gh`
absent de ce poste) : https://github.com/ryckos/pos-boutique/compare/test...b/rapports-marge?expand=1
Ce carnet est commité sur cette branche. B14 reste 🔄 jusqu'à la fusion.

**Prochaine étape** :
1. Après la fusion de `b/rapports-marge` : B14 → ✅ dans `ETAT_AVANCEMENT.md` et une ligne au journal
   des fusions (petite PR `b/docs-b14-fusion`, ou dans la prochaine branche). Supprimer
   `b/depenses-caisse` et `b/rapports-marge` (local et GitHub).
2. Choisir avec Dev B la suite (question posée en fin de session, sans réponse) :
   - **Lecture des alertes rupture et péremption pour A15** (rendez-vous Dev A, fin S17) : déclarer tôt
     le contrat (ex. `stock:alertesAccueil` → nombre de ruptures, stocks bas, lots à ≤ 3 j / sous le seuil,
     valeur en jeu), à partir de `v_alertes_stock` et de `stock/peremptions.ts` ; annoncer à Dev A ;
   - **B16** : essai de restauration sur le terminal OMA POS (préparer une procédure pas à pas), puis
     B16 → ✅ hors envoi distant (D-A4) ;
   - **B-P5** : démarrage automatique, mode kiosque, icône, `author` dans `package.json`.
3. Suivre les retours de la cliente sur la 1.0.0-rc.1 (`docs/fiches-test/`) ; une correction = branche
   `b/…`, puis rc.2 selon `DEPLOIEMENT.md` § 6.

**Questions ouvertes** :
- **D-A6** (nouvelle) : marge TTC ou HT dans les rapports ? Pour la cliente. `margeHt` est déjà calculée
  par `ventesPeriode`, prête à être affichée.
- D-A1, D-A3, D-A4 (bloque la fin de B16), D-A5 : toujours en attente.
- Retours de la cliente sur les fiches de test et les guides.

**Contrats** :
- Modifiés (ajouts seuls, sans impact pour la caisse) : `SaisieDepense.sessionId`, `Depense.sessionId`,
  `caissier`, `sessionCloturee` (B13) ; `RapportResultat.chiffreAffaires`, `cout` (B14).
  `depenses:enregistrer` est ouvert à la caissière pour la source « caisse ».
- **Reçus de Dev A** : `enregistrerMouvementCaisse` (A8) utilisé par B13 ; `ventesPeriode` (A14,
  **livré en avance**) utilisé par B14, en lecture, sans modification de ses fichiers.
- **Pour Dev A** : le résultat de B14 suit `ventesPeriode` ; si sa règle change, rien à toucher chez
  Dev B. Dans `SCENARIOS_TEST`, la ligne « non livré » d'A14 vise désormais l'écran des rapports de
  ventes (partie 2).
- À livrer : lecture des alertes rupture et péremption (A15, fin S17).

---

## 2026-10-19 → 26 — feature/sk/ergonomie — UX1 refonte ergonomique, déploiement, version 1.0.0-rc.1
**Fait** :
- **UX1 — refonte ergonomique** (décision D-19, `UI_UX.md` § 2, 4.1, 4.2, 5.12, 6), sur **tous** les écrans,
  y compris ceux de la caisse (accord de Dev A donné à Dev B) :
  - palette « bleu commerce » : `--vert*` renommés `--primaire*` (bleu), nouveaux jetons `--succes`,
    `--accent`, `--menu`, `--surface-douce`, `--bord-fort`, `--ombre` ;
  - icônes SVG maison `ui/Icone.tsx` (sans dépendance) ; `ui/BoutonIcone.tsx` (icône seule + infobulle au
    survol, au clavier et à l'**appui long** au doigt ; indisponible = `aria-disabled`) ; actions des lignes
    de tableau en icônes, sur une seule ligne ; actions principales et caisse en icône + texte ;
  - pagination de l'affichage (`lib/pagination.ts` testé, `ui/Pagination.tsx`) : 20 lignes, 10 dans les
    fenêtres ; exports et totaux toujours sur toute la liste ;
  - aide contextuelle « ? » (`ui/AideIcones.tsx`) à côté du titre de chaque page et dans les fenêtres à
    icônes (`FenetreFormulaire`, propriété `aide`) : légende des icônes de la page ;
  - menu à icônes, replié sous 1180 px ; `DefinitionRoute.icone` **obligatoire** ;
  - caisse : actions de la ligne choisie en deux rangées (quantité + supprimer ; conditionnement + remise),
    actions du ticket en grille de deux colonnes ; ligne du ticket libellé | prix.
- **Imprimante (D-A2 tranchée → D-20)** : configuration validée en Phase 0 = partage réseau `XPOS`
  (`copy /b` vers `\\localhost\XPOS`), page de codes **cp1252**. `PAGE_DE_CODES_PAR_DEFAUT` passe de
  `cp858` à `cp1252` dans `src/main/materiel/reglages.ts` (fichier de Dev A) et ses tests ; méthode et nom
  du partage se saisissent à l'installation (Réglages matériel).
- **Documents** : `docs/SCENARIOS_TEST.md` (+ `.docx`, 61 tests par utilisateur, semaine enchaînée,
  installation et mises à jour DEP-01 à 08, terminal) ; `docs/DEPLOIEMENT.md` (+ `.docx` : installation,
  mises à jour par migrations seulement, retour arrière, reprise après panne, fiches) ; fiches de test
  pour la cliente `docs/fiches-test/` et guides utilisateur `docs/guides/` (administratrice, gérant,
  caissière ; `.md` + `.docx`) ; `scripts/md_vers_docx.py` régénère un Word depuis un `.md`
  (`python-docx`).
- **Version 1.0.0-rc.1** : `package.json` `version` et `productName` **à la racine** (fixe le dossier de la
  base : `%APPDATA%\Ma Boutique POS`) ; installateur `dist\Ma Boutique POS Setup 1.0.0-rc.1.exe`
  (SHA-256 `1D89BE80AB80EE61D04281182DC567AF108B788C0D585345A4D776883F2705AD`), commit `332d3b9`, tag
  `v1.0.0-rc.1` poussé. Installé chez la cliente pour la phase de test, sur sa **vraie base**.
- 698 tests verts (4 nouveaux : pagination), typecheck et build OK. Aucune migration.
- Constats utiles :
  - `npm run dist` échouait sur ce poste (extraction de `winCodeSign` : liens symboliques interdits).
    Correctif sans droits admin : décompresser l'archive dans
    `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0`, ou activer le mode développeur
    de Windows ;
  - avec `productName` à la racine, `npm run dev` utilise désormais `%APPDATA%\Ma Boutique POS` : l'ancienne
    base de démo (`%APPDATA%\pos-boutique`) n'est plus lue (une démo neuve est créée) ;
  - sous Windows, un script Python qui réécrit un fichier doit garder les fins de ligne LF
    (`newline=''`), sinon tout le fichier passe en CRLF.

**En cours** : PR `feature/sk/ergonomie` → `test` à ouvrir et fusionner (le 2026-10-26, la poussée directe
sur `test` a été refusée par la règle GitHub qui impose une PR) :
https://github.com/ryckos/pos-boutique/compare/test...feature/sk/ergonomie?expand=1
Dev B veut la fusion rapide pour que chacun reprenne ses tâches sur une base commune ; Dev A relit au
moins ses écrans (liste dans « Contrats »). La cliente teste la 1.0.0-rc.1 avec `docs/fiches-test/`.
Sur le poste de Dev B, la branche `test` **locale** porte un commit de fusion non poussé : le jeter avec
`git switch test` puis `git reset --hard origin/test` avant tout `git pull`.

**Prochaine étape** :
1. **Faire fusionner la PR** ci-dessus (merge commit, pas de squash : le tag `v1.0.0-rc.1` pointe sur
   `332d3b9`, qui doit rester dans l'historique de `test`). Ensuite, chacun repart de `test` à jour.
   Puis **suivre le test de la cliente** (fiches remplies, `docs/fiches-test/`). Une correction = une branche
   `b/…` depuis `test`, puis version `1.0.0-rc.2`, `npm run dist`, tag, mise à jour chez la cliente selon
   `DEPLOIEMENT.md` § 6.3 (sa base est conservée ; une migration se répète d'abord sur une copie de sa
   dernière sauvegarde, § 6.2). Validation → `test` → `main`, version `1.0.0`, tag `v1.0.0`, installée en
   mise à jour.
2. **B13 — dépense payée au tiroir (débloquée)** : A8 est livré (PR #55,
   `src/main/modules/caisse/service-mouvements.ts` : `sessionOuverte(db, utilisateurId?)`,
   `enregistrerMouvementCaisse(db, { sessionId, utilisateurId, sens, motif, montant, commentaire,
   documentType?, documentId? })`, `annulerMouvementCaisse`). Branche `b/depenses-caisse` depuis `test` :
   dans `depenses/service.ts`, source `caisse` = session ouverte de l'utilisateur exigée, date du jour,
   `session_caisse_id`, mouvement `sortie` motif `depense`, `document_type = 'depense'`, **dans la même
   transaction** ; sortie plafonnée aux espèces du tiroir ; annulation = `annulerMouvementCaisse`, refusée
   si la session est clôturée. Ouvrir `depenses:enregistrer` à la caissière pour la source caisse ;
   retirer la limite `SOURCES_OUVERTES` de `saisieDepense.ts` ; décider avec Dev A où la caissière saisit
   (bouton dans la caisse ou menu restreint). Test de référence : taxi-moto 1 000 F → espèces théoriques
   **58 700** (`SCENARIO_REFERENCE.md`, vendredi soir). Puis B13 → ✅ et la ligne de `SCENARIOS_TEST.md`
   § 8 « Dépense payée au tiroir » devient un test.
3. **B16** : essai de restauration sur le terminal, puis B16 → ✅ (hors envoi distant, D-A4).
4. **B-P5** : démarrage automatique et mode kiosque (provisoire : raccourci dans `shell:startup`), icône
   de l'application et champ `author` de `package.json`, signature de l'installateur (plus tard).
5. **B14** : marge et résultat dès que `caisse:ventesPeriode` (A14) arrive.

**Questions ouvertes** :
- D-A1 (stock négatif), D-A3 (plafond de remise), D-A4 (sauvegarde distante), D-A5 : toujours en attente.
- PR de grande taille (65 fichiers) : Dev A doit relire au moins ce qui touche ses écrans (liste
  ci-dessous) et signaler tout souci.
- Retours de la cliente sur les fiches et les guides (textes, ordre des modules).

**Contrats** :
- **Pour Dev A (changements dans son périmètre ou ses habitudes)** :
  - `src/main/materiel/reglages.ts` : `PAGE_DE_CODES_PAR_DEFAUT = 'cp1252'` (D-20) ;
    `tests/caisse-ticket.test.ts` adapté ;
  - écrans de la caisse retouchés (icônes, disposition) : `PageCaisse.tsx` (actions de la ligne en deux
    rangées, actions du ticket en grille), `PageClotureCaisse.tsx` (aide « ? »), `FenetreTiroir.tsx`
    (annulation en icône), `FenetrePaiement`, `FenetreFacture`, `FenetreProforma`,
    `FenetreRepriseProforma`, `FenetreRetour`, `FenetreAnnulation`, `OuvertureCaisse`,
    `PageReglagesMateriel.tsx` ; **aucun service ni contrat de la caisse modifié** ;
  - `DefinitionRoute.icone` est **obligatoire** : toute nouvelle route (A14, A15, A11…) doit donner une
    icône de `ui/Icone.tsx` ;
  - jetons CSS renommés : `--vert`, `--vert-fonce`, `--vert-pale` n'existent plus → `--primaire*` pour
    l'action, `--succes*` pour le positif ;
  - réutilisables : `BoutonIcone`, `Pagination` / `usePagination`, `AideIcones`, `FenetreFormulaire`
    (propriété `aide`) ; règles dans `UI_UX.md` § 4.1, 4.2 et 5.12.
- Ajoutés : aucun canal. Attendus : `caisse:ventesPeriode` (A14, pour B14).

---

## 2026-10-12 — b/docs-b15-fusion, b/sauvegardes, b/sauvegardes-ecran — B16 Sauvegardes et restauration
**Fait** :
- **B14 et B15 fusionnées** (PR #47 à #51). Le carnet du 09/10 et la petite PR de documentation de
  B13 (`b/docs-b13-fusion`, jamais ouverte) étaient restés hors de `test` : repris sur
  `b/docs-b15-fusion` avec B15 → ✅, B14 🔄 (marge) et cinq lignes au journal des fusions.
  **Ménage** : 9 branches locales et 21 branches GitHub fusionnées supprimées.
- **Règles validées par Dev B**, écrites dans `REGLES_METIER.md` § 14 (et nouvelle clé
  `sauvegarde_dossier_externe` au § 13) :
  - moments : après chaque **clôture de caisse**, au démarrage **avant une migration**, au démarrage
    si la dernière a **plus de 24 h**, bouton « Sauvegarder maintenant », et avant une restauration ;
  - jamais bloquante ; une à la fois ; échec signalé à l'écran ; retard signalé au-delà de 2 jours ;
  - rotation : 30 dernières + la plus récente de chaque semaine sur 52 semaines ;
  - clé USB = dossier choisi une fois par l'admin, copie si présent ;
  - droits : gérant (consulter, sauvegarder), admin (clé, restaurer) ;
  - restauration : vérifiée, version plus récente refusée, base en place sauvegardée d'abord,
    redémarrage, `restauration_sauvegarde` journalisée **dans la base restaurée**.
- **PR 1 `b/sauvegardes`** (commit `10608f5`, poussée) : `src/main/modules/sauvegardes/`
  (`service.ts` : `backup()` de `node:sqlite` vers un fichier provisoire, copie repassée en un seul
  fichier, `quick_check`, renommage, rotation, clé ; `automatique.ts` : file d'attente,
  `sauvegarderEnFond`, sauvegarde du démarrage ; `ipc.ts`), contrat `src/shared/ipc/sauvegardes.ts`,
  `migrationsConnues` / `migrationsEnAttente` dans `db/migrations.ts`, `main/index.ts`.
  14 tests (`tests/sauvegardes.test.ts`). **Testée à la main par Dev B.**
- **PR 2 `b/sauvegardes-ecran`** (commit `6aabed6`, empilée, poussée) : `restauration.ts`
  (préparer → sauvegarder la base en place → confirmer ; appliquée au démarrage avant d'ouvrir la
  base), 3 canaux admin, menu « Sauvegardes » (`modules/sauvegardes/PageSauvegardes.tsx`),
  `formaterDateHeure` dans `src/shared/format.ts`, libellés du journal, `UI_UX.md` § 5.22.
  9 tests (`tests/restauration.test.ts`, `tests/affichage-sauvegardes.test.ts`). **Testée à la main
  par Dev B** (droits, clé, restauration depuis la liste et depuis un fichier, retour arrière).
- 560 tests verts, typecheck OK. Aucune migration.
- Constats utiles :
  - `backup()` laisse la copie en mode WAL : il faut la repasser en `journal_mode = DELETE`, sinon
    des fichiers `-wal` / `-shm` traînent à côté ;
  - SQLite ne crée pas le dossier d'une base : avec `POS_DB`, créer le dossier d'abord
    (`New-Item -ItemType Directory -Force …`).

**En cours** : trois PR vers `test`, **dans l'ordre** (`gh` absent ; textes fournis à Dev B dans la
session) :
1. `b/docs-b15-fusion` (ce carnet est commité dessus) ;
2. `b/sauvegardes` ;
3. `b/sauvegardes-ecran`. Si la 2 est fusionnée en squash :
   `git switch b/sauvegardes-ecran; git fetch; git rebase --onto origin/test 10608f5; git push --force-with-lease`.
Les deux branches B16 ont été créées depuis `test` **avant** `b/docs-b15-fusion` : si `ETAT_AVANCEMENT.md`
entre en conflit (lignes B14 / B15 / B16 voisines), garder les deux côtés.

**Prochaine étape** :
1. Suivre les fusions : une ligne au journal des fusions par PR B16 ; **B16 reste 🔄**.
2. **Branchement à la clôture** (à convenir avec Dev A) : dans `src/main/modules/caisse/ipc.ts`
   (fichier de Dev A), canal `caisse:cloturerSession`, après `cloturerSession(base(), u, requete)` et
   avant le `return` : `sauvegarderEnFond('cloture')` (import depuis
   `../sauvegardes/automatique`). Ne lève jamais d'erreur, n'attend pas. Soit Dev A l'ajoute, soit il
   autorise Dev B à le faire dans une petite PR.
3. **Essai de restauration sur le terminal** (OMA POS), puis PR 3 : procédure de restauration écrite
   (guide du gérant / admin, Phase 5) ; ensuite B16 → ✅ (hors envoi distant, D-A4).
4. Puis **Phase 5** (S19–S20) : installateur `npm run dist`, mode kiosque, démarrage automatique, mises à
   jour sur site (la sauvegarde `mise_a_jour` est déjà en place), guide, import du vrai catalogue.
5. En attente de Dev A : A8 (`enregistrerMouvementCaisse`) pour finir B13 ; A14
   (`caisse:ventesPeriode`) pour la marge de B14 (voir l'entrée du 09/10).

**Questions ouvertes** :
- Branchement de la sauvegarde à la clôture : qui ajoute la ligne dans `caisse/ipc.ts` ?
- **D-A4** (hébergement de la sauvegarde distante) : toujours en attente, bloque la fin de B16.
- Dev A n'a rien poussé depuis le 01/10 (A4) ; A8 est en retard (fin S10).
- Questions déjà ouvertes : saisie d'une dépense « caisse » (A8), colonne « Suivi péremption » de
  l'import, D-A3, pertes dans le résultat, réactivations, photos.

**Contrats** :
- Ajoutés (sans impact pour la caisse) : `sauvegardes:etat`, `liste`, `creer` (gérant) ;
  `sauvegardes:choisirDossierExterne`, `restaurer`, `restaurerFichier` (admin) ; champ
  `ParametresBoutique.sauvegardeDossierExterne` (ajout seul).
- **Pour Dev A** :
  - `sauvegarderEnFond('cloture')` (`src/main/modules/sauvegardes/automatique.ts`) à appeler après la
    clôture, **hors transaction** ;
  - `src/main/index.ts` modifié (zone partagée) : restauration appliquée avant l'ouverture de la base,
    sauvegarde avant migration, sauvegarde du démarrage ;
  - `formaterDateHeure('2026-10-12 18:30:05')` → « 12/10/2026 à 18 h 30 » dans `src/shared/format.ts`.
- Attendus : `enregistrerMouvementCaisse()` (A8, en retard) ; `caisse:ventesPeriode` (A14, fin S16).

---

## 2026-10-09 — b/rapports-gestion → b/exports-listes (6 branches empilées) — B14 et B15
**Fait** :
- **B13 fusionnée** (PR #44, #45) : petite PR de documentation `b/docs-b13-fusion` (2 lignes au journal
  des fusions ; B13 reste 🔄, la source « caisse » attend A8).
- **B14 Rapports de gestion et journal d'audit** — règles validées par Dev B, écrites dans
  `REGLES_METIER.md` § 11.1 et § 1.4 :
  - pertes par cause : péremption, casse, **dons** (casse « Don », ligne à part), vol, **démarque
    d'inventaire** (écarts négatifs), **avoirs fournisseur non obtenus** (refusé = tout l'attendu ; reçu
    sous l'attendu = la différence ; attendu = pas encore une perte). Ne comptent pas : sortie annulée,
    stock initial, le retour lui-même. Surplus d'inventaire à part, non déduits ;
  - valeur du stock **aujourd'hui seulement**, au CUMP, par rayon (sous-rayon dans son rayon) ;
  - achats par fournisseur : livré, avoirs reçus, réglé sur la période ; reste dû d'aujourd'hui ;
  - résultat = marge − dépenses ; **marge `null`** tant que `caisse:ventesPeriode` manque ; pertes
    rappelées pour information, non déduites ;
  - période : mois en cours par défaut, fin jamais future ; gérant (rapports), **admin seul** (journal :
    7 jours par défaut, filtres personne / action, 200 par page + « Afficher plus », tout en français).
  - § 1.4 complété des 8 actions journalisées qui n'y figuraient pas.
  - PR 1 `b/rapports-gestion` (`ef94bd9`) : module `src/main/modules/rapports-gestion/`, contrat
    `src/shared/ipc/rapports-gestion.ts`, `SOLDE_DU` exporté de `fournisseurs/service.ts`. 17 tests.
  - PR 2 `b/rapports-ecran` (`f889d65`) : menu « Rapports de gestion » (`/rapports-gestion`, pour laisser
    `/rapports` à A14), 4 onglets, `UI_UX.md` § 5.20.
  - PR 3 `b/journal-audit` (`af45b6c`) : `src/shared/audit.ts` (libellés des actions, des champs et des
    valeurs ; ids → noms), module `src/main/modules/audit/`, menu « Journal des opérations » (admin,
    `roles: []`), `UI_UX.md` § 5.21. 10 tests.
- **B15 Exports Excel** — règles validées par Dev B (`REGLES_METIER.md` § 11.2) : on exporte **ce que
  l'écran affiche, filtres compris** ; ligne de titre « … — exporté le … par … », ligne vide, en-têtes ;
  montants / quantités en nombres (format « 1 000 F »), dates en vraies dates, codes-barres en texte,
  jamais de formule ; journal exporté en entier pour le filtre.
  - PR 4 `b/exports-excel` (`7386f6d`) : canal générique `exports:excel` (module
    `src/main/modules/exports/`, `classeurExcel` pur), `lib/exportExcel.ts`, `ui/BoutonExporter.tsx`,
    boutons sur Stock, Dépenses, Rapports (pure `exportRapports.ts`). 13 tests.
  - PR 5 `b/exports-listes` (`caae836`) : Produits, Péremptions, Sorties, Réceptions, Commandes,
    Fournisseurs, Journal, fenêtre de détail d'un inventaire (`exportInventaire.ts`, comptages + démarque
    300 F). 2 tests.
- **Tout testé à la main par Dev B** (scénarios rapports, journal, exports). 537 tests verts, typecheck OK.
  Aucune migration.

**En cours** : 6 PR vers `test` à ouvrir et fusionner **dans l'ordre** (`gh` absent ; textes fournis à
Dev B dans la session). Si squash, rebaser la suivante :
1. `b/docs-b13-fusion` ;
2. `b/rapports-gestion` ;
3. `b/rapports-ecran` — `git rebase --onto origin/test ef94bd9` ;
4. `b/journal-audit` — `git rebase --onto origin/test f889d65` ;
5. `b/exports-excel` — `git rebase --onto origin/test af45b6c` ;
6. `b/exports-listes` — `git rebase --onto origin/test 7386f6d` (ce carnet est commité dessus).
Puis `git push --force-with-lease` à chaque rebase.

**Prochaine étape** :
1. Suivre les fusions : une ligne au journal des fusions de `ETAT_AVANCEMENT.md` par PR ; **B15 → ✅**
   après la PR 6 ; **B14 reste 🔄** (marge). Supprimer les branches fusionnées (local et GitHub), dont
   les anciennes listées dans l'entrée du 2026-10-07 / 08.
2. **B16 Sauvegardes et restauration** (`/tache B16`, branche `b/sauvegardes` depuis `test` à jour) :
   sauvegarde à chaque clôture de caisse (API de sauvegarde SQLite, WAL), rotation 30 + 1 par semaine,
   copie sur clé USB, **restauration testée** (journal `restauration_sauvegarde`, libellé déjà dans
   `src/shared/audit.ts`). **D-A4 (hébergement distant) en attente** : faire la partie locale seulement,
   prévoir l'envoi distant. Point de branchement « à chaque clôture » : `caisse/service-cloture.ts`
   appartient à Dev A — à convenir avec lui (appel après la transaction, jamais dedans).
3. **Quand `caisse:ventesPeriode` (A14) arrivera** : remplir `marge` dans `rapports-gestion/resultat.ts`
   (marge brute = Σ total_ligne − Σ quantite × cout_unitaire), tests, B14 → ✅.
4. **Quand A8 arrivera** : terminer B13 (voir l'entrée du 2026-10-08).

**Questions ouvertes** :
- Où la caissière saisit une dépense « caisse » (A8) : à décider avec Dev A.
- Colonne « Suivi péremption » dans l'import Excel : toujours non confirmée par Dev B.
- D-A3 (plafond de remise), **D-A4 (sauvegarde distante, bloque une partie de B16)** : en attente.
- Les pertes doivent-elles un jour être déduites du résultat ? La règle § 11 dit non ; à confirmer avec la
  cliente si elle le demande.
- Réactivation (produit, compte, catégorie, fournisseur) : non prévue. Photos : reportées.

**Contrats** :
- Ajoutés (sans impact pour la caisse) : `rapports:pertes`, `rapports:valeurStock`, `rapports:achats`,
  `rapports:resultat` (gérant) ; `audit:journal`, `audit:choix` (admin) ; `exports:excel` (toute session).
- **Pour Dev A** :
  - `ui/BoutonExporter.tsx` + `exports:excel` sont génériques : utilisables pour A14 / la clôture
    (`demande={() => ({ nomFichier, titre, feuilles })}`, colonnes `texte | nombre | montant | date`) ;
  - **toute nouvelle action passée à `journaliser()` doit recevoir son libellé** dans
    `src/shared/audit.ts` (`LIBELLES_ACTION`, et ses champs dans `LIBELLES_CHAMP`), sinon le journal
    l'affiche en mots bruts ;
  - menu : « Rapports de gestion » est sur `/rapports-gestion` ; `/rapports` reste libre pour A14 ;
  - `RapportResultat.marge` attend `caisse:ventesPeriode` (A14, fin S16).
- Attendus : `enregistrerMouvementCaisse()` (A8, prévu fin S10, en retard) ; `caisse:ventesPeriode` (fin S16).

---

## 2026-10-08 — b/depenses, b/depenses-ecran — B13 Dépenses (partie « fonds propres »)
**Fait** :
- **Règles validées par Dev B**, écrites dans `REGLES_METIER.md` § 10.1 (et § 1.4 pour le journal) :
  - 9 catégories de départ (Loyer, Électricité, Eau, Salaires, Transport, Entretien et réparations,
    Fournitures, Impôts et taxes, Autre), présentes aussi en production ; le gérant en crée et en
    désactive, au moins une reste active ; **nom unique parmi toutes, désactivées comprises** (le
    schéma d'origine l'impose : `categories_depense.nom UNIQUE`) ;
  - catégorie active, libellé obligatoire, francs entiers > 0, pas de plafond ; date du jour par
    défaut, passée acceptée, jamais future ; numéro `DEP` à l'enregistrement ;
  - justificatif = référence texte facultative (photo reportée) ;
  - gérant pour tout ; la caissière ne fera que des dépenses « caisse » sur sa session, après A8 ;
  - correction = annulation avec motif, journalisée (`annulation_depense`), une seule fois ; reste
    visible, ne compte plus.
- **PR 1 `b/depenses`** (commit `bb66be0`, poussée) : migration `20261008_0900_depenses.sql`
  (`depenses.numero` unique, `reference`, colonnes d'annulation ; `categories_depense.actif`,
  `desactive_le` ; triggers : pas de suppression, dépense annulée figée ; catégories de départ),
  module `src/main/modules/depenses/`, contrat `src/shared/ipc/depenses.ts`, `totalDepenses(db, du, au)`
  pour B14. 11 tests (`tests/depenses.test.ts` : taxi-moto 1 000 → `DEP-AAAA-000001` ; 1 000 + loyer
  15 000 = **16 000**, loyer annulé → **1 000** ; un refus ne consomme pas de numéro ; source « caisse »
  refusée).
- **PR 2 `b/depenses-ecran`** (commit `31f7a03`, empilée, poussée) : menu « Dépenses »
  (`modules/depenses/PageDepenses.tsx`), fenêtres Nouvelle dépense / Annuler / Catégories, logique pure
  `saisieDepense.ts` (4 tests), `UI_UX.md` § 5.19. **Scénario complet testé à la main par Dev B.**
- 495 tests verts, typecheck OK. `MODELE_DONNEES.md` à jour.
- Les deux branches B13 ont été **rebasées sur `b/docs-b12-fusion`** (pas encore fusionnée) pour éviter
  un conflit sur ce carnet et sur `ETAT_AVANCEMENT.md` (lignes B12 / B13 voisines) ; poussées en
  `--force-with-lease`.
- Le fichier temporaire `electron.vite.config.1790196666553.mjs` signalé par Dev A n'est plus versionné.

**En cours** : trois PR vers `test`, **dans l'ordre** (`gh` absent de ce poste ; texte des PR B13 fourni à
Dev B dans la session) :
1. `b/docs-b12-fusion` : https://github.com/ryckos/pos-boutique/compare/test...b/docs-b12-fusion?expand=1
   (squash, supprimer la branche).
2. `b/depenses` (PR 1 B13). Après la fusion de la 1 en squash :
   `git switch b/depenses && git fetch && git rebase --onto origin/test 3bf695d && git push --force-with-lease`.
3. `b/depenses-ecran` (PR 2 B13), après la fusion de la 2. Si squash :
   `git switch b/depenses-ecran && git fetch && git rebase --onto origin/test bb66be0 && git push --force-with-lease`.
   Ce carnet est commité sur `b/depenses-ecran`.

**Prochaine étape** :
1. Suivre les fusions : une ligne au journal des fusions de `ETAT_AVANCEMENT.md` par PR B13. **B13 reste
   🔄** après la PR 2 : la partie « caisse » attend A8. Supprimer les branches fusionnées (local et
   GitHub ; liste des anciennes dans l'entrée précédente).
2. **B14 Rapports de gestion et journal d'audit** (`/tache B14`, branche `b/rapports-gestion` depuis
   `test` à jour). Relire `REGLES_METIER.md` § 11 et la fiche B14 de `DEV_B_BACKOFFICE.md`. Disponible
   sans Dev A : pertes par cause (casse, « Don » = libellé, vol, péremption, démarques d'inventaire =
   `document_type = 'inventaire'`), valeur du stock, dépenses (`totalDepenses`), journal d'audit
   (admin). Bloqué : la marge et le résultat attendent `caisse:ventesPeriode` (Dev A, fin S16) ;
   prévoir le contrat et afficher « marge disponible avec les rapports de ventes » en attendant.
3. **Quand A8 arrivera** (`grep -rn enregistrerMouvementCaisse src/main`) : terminer B13 —
   - `enregistrerDepense` source `caisse` : `sessionOuverte(db, utilisateurId)` exigée, date = jour,
     `session_caisse_id`, mouvement `sortie` motif `depense`, `document_type = 'depense'`, même
     transaction ;
   - ouvrir `depenses:enregistrer` (et `depenses:categories`) à la caissière pour la source caisse
     seulement ; menu ou bouton depuis la caisse (à voir avec Dev A) ;
   - annulation d'une dépense « caisse » = entrée compensatoire, refusée si la session est clôturée ;
   - retirer `SOURCES_OUVERTES` limité dans `saisieDepense.ts` ; tests avec le scénario de clôture
     (dépense taxi-moto 1 000 → espèces théoriques **58 700**).

**Questions ouvertes** :
- Où la caissière saisit-elle une dépense « caisse » : bouton dans l'écran Caisse (Dev A) ou menu
  « Dépenses » restreint ? À décider avec Dev A au moment d'A8.
- Colonne « Suivi péremption » dans l'import Excel : toujours non confirmée par Dev B.
- Plafond de remise caissier (D-A3) : en attente de la cliente. D-A4 (sauvegarde distante) bloquera B16.
- Réactivation (produit, compte, catégorie, fournisseur, catégorie de dépense) : non prévue. Photos
  (produits, justificatifs) : reportées.

**Contrats** :
- Ajoutés (gérant, **sans impact pour la caisse**) : `depenses:categories`, `creerCategorie`,
  `desactiverCategorie`, `liste`, `enregistrer`, `annuler`. Fonction `totalDepenses(db, du, au)`
  (principal) pour les rapports.
- **Pour Dev A** : nouvelle migration (tables `depenses` et `categories_depense` seulement). Le contrat
  accepte déjà `source: 'caisse'` ; il n'attend que `enregistrerMouvementCaisse()` (A8), qui devra
  accepter `document_type = 'depense'` / `document_id` et le motif `depense` (déjà dans le CHECK de
  `mouvements_caisse`).
- Attendu : `enregistrerMouvementCaisse()` (Dev A, A8, prévu fin S10) toujours pas livré ;
  `caisse:ventesPeriode` (fin S16) pour la marge de B14.

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
