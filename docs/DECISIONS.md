# Journal des décisions

Décisions prises pendant la conception et la Phase 0. Une décision **prise** ne se rediscute pas
sans raison nouvelle ; si vous voulez la remettre en cause, ajoutez une entrée plutôt que de
modifier l'ancienne. Une décision **en attente** ne se tranche pas seul : elle se valide avec la
cliente ou entre les deux développeurs.

---

## Décisions en attente ⚠

### D-A1 — Politique de stock négatif
- **Question** : faut-il bloquer une vente quand le stock calculé est insuffisant ?
- **Contexte** : le pain arrive souvent le matin et sa réception n'est saisie qu'ensuite.
  Bloquer arrêterait la caisse.
- **Recommandation** : autoriser la vente avec une alerte visible par le gérant. L'inventaire
  régularise ensuite.
- **En attendant** : ne jamais bloquer la vente ; afficher une alerte.
- **Qui décide** : la cliente.

### D-A3 — Plafond de remise du caissier
- **Question** : quel montant ou pourcentage maximal le caissier peut-il accorder sans gérant ?
- **Qui décide** : la cliente.

### D-A4 — Hébergement de la sauvegarde distante
- **Question** : quel service utiliser pour la sauvegarde distante chiffrée (Phase 4, B16) ?
- **Qui décide** : la cliente et Dev B.

### D-A6 — Marge affichée : TTC ou HT
- **Question** : la marge brute des rapports se calcule-t-elle sur le chiffre d'affaires TTC (règle
  actuelle, § 11) ou HT ? Sur le TTC, la TVA collectée (à reverser) gonfle la marge.
- **En attendant** : seule la marge TTC est affichée (rapport de résultat, B14) ; `ventesPeriode`
  calcule déjà `margeHt`, prête à être affichée.
- **Qui décide** : la cliente.

### D-A5 — Signature du cahier des charges
- **Statut** : le cahier des charges v1.0 a été rédigé et soumis à la cliente.
- **À faire** : noter ici la date de signature et les éventuels avenants.

---

## Décisions prises ✅

### D-01 — Application de bureau hors ligne, pas de SaaS
- **Décision** : l'application est installée sur le terminal avec une base locale. Le cloud ne sert
  qu'à la sauvegarde.
- **Raison** : Internet n'est pas garanti à Lomé, et une caisse ne doit jamais s'arrêter.

### D-02 — Electron plutôt que Laravel (Phase 0)
- **Décision** : les deux prototypes ont été testés sur le terminal avec les mêmes 5 tests
  (douchette, impression, tiroir, double écran, SQLite). Electron a été retenu.
- **Raisons** :
  - le **double écran** (T4) est géré nativement : la fenêtre client s'ouvre en plein écran sur le
    11,6″ sans manipulation, alors qu'avec un navigateur il faut F11 ou un script kiosque ;
  - Electron contrôle les fenêtres et le focus clavier nécessaire à la douchette ;
  - les développeurs ont un profil React et TypeScript.
- **Conséquence** : le prototype Laravel est abandonné.

### D-03 — SQLite via `node:sqlite` plutôt que better-sqlite3
- **Décision** : utiliser le module SQLite intégré au Node d'Electron.
- **Raison** : aucune compilation native, donc pas de Visual Studio Build Tools, une installation
  plus simple et un empaquetage fiable.
- **Réglages** : mode WAL et clés étrangères activées à chaque connexion.

### D-04 — Impression ESC/POS brute via Windows
- **Décision** : l'application génère elle-même les octets ESC/POS (`materiel/escpos.ts`) et les
  envoie en mode RAW.
  - Méthode A : spouleur Windows via `resources/raw-print.ps1` (API winspool).
  - Méthode B : `copy /b` vers une imprimante partagée.
- **Raison** : c'est rapide et sans dépendance native. La commande de coupe et l'impulsion du
  tiroir (`ESC p 0 25 250`) passent directement.

### D-05 — Détection des imprimantes : voie native Electron d'abord
- **Constat en Phase 0** : la liste des imprimantes était vide sur le terminal. `Get-Printer`
  (PowerShell) est trop lent sur le Celeron, ou absent de cette image Windows.
