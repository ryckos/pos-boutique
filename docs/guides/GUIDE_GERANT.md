# Guide du gérant

Ma Boutique POS — version 1.0.0-rc.1

## L'écran en bref

- **À gauche** : le menu. Chaque page a son titre en haut.
- **Bouton ?** à côté du titre : il explique toutes les icônes de la page.
- **Une icône ?** Passez la souris dessus, ou gardez le doigt appuyé : son nom s'affiche.
- **Rien ne s'efface** : on désactive ou on annule, toujours avec un motif. L'historique reste.
- **Longue liste** : changez de page avec les flèches sous le tableau.
- **Exporter** (en haut de la plupart des pages) : la liste affichée part dans un fichier Excel.

---

## 1. Se connecter

1. Touchez votre nom, tapez votre code.
2. **Première fois** : tapez le code donné par la patronne, puis choisissez le vôtre (deux fois).
3. Pour changer votre code : menu **Mon code**.

## 2. Rayons (catégories)

1. Menu **Catégories**.
2. « Créer une catégorie » : tapez le nom du rayon (ex. Boissons).
3. Sous-rayon : sur le rayon, icône **+**, tapez le nom.
4. Renommer : icône **crayon-texte**.
5. Désactiver : icône **cercle barré** (seulement si le rayon est vide).

**Bon à savoir** : les rayons sont les onglets de la caisse.

## 3. Produits

**Importer le catalogue depuis Excel** (une fois au départ)
1. Menu **Produits** → « Importer depuis Excel ».
2. « Télécharger le modèle » ; remplissez-le dans Excel (nom et prix de vente obligatoires).
3. « Vérifier le fichier » : lisez le rapport.
4. Corrigez les lignes en **Erreur** dans Excel, enregistrez, vérifiez à nouveau.
5. Quand il n'y a plus d'erreur : « Importer ».

**Créer un produit**
1. « Nouveau produit ».
2. Nom, rayon, TVA (18 % ou 0 %), seuil d'alerte.
3. Cochez « Suivi de péremption » si le produit périme (lait, yaourt…).
4. Ligne « Unité » : prix de vente, code-barres (scannez-le).
5. Pas de code-barres ? Icône **code-barres** : un code est créé ; ou tapez un code court dans « PLU » (ex. `101`).
6. Pour la vente au carton ou au lot : « Ajouter un conditionnement » (nom, nombre d'unités, prix).
7. Cochez « Bouton caisse » pour un article sans code : il aura son bouton à la caisse.
8. « Créer le produit ».

**Modifier un produit ou un prix** : icône **crayon** sur la ligne, modifiez, enregistrez.

**Ne plus vendre un produit** : icône **cercle barré**, tapez le motif.

**Code inconnu** : tapez ou scannez le code dans « Rechercher » puis Entrée → « Créer le produit avec ce code ».

## 4. Stock de départ (une fois, à l'ouverture)

1. Menu **Stock initial**.
2. Sur chaque produit : icône **Compter**.
3. Comptez ce qu'il y a en rayon : cartons, lots, unités. Le total s'affiche.
4. Tapez le coût d'achat d'**une unité**.
5. Produit qui périme : tapez la date de péremption.
6. Enregistrez. Passez au suivant.

**Erreur ?** Icône **flèche retour** (avec un motif), puis recomptez.

## 5. Consulter le stock

1. Menu **Stock** : stock, valeur, état de chaque produit.
2. « Afficher » → « Ruptures et stocks bas » : ce qu'il faut commander.
3. « Pourquoi il en reste tant ? » : icône **horloge** sur le produit → chaque entrée et sortie, avec qui et quand.

## 6. Fournisseurs

1. Menu **Fournisseurs** → « Créer un fournisseur ».
2. Nom, téléphone, délai de paiement en jours (0 = comptant).
3. Modifier : icône **crayon**. Désactiver : icône **cercle barré** (seulement si on ne lui doit rien).

## 7. Commander

1. Menu **Commandes** → « Nouvelle commande ».
2. Choisissez le fournisseur.
3. Ajoutez les articles (scan ou nom), dans le conditionnement commandé (ex. carton).
4. Idée : « Proposer depuis les alertes » → cochez les produits → tapez les quantités.
5. Enregistrez.
6. Icône **avion** (Marquer comme envoyée) → « Copier le texte » → collez-le dans WhatsApp.

**Bon à savoir** : une commande envoyée ne se modifie plus. Annulez-la (icône **flèche retour**) et refaites-en une.

## 8. Recevoir une livraison

1. Menu **Réceptions** → « Nouvelle réception ».
2. Choisissez le fournisseur.
3. Si une commande est attendue : touchez « Livrer CA-… » (les lignes se remplissent).
4. Scannez chaque article **tel que vous l'avez reçu** (le carton si c'est un carton).
5. Tapez la quantité et le prix payé (celui du bon de livraison).
6. Vérifiez sous la ligne : « = … boîtes à … F/boîte ».
7. Produit qui périme : tapez le n° de lot et la date.
8. Comparez le total avec le bon de livraison.
9. « Valider la réception ».

