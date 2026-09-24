# Carnet de bord — Claude Code de Dev A

Mémoire de session à session. **Nouvelle entrée en haut** à chaque fin de session (commande
`/cloturer`), lue à chaque début de session (commande `/reprendre`). L'autre Claude Code lit la
dernière entrée de ce carnet pour savoir ce que fait Dev A : écrire clairement, sans jargon interne
à la session.

Format d'une entrée :

```
## AAAA-MM-JJ — <branche> — <tâche>
**Fait** : …
**En cours** : … (fichiers, état exact)
**Prochaine étape** : … (assez précise pour reprendre sans rien relire d'autre)
**Questions ouvertes** : … (pour Dev A, pour l'autre développeur, pour la cliente)
**Contrats** : livrés / attendus / modifiés (impact pour l'autre développeur)
```

---

## 2026-09-24 (suite) — a/caisse-onglets — A1.2 Grille, conditionnement (partie 2)
**Fait** :
- A2 fusionnée (PR #14) et passée à ✅ (commit `378bd39` en tête de cette branche).
- `modules/caisse/grille.ts` (pur) : `ongletsDeGrille`, `filtrerGrille`, `afficherOnglets`.
  **Choix validés par Dev A** : onglets affichés dès deux rayons ; « Tout » d'abord (par défaut),
  rayons par ordre alphabétique français, « Sans rayon » en dernier pour les non classés. Onglets
  **sous** la grille, comme la maquette validée (UI_UX § 5.2) ; l'onglet choisi reste actif d'une
  vente à l'autre ; filtre local, aucune requête.
- `FenetreConditionnement.tsx` : bouton « Changer le conditionnement » sur la ligne sélectionnée →
  `catalogue:conditionnementsProduit` (Dev B) → liste avec prix, l'actuel marqué ; un toucher applique
  `changerConditionnement` (quantité gardée, fusion si déjà au ticket). « Ce produit ne se vend qu'à
  l'unité » s'il n'y a qu'un conditionnement. Douchette et raccourcis coupés pendant la fenêtre.
- `styles.css` (zone partagée) : `.caisse-onglet*`, `.conditionnement-*` ; `.ticket-actions` passe à la ligne.
- 6 tests (`tests/grille.test.ts`), 161 au total, build OK ; essai manuel validé par Dev A
  (onglets, 2 unités → 2 cartons 15 000 F, fusion 3 cartons 22 500 F, baguette à l'unité).

**En cours** : A1.2 🔄 — PR « partie 2 » vers `test` à ouvrir ; A1.2 → ✅ après fusion.

**Prochaine étape** :
1. Après fusion : A1.2 ✅ + ligne au journal des fusions ; supprimer la branche.
2. **A3 — Ticket, tiroir, réglages matériel** (`/tache A3`, branche `a/caisse-ticket` depuis `test`) :
   **demander d'abord à Dev A la page de codes gagnante du test T2 (D-A2)** ; ticket 48 colonnes via
   `materiel/escpos.ts`, imprimé APRÈS `enregistrerVente` ; tiroir à chaque encaissement espèces ;
   imprimante en panne = « Vente enregistrée, ticket non imprimé » + Réimprimer ; réimpression
   « DUPLICATA » ; écran Réglages matériel (gérant). `parametres:lire` pas encore livré par Dev B :
   en-tête en dur et configuration locale en attendant.

**Questions ouvertes** :
- Essai à la vraie douchette et affichage de la fenêtre de paiement sur le 15,6″ du terminal : sur site.
- Rappel à Dev B : fichier temporaire `electron.vite.config.1790196666553.mjs` toujours versionné.
- D-A1, D-A2 (bloque A3), D-A3 : inchangées.

**Contrats** : aucun modifié. `categorie` et `conditionnementsProduit` (Dev B) désormais utilisés.

## 2026-09-24 — a/caisse-paiement — A2 Encaissement (partie 2 : écrans)
**Fait** :
- Début de session : `test` à jour (140 tests). Contrats de Dev B arrivés : `categorie` (PR #8),
  `catalogue:conditionnementsProduit` (PR #10). Nouvelle règle de Dev B : formulaires en
  `ui/FenetreFormulaire.tsx` (les fenêtres de caisse F2 et paiement gardent `.voile`/`.fenetre`).
- `OuvertureCaisse.tsx` : sans session, « Caisse fermée » + « Ouvrir la caisse » (fond saisi dans
  `FenetreFormulaire`, `caisse:ouvrirSession`). `PageCaisse` lit `caisse:sessionCourante` au chargement.
- `paiement.ts` (logique pure) + `FenetrePaiement.tsx` sur deux colonnes. **Choix validés par Dev A
  après essai** (écrits dans `UI_UX.md` § 5.3) : espèces = toujours le reste (seuls TMoney/Flooz se
  saisissent) ; un seul champ espèces « Montant reçu du client » ; billets additionnés ; reçu vide =
  montant exact ; F4 puis Entrée encaisse ; sélection du contenu au toucher d'un champ de montant.
- `PageCaisse` : boutons Espèces/TMoney/Flooz actifs (Crédit jusqu'à A11), F4, douchette et
  raccourcis coupés pendant le paiement, message « Vente T-… enregistrée. Monnaie à rendre : … »,
  bandeau ambre `alertesStock` (D-A1).
- **Deux bogues trouvés à l'essai et corrigés** (tests de non-régression dans `tests/paiement.test.ts`) :
  ligne TMoney ajoutée à 0 F qui laissait encaisser en espèces seules ; frappe ajoutée au montant
  existant (« 8500 » + « 5000 »). Le service n'a jamais rien enregistré d'incohérent (vérifié en base).
- 15 tests de paiement, 155 au total, build OK. Essais manuels 1 à 8 validés par Dev A.

**En cours** : A2 🔄 — PR « partie 2 » vers `test` à ouvrir. A2 → ✅ et journal des fusions après fusion.

**Prochaine étape** :
1. Après fusion : A2 ✅ + ligne au journal des fusions ; supprimer la branche.
2. **A1.2 partie 2** (branche `a/caisse-onglets` depuis `test`), les deux contrats sont arrivés :
   - onglets de catégories au-dessus de la grille : « Tout » + un par `categorie` (nom du rayon,
     `null` = « Autres »), filtre local, pas de nouvelle requête ;
   - bouton « Changer le conditionnement » dans `.ticket-actions` de la ligne sélectionnée →
     `catalogue:conditionnementsProduit { produitId }` → petite fenêtre `.voile`/`.fenetre` listant les
     conditionnements → action `{ type: 'changerConditionnement', ancienId, article }` (déjà prête).
   Puis A1.2 → ✅.
3. Ensuite **A3** (ticket ESC/POS, tiroir, réglages) : demander à Dev A la page de codes D-A2 ;
   `parametres:lire` attendu de Dev B (fin S5), en attendant en-tête en dur.

**Questions ouvertes** :
- Essai à la vraie douchette sur le terminal (A1.1) et **affichage de la fenêtre de paiement sur le
  15,6″ réel** (tient-elle sans défiler ?) : à vérifier sur site.
- Signalé à Dev B : fichier temporaire `electron.vite.config.1790196666553.mjs` versionné par
  `be2635f`, à supprimer et à ignorer (`.gitignore`).
- D-A1 (stock négatif), D-A2 (page de codes), D-A3 (plafond remise) : inchangées.

**Contrats** : aucun modifié. Reçus : `categorie` et `conditionnementsProduit` (Dev B).

## 2026-09-23 (fin) — a/caisse-encaissement — A2 Encaissement (partie 1 : serveur)
> **Entrée restaurée** : perdue lors de la résolution de conflit de la PR #7 (fusionnée), remise en place
> par `/verifier`. Branche créée depuis `test` **avant** la fusion de la PR A1.2 (`a/caisse-grille`, entrée de carnet
> « A1.2 partie 1 » sur cette branche-là). Au rebase, garder les deux entrées, celle-ci en haut.

**Fait** :
- **Décision validée par Dev A** : le minimum des sessions de caisse est avancé d'A4 à A2, car
  `ventes.session_caisse_id` est obligatoire (règle 6.1 : aucune vente sans session). Pas de session
  automatique. A4 garde clôture, X, Z.
- Contrat `src/shared/ipc/caisse.ts` : `caisse:sessionCourante`, `caisse:ouvrirSession
  { fondOuverture }`, `caisse:enregistrerVente` (`RequeteVente` → `VenteEnregistree` avec
  `alertesStock`). Rôles caissier et gérant. Modes acceptés : `especes`, `tmoney`, `flooz`
  (**crédit refusé jusqu'à A11**, validé par Dev A).
- `calculs.ts` : `ventilerTva()` par taux (seul arrondi).
- `service-session.ts` : `sessionOuverte(db, utilisateurId)`, `ouvrirSession()` (une seule ouverte,
  fond entier ≥ 0, journalisée `ouverture_session_caisse`).
- `service-vente.ts` : `enregistrerVente(db, utilisateurId, requete)` en une `avecTransaction`
  (prix/coûts relus dans `v_catalogue_vente` + CUMP, photocopie, un mouvement `vente` par ligne,
  `lot_id` null jusqu'à A9, paiements, somme = total, référence mobile money obligatoire, espèces
  reçues ≥ part espèces, monnaie rendue). Stock négatif : vente enregistrée + `alertesStock`
  (**D-A1 non tranchée**, validé par Dev A : pas de journalisation spéciale).
- `tests/caisse-vente.test.ts` : 22 tests (TVA 11 363 / 1 937 ; vente de démo 8 500 F, HT 7 249,
  TVA 1 251, monnaie 1 500 ; tomate 72 → 46 ; marges 1 500 / 200 / 120 ; scénario 10 100 F ; refus
  et rollback complet, numéro non consommé). 86 tests au total, build OK.
- Commits `20f9225`, `1d108fb`.

**En cours** : A2 🔄 — PR « partie 1 » vers `test`. A1.2 partie 1 aussi en PR (non fusionnée).

**Prochaine étape** :
1. Dès que la PR A1.2 est fusionnée : `git fetch && git rebase origin/test` sur cette branche
   (conflits attendus seulement dans `ETAT_AVANCEMENT.md` et ce carnet : garder les deux versions).
2. **A2 partie 2** (même branche si la PR 1 n'est pas encore fusionnée, sinon nouvelle branche
   `a/caisse-paiement` depuis `test`) :
   - au chargement de `PageCaisse` : `caisse:sessionCourante` ; sans session, n'afficher que
     « Ouvrir la caisse » (saisie du fond, `caisse:ouvrirSession`) — UI_UX § 5.2 ;
   - `FenetrePaiement.tsx` (UI_UX § 5.3), en réutilisant `.voile` / `.fenetre` de la PR A1.2 :
     billets 1 000 / 2 000 / 5 000 / 10 000 + « Montant exact », monnaie à rendre en très grand,
     référence obligatoire TMoney/Flooz, paiement mixte avec « Reste à payer », bouton « Encaisser » ;
     ouverte par les boutons Espèces/TMoney/Flooz et par F4 (`case 'encaisser'` déjà prévu) ;
   - envoi `{ lignes: [{ conditionnementId, quantite }], paiements, montantRecu }` ; au succès,
     vider le ticket et afficher « Vente T-… enregistrée. Monnaie à rendre : … » ; afficher
     `alertesStock` en bandeau ambre ; l'impression et le tiroir restent pour A3.
   Puis A2 → ✅ et contrat `caisse:enregistrerVente` → ✅.

**Questions ouvertes** :
- Essai à la vraie douchette sur le terminal (A1.1) : toujours à faire.
- D-A1 (stock négatif), D-A2 (page de codes, à demander avant A3), D-A3 (plafond remise) : inchangées.

**Contrats** :
- **Livré en lecture pour Dev B** : `caisse:enregistrerVente`, modèle de transaction
  (`service-vente.ts`). `sessionOuverte(db, utilisateurId)` existe déjà ; attention, Dev B attend
  pour B13 une forme **sans** utilisateur (`sessionOuverte(db)`, fin S10) : à discuter en A8.
- Attendus inchangés : `catalogue:conditionnementsProduit` (fin S4), `categorie` dans
  `ArticleCatalogue` (avec B2.1), `parametres:lire` (fin S5).

## 2026-09-23 (suite) — a/caisse-grille — A1.2 Grille, recherche, conditionnement, attente (partie 1)
**Fait** :
- A1.1 fusionnée (PR #3) et passée à ✅. Correctif des droits demandé par la revue de Dev B fusionné
  (PR #5) : `materiel:imprimantes` exige gérant, `materiel:ouvrirEcranClient` exige une session.
  Contrat « contrôle des rôles » passé à ✅.
- A1.2 partie 1 (2 commits `ae66392`, `e0b9a3e`) :
  - `modules/caisse/attente.ts` : tickets en attente (`mettreEnAttente`, `reprendre`, `resumeAttente`,
    `reducteurCaisse`). **Choix validés par Dev A** : reprendre un ticket alors que le courant est
    rempli **permute** les deux ; ticket courant et tickets en attente gardés **en mémoire par
    caissière** (Map au niveau du module de `PageCaisse`), survivent au changement d'écran et à la
    déconnexion, perdus à la fermeture de l'application, jamais en base.
  - `modules/caisse/clavier.ts` : F2 recherche, F4 encaisser (sans effet avant A2), F8 attente,
    Suppr, Échap (désélectionne), + / −. Ignorés dans les champs et quand la recherche est ouverte.
  - `FenetreRecherche.tsx` : nombre tapé → `catalogue:rechercherCode` d'abord (PLU `101` = baguette),
    sinon `catalogue:rechercher` ; 200 ms après la dernière frappe ; flèches, Entrée, Échap.
  - `changerConditionnement()` dans `panier.ts` (quantité conservée, fusion si déjà au ticket, refus si
    autre produit) : **logique et tests seulement**, pas de bouton tant que le canal de Dev B manque.
  - `styles.css` (zone partagée) : `.caisse-recherche`, `.caisse-ticket-actions`, `.attente-*`,
    `.voile`, `.fenetre*`, `.recherche-*`, nouveau jeton `--voile`.
  - 12 tests de plus (76 au total), build OK, essai manuel concluant (recherche, attente, raccourcis,
    mémoire, vente mixte < 15 s).

**En cours** : A1.2 🔄 — PR « partie 1 » vers `test` ouverte / en relecture par Dev B.

**Prochaine étape** :
1. Faire fusionner la PR partie 1 (relecture Dev B). Supprimer la branche.
2. **Partie 2** dès qu'un des contrats de Dev B arrive dans `test` (nouvelle branche depuis `test`,
   ex. `a/caisse-conditionnement`) :
   - `catalogue:conditionnementsProduit` → bouton « Changer le conditionnement » dans
     `.ticket-actions` de la ligne sélectionnée ; petite fenêtre listant les conditionnements ; action
     `{ type: 'changerConditionnement', ancienId, article }` déjà prête dans le réducteur.
   - `categorie` dans `ArticleCatalogue` → onglets de catégories au-dessus de la grille (« Tout » +
     une par catégorie), filtre local sans nouvelle requête.
   Puis A1.2 → ✅.
3. En attendant les contrats : démarrer **A2 — Encaissement et `caisse:enregistrerVente`** (`/tache A2`),
   rendez-vous à livrer à Dev B fin S5.

**Questions ouvertes** :
- Essai à la vraie douchette sur le terminal (A1.1) : toujours à faire.
- D-A1, D-A2, D-A3 : inchangées.

**Contrats** :
- Demandé à Dev B (2026-09-23) : `categorie: string | null` dans `ArticleCatalogue` (au moins dans
  `catalogue:grille`), avec B2.1 ; ordre alphabétique suffisant, `ordreCategorie` bienvenu.
  Ligne ajoutée aux rendez-vous de `ETAT_AVANCEMENT.md`.
- Rappel fin S4 : `catalogue:conditionnementsProduit` attendu sous la forme
  `{ requete: { produitId: number }; reponse: ArticleCatalogue[] }`, unité en premier.
- Aucun contrat livré ni modifié par Dev A.

## 2026-09-23 — a/caisse-panier — A1.1 Panier et logique de calcul
**Fait** :
- `src/renderer/src/modules/caisse/panier.ts` : panier en fonctions pures (`ajouterArticle`,
  `changerQuantite`, `incrementer`/`decrementer`, `supprimerLigne`, `selectionner`, `totalLigne`,
  `totalPanier`, `quantiteBaseTotale`, `versPanierClient`, `reducteurPanier`). Même conditionnement =
  quantité +1 ; quantité 0 = ligne supprimée ; la ligne touchée devient la sélection.
- `tests/panier.test.ts` : 13 tests (vente mixte du scénario 10 100 F, 29 boîtes de tomate,
  20 scans = 1 ligne ×20, immutabilité…). `npm run verifier` vert (30 tests), build OK.
- `PageCaisse.tsx` réécrit (démo retirée) selon la maquette 5.2 : grille à gauche, ticket à droite,
  total 40 px, pastille verte si `quantiteBase !== 1`, sélection d'une ligne avec − / + /
  « Supprimer la ligne », boutons Espèces/TMoney/Flooz/Crédit **présents mais désactivés** (A2).
  Scans traités **en file** (promesse chaînée dans un `useRef`) : ordre conservé, aucune perte.
  Code inconnu : « Code … inconnu. Créez le produit ou vérifiez le code. », le scan suivant marche.
- `styles.css` (zone partagée) : classes `.ticket-entete`, `.ticket-ligne*`, `.pastille-conditionnement`,
  `.ticket-actions*`, `.caisse-paiements`, `.caisse-ecran-client` — jetons existants seulement.
- Essai manuel validé par Dev A **en simulation** (événements clavier dans la console DevTools :
  vente mixte 10 100 F, rafale de 20 scans, code inconnu puis code valide).
- 2 commits sur `a/caisse-panier` : `4486136`, `bc9524a`.

**En cours** : A1.1 🔄 — branche poussée, PR vers `test` à ouvrir / en relecture par Dev B.

**Prochaine étape** :
1. Si la PR A1.1 n'est pas fusionnée : relancer Dev B pour la relecture, corriger ses remarques.
2. Une fois fusionnée : passer A1.1 à ✅ dans `ETAT_AVANCEMENT.md` (+ ligne au journal des fusions),
   supprimer la branche, puis `git switch test && git pull && git switch -c a/caisse-grille` et
   `/tache A1.2` (onglets de catégories, recherche F2 sans `data-scan`, mise en attente de tickets,
   raccourcis F2/F4/F8/Suppr/Échap/+ −). Le changement de conditionnement attend
   `catalogue:conditionnementsProduit` (Dev B, fin S4) : bouton masqué d'ici là.

**Questions ouvertes** :
- **Essai à la vraie douchette sur le terminal** (critère « 20 scans rapides ») : à faire dès que
  Dev A a la douchette. Astuce de simulation sans matériel : dans la console DevTools,
  `window.dispatchEvent(new KeyboardEvent('keydown', { key: c }))` pour chaque caractère puis `'Enter'`.
- Pastille du conditionnement basée sur `quantiteBase !== 1` car `ArticleCatalogue` n'expose pas
  `estDefaut`. Suffisant pour l'instant ; demander le champ à Dev B si un cas contraire apparaît.
- D-A2 (page de codes), D-A3 (plafond remise), D-A1 (stock négatif) : inchangées.

**Contrats** : aucun livré ni modifié. Pour Dev B : seule la zone partagée `ui/styles.css` a reçu des
classes de caisse (ajouts purs, rien de modifié). Attendus inchangés :
`catalogue:conditionnementsProduit` (fin S4), `parametres:lire` (fin S5).

## 2026-09-22 — main — Passation initiale
**Fait** : conception complète (voir `docs/claude/BRIEF_DEV_A.md` § 3), socle initialisé et
vérifié (typecheck, 17 tests, build), documentation et briefs en place.
**En cours** : rien.
**Prochaine étape** : Démarrer **A1.1 — Panier et logique de calcul** (`/tache A1.1`). Branche proposée : `a/caisse-panier`.
**Questions ouvertes** :
- Page de codes gagnante du test T2 (D-A2) : à demander à Dev A avant A3.
- Plafond de remise caissier (D-A3) : à obtenir de la cliente avant A5.
- Politique de stock négatif (D-A1) : en attente de la cliente, ne jamais bloquer une vente d'ici là.
**Contrats** : attendus — `catalogue:conditionnementsProduit` (Dev B, fin S4) · `parametres:lire` (Dev B, fin S5).