- **Décision** : utiliser d'abord `webContents.getPrintersAsync()`, puis PowerShell en repli avec
  un délai de 30 s. En dernier recours, le nom de l'imprimante se saisit manuellement.

### D-06 — Ticket imprimé mais blanc
- **Constat en Phase 0** : le papier sortait coupé mais vierge.
- **Cause** : le rouleau thermique était mal orienté. Seule une face est sensible ; on la
  reconnaît en la grattant à l'ongle, ce qui laisse une trace noire.
- **Consigne** : ce point figure dans le guide utilisateur et dans le dépannage (Phase 5).

### D-07 — Montants en entiers FCFA
- **Décision** : aucun flottant pour l'argent. Les prix sont stockés TTC.
- **Raison** : le FCFA n'a pas de décimales, et cela supprime les erreurs d'arrondi.

### D-08 — Le stock n'est jamais stocké
- **Décision** : aucune colonne de stock. Le stock est la somme de `mouvements_stock`.
- **Raison** : il ne peut pas se désynchroniser de son historique.

### D-09 — Immutabilité imposée par la base
- **Décision** : des triggers interdisent `UPDATE` et `DELETE` sur `mouvements_stock` et
  `journal_audit`, et `DELETE` sur `ventes` et `lignes_vente`.
- **Raison** : même un bug de l'application ne peut pas réécrire l'histoire.

### D-10 — Conditionnements (schéma v2)
- **Question de la cliente** : un même produit est vendu à l'unité, en lot et en carton, avec des
  prix dégressifs.
- **Décision** : un produit a une unité de base, et une table `conditionnements` porte les prix et
  les codes-barres. Tout est converti en unités de base dans les mouvements.
- **Remplace** : le schéma v1, qui avait le prix et le code-barres directement dans `produits`.

### D-11 — Photocopie au moment T dans les lignes de vente
- **Décision** : chaque ligne de vente copie la désignation, le prix, la TVA, le coût et la
  quantité de base.
- **Raison** : l'historique reste exact et la marge est réelle, même si le catalogue change.

### D-12 — Coût : CUMP par unité de base
- **Décision** : le coût est le coût unitaire moyen pondéré, recalculé à chaque réception.
- **Raison** : c'est standard, simple, et cela rend les marges comparables quel que soit le
  conditionnement vendu.

### D-13 — FEFO pour les produits périssables
- **Décision** : les lots les plus proches de la péremption sortent en premier, automatiquement.

### D-14 — Connexion par PIN à 4 chiffres unique
- **Décision** : pas de nom d'utilisateur. Le PIN identifie la personne, il est haché avec scrypt
  et la session est conservée côté processus principal.
- **Raison** : se connecter doit être rapide au comptoir, et l'identité ne doit pas être
  falsifiable.

### D-15 — Travail à deux par propriété de fichiers
- **Décision** : Dev A prend le comptoir et Dev B le back-office. Les contrats IPC sont découpés
  par module, les fichiers d'assemblage ne prennent qu'une ligne par module, les migrations sont
  horodatées, et on fusionne au moins une fois par jour.
- **Raison** : fusionner souvent, sans conflit.

### D-16 — Design de l'interface
- **Décision** :
  - police Segoe UI, native et hors ligne ;
  - jetons de couleurs uniques dans `styles.css` ;
  - vert `#0f6e56`, dans la continuité des documents remis à la cliente (**remplacé par D-19**, palette bleu commerce, le 2026-10-19) ;
  - cibles tactiles larges ;
  - le total comme élément fort de la caisse.
- **Référence** : `docs/UI_UX.md`.

### D-17 — Connexion par nom puis code (remplace D-14) · 2026-09-23
- **Décision** : on touche son nom, puis on tape son code à 4 chiffres. Les codes ne sont plus
  uniques. Le verrouillage après 5 codes faux se fait compte par compte. Tout code fixé par l'admin
  est provisoire : la personne choisit le sien avant tout accès.