**Code inconnu** : « Créer le produit », remplissez la fiche, puis vous revenez à la réception.

**Attention** : une réception validée ne se modifie plus. Une erreur se corrige par une sortie de stock (§ 11) ou un inventaire (§ 12).

## 9. Payer un fournisseur

1. Menu **Fournisseurs**.
2. Sur le fournisseur : icône **billet** (Payer).
3. Montant, mode (espèces, TMoney, Flooz, virement), référence.
4. Payez une livraison précise, ou le solde global.
5. Enregistrez : le « Total dû » baisse.

**Voir ce qu'on doit** : icône **reçu** (Dettes) → chaque livraison, réglé, reste, date limite.
**Erreur de paiement** : dans Dettes, icône **flèche retour** sur le paiement, avec un motif.
**Prix d'achat d'un fournisseur** : icône **chariot** (Achats).

## 10. Produits qui périment

1. Menu **Péremptions** : les lots à surveiller (rouge = 3 jours ou moins).
2. Lot périmé ou abîmé : icône **cercle moins** (Retirer) → quantité → valider.

## 11. Sortir un produit du stock (casse, vol, don, retour fournisseur)

1. Menu **Sorties de stock**.
2. Scannez ou cherchez le produit.
3. Quantité, motif (Défectueux ou casse, Périmé, Vol constaté, Don), commentaire.
4. À renvoyer au fournisseur ? Cochez « Retour au fournisseur » : l'avoir attendu s'affiche.
5. « Valider la sortie ».
6. Quand le fournisseur rembourse : **Fournisseurs** → icône **reçu** (Dettes) → « Avoir reçu ». S'il refuse : « Refusé ».

## 12. Faire un inventaire

1. Menu **Inventaires** → « Ouvrir un inventaire » : tout le magasin, ou un rayon.
2. Scannez un produit (ou icône **Compter** sur sa ligne).
3. Comptez par cartons, lots, unités. Le total et l'écart s'affichent.
4. S'il y a un écart : choisissez le motif.
5. Enregistrez. Passez au suivant.
6. Tout est compté : « Valider l'inventaire » → le stock est corrigé, la perte en francs s'affiche.

**Bon à savoir** : un produit non compté garde son stock. Un recomptage remplace le précédent.

## 13. Dépenses

1. Menu **Dépenses** → « Nouvelle dépense ».
2. Catégorie, libellé, montant, référence du reçu.
3. Payée par :
   - « Fonds propres » : l'argent ne sort pas du tiroir ; choisissez la date ;
   - « Caisse (tiroir) » : l'argent sort des espèces de la caisse ouverte, daté d'aujourd'hui. Si
     plusieurs caisses sont ouvertes, choisissez laquelle.
4. Enregistrez.
5. Erreur : icône **flèche retour** (avec un motif), puis ressaisissez. Une dépense payée au tiroir
   s'annule seulement **avant la clôture** de sa caisse : l'argent revient alors dans le tiroir.
6. Nouvelle catégorie : bouton « Catégories ».

**Bon à savoir** : la caissière peut aussi payer une petite dépense depuis son tiroir (menu
« Dépenses »). Elle ne peut pas l'annuler : c'est vous qui le faites, avant sa clôture.

## 14. Rapports

1. Menu **Rapports de gestion**.
2. Choisissez l'onglet : Pertes, Valeur du stock, Achats, Résultat.
3. Changez les dates si besoin (par défaut : le mois en cours).
4. « Exporter » pour l'avoir dans Excel.

**Bon à savoir** : la marge et le résultat arrivent avec une prochaine version.

## 15. À la caisse

**Code du gérant** : remise, annulation, retour d'une caissière → tapez votre code sur sa caisse.

**Mettre ou retirer des espèces du tiroir**
1. Dans la caisse : « Espèces du tiroir ».
2. Apport (ex. monnaie) ou retrait (ex. versement à la banque), montant, motif.
3. Validez : le tiroir s'ouvre.

**Clôturer la caisse d'une caissière absente**
1. Menu **Clôture de caisse** → choisissez sa caisse.
2. Comptez le tiroir, tapez le montant, expliquez l'écart s'il y en a un.
3. « Clôturer et imprimer le Z ».

**Vendre** : comme la caissière (voir le guide de la caissière), sans code à taper.

## 16. Imprimante

1. Menu **Réglages matériel**.
2. « Imprimer le test » : les accents doivent être justes.
3. « Ouvrir le tiroir » : le tiroir s'ouvre.
4. Problème ? Ne changez pas les réglages vous-même : appelez le technicien.

## 17. Sauvegarde

1. Une sauvegarde se fait seule à chaque clôture de caisse.
2. Pour en faire une tout de suite : menu **Sauvegardes** → « Sauvegarder maintenant ».
3. Laissez la clé USB des sauvegardes branchée.

## 18. Fermer l'application

L'application occupe tout l'écran et s'ouvre seule quand l'ordinateur s'allume. La caissière ne peut
pas la fermer. Pour la fermer (à la demande du technicien, par exemple) : en bas du menu, touchez
« Quitter l'application », puis confirmez. Pour la rouvrir : l'icône « Ma Boutique POS » du bureau.
