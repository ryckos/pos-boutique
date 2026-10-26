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

**En cours** : `feature/sk/ergonomie` fusionnée dans `test` le 2026-10-26, **directement, sans PR**, à la
demande de Dev B, pour que chacun reprenne ses tâches sur une base commune. La cliente teste la
1.0.0-rc.1 avec les fiches de `docs/fiches-test/`.

**Prochaine étape** :
1. **Suivre le test de la cliente** (fiches remplies, `docs/fiches-test/`). Une correction = une branche
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
- Fusion directe dans `test` sans relecture : Dev A doit relire les changements qui touchent ses écrans
  (liste ci-dessous) et signaler tout souci.
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