- **Raison** : avec un code seul et unique, l'admin choisissait les codes des autres et le message
  « code déjà utilisé » révélait qu'un code ouvrait un compte. Un geste de plus par connexion,
  contre un code définitif que personne d'autre ne connaît.
- **Validée par** : le chef de projet, le 2026-09-23 (tâche B1).

### D-18 — Bibliothèque `xlsx` 0.20.3, installée depuis le site de SheetJS · 2026-09-25
- **Décision** : l'import et les exports Excel (B3, B15) utilisent `xlsx` (SheetJS) **0.20.3**,
  installée depuis `https://cdn.sheetjs.com/`, pas depuis npm. Elle est intégrée au code du
  principal (`electron.vite.config.ts`) : l'installateur n'a rien de plus à embarquer.
- **Raison** : npm s'arrête à la 0.18.5, qui a deux failles connues sur la lecture de fichiers
  (CVE-2023-30533, CVE-2024-22363) ; les versions corrigées ne sont publiées que par SheetJS. Un
  `npm install` doit donc pouvoir joindre `cdn.sheetjs.com` (poste de développement et CI).
- **Validée par** : Dev B, le 2026-09-25 (tâche B3).

### D-19 — Refonte ergonomique : palette bleu commerce, icônes, pagination · 2026-10-19
- **Décision** :
  - palette « bleu commerce » (bleu `#1f5fbf` pour l'action, marine `#13294b` pour le menu, orange
    `#e8790f` en accent rare) ; le vert reste celui du positif (`--succes`). Remplace le vert de D-16 ;
  - icônes SVG dessinées dans le code (`ui/Icone.tsx`), **sans dépendance** ;
  - boutons « mixtes » : icône seule + infobulle pour les actions de ligne des tableaux, icône +
    texte pour les actions principales, les validations et la caisse (`UI_UX.md` § 4.1) ;
  - infobulle au survol, au focus clavier et à l'appui long (écran tactile) ;
  - pagination de l'affichage des listes de gestion, 20 lignes par défaut (`UI_UX.md` § 5.12) ;
  - menu avec icônes, replié sous 1180 px ;
  - actions d'une ligne de tableau sur une seule ligne, et aide contextuelle « ? » en tête de chaque
    page et des fenêtres à icônes : légende des icônes et de leur fonction (`UI_UX.md` § 4.2).
- **Raison** : demande de modernisation pour la cliente (interface plus attractive et plus lisible).
  Le mixte garde la règle « un bouton dit ce qu'il fait » là où l'on agit vite au doigt : au
  toucher il n'y a pas de survol, une icône seule y serait une devinette.
- **Validée par** : Dev B, le 2026-10-19, avec l'accord de Dev A pour les écrans de la caisse.

### D-20 — Imprimante : partage réseau « XPOS », page de codes cp1252 (D-A2 tranchée) · 2026-10-25
- **Décision** : configuration validée en Phase 0 sur le terminal de la boutique (tests T2 et T3) :
  - méthode **B — partage réseau** (`copy /b` vers `\\localhost\XPOS`) : l'imprimante Xprinter M804
    est **partagée dans Windows sous le nom `XPOS`** ;
  - page de codes **`cp1252`** : « éèêàçùôî ÉÇ € » sortent justes sur le papier ;
  - tiroir-caisse branché sur l'imprimante (RJ11), ouvert par l'impulsion ESC/POS.
- **Dans l'application** : `cp1252` est la page de codes par défaut (`PAGE_DE_CODES_PAR_DEFAUT`,
  `src/main/materiel/reglages.ts`). La méthode et le nom du partage se saisissent à l'installation,
  dans « Réglages matériel » (`DEPLOIEMENT.md` § 4 et § 5.4) : ils dépendent du terminal, et les
  postes de développement gardent leur propre imprimante.
- **Remplace** la valeur provisoire `cp858` posée par Dev A le 2026-09-24 (A3) en attendant D-A2.
- **Validée par** : Dev B, le 2026-10-25, d'après les résultats du test sur le terminal (accents
  vérifiés sur le papier) ; à annoncer à Dev A (son fichier `reglages.ts` et ses tests changent).
