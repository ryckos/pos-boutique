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

### D-A2 — Page de codes de l'imprimante
- **Question** : quelle page de codes (`cp1252`, `cp858` ou `cp437`) imprime correctement
  « éèêàçùôî ÉÇ € » sur la Xprinter M804 du client ?
- **Contexte** : le test T2 a été validé, mais la page gagnante n'a pas encore été reportée ici.
- **À faire** : Dev A reporte le résultat ici et le code par défaut (tâche A3).

### D-A3 — Plafond de remise du caissier
- **Question** : quel montant ou pourcentage maximal le caissier peut-il accorder sans gérant ?
- **Qui décide** : la cliente.

### D-A4 — Hébergement de la sauvegarde distante
- **Question** : quel service utiliser pour la sauvegarde distante chiffrée (Phase 4, B16) ?
- **Qui décide** : la cliente et Dev B.

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
  - vert `#0f6e56`, dans la continuité des documents remis à la cliente ;
  - cibles tactiles larges ;
  - le total comme élément fort de la caisse.
- **Référence** : `docs/UI_UX.md`.
