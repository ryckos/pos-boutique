# Fiche de test — Gérant

| Nom | Date | Version |
|-----|------|---------|
| | | 1.0.0-rc.1 |

**Comment remplir**
- Faites les lignes dans l'ordre. Utilisez les vrais produits de la boutique.
- Cochez **OK** si vous voyez ce qui est écrit. Sinon cochez **Non** et notez ce que vous voyez.
- Une icône ne vous dit rien ? Passez la souris dessus, ou gardez le doigt appuyé dessus. Le bouton **?** à côté du titre de chaque page explique toutes les icônes.

---

## 1. Connexion

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 1.1 | Touchez votre nom, tapez le code provisoire donné par la patronne | On vous demande de choisir votre code | ☐ OK ☐ Non | |
| 1.2 | Choisissez votre code, deux fois | Le menu du gérant s'affiche (sans « Comptes », « Journal », « Paramètres ») | ☐ OK ☐ Non | |

## 2. Catégories et produits

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 2.1 | **Catégories** → « Créer une catégorie » : un rayon (ex. Boissons) | Le rayon apparaît | ☐ OK ☐ Non | |
| 2.2 | Sur ce rayon, icône **+** : ajoutez un sous-rayon | Le sous-rayon apparaît en retrait | ☐ OK ☐ Non | |
| 2.3 | **Produits** → « Importer depuis Excel » → « Télécharger le modèle » | Le fichier modèle s'enregistre | ☐ OK ☐ Non | |
| 2.4 | Remplissez le modèle avec vos produits, puis « Vérifier le fichier » | Chaque ligne : « À créer », « Ignorée » ou « Erreur » | ☐ OK ☐ Non | |
| 2.5 | Corrigez les erreurs dans Excel, vérifiez à nouveau, puis « Importer » | « N produits importés » ; ils sont dans la liste | ☐ OK ☐ Non | |
| 2.6 | « Nouveau produit » : nom, rayon, TVA, prix de l'Unité, code-barres (scannez-le) | Le produit est créé | ☐ OK ☐ Non | |
| 2.7 | Ouvrez le produit (icône **crayon**), « Ajouter un conditionnement » : Carton de 24 avec son prix | Le carton est enregistré | ☐ OK ☐ Non | |
| 2.8 | Pour un produit sans code, icône **code-barres** : générez un code | Un code commençant par 20 | ☐ OK ☐ Non | |
| 2.9 | Changez le prix d'un produit | Le nouveau prix s'affiche dans la liste et à la caisse | ☐ OK ☐ Non | |
| 2.10 | Dans « Rechercher », tapez un nom sans accent (ex. « pate ») | Le produit avec accent est trouvé | ☐ OK ☐ Non | |

## 3. Stock de départ

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 3.1 | **Stock initial** : sur un produit, icône **Compter** | Une fenêtre de comptage | ☐ OK ☐ Non | |
| 3.2 | Comptez ce qu'il y a en rayon (cartons, lots, unités) et saisissez le coût d'achat par unité | Le total en unités s'affiche ; le produit passe en « Compté » | ☐ OK ☐ Non | |
| 3.3 | Faites de même pour tous les produits du rayon | Le compteur « x / y produits comptés » avance | ☐ OK ☐ Non | |

## 4. Stock

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 4.1 | **Stock** | Chaque produit avec son stock, sa valeur, et la valeur totale en haut | ☐ OK ☐ Non | |
| 4.2 | « Afficher : Ruptures et stocks bas » | Seuls les produits sous leur seuil | ☐ OK ☐ Non | |
| 4.3 | Sur un produit vendu, icône **horloge** (historique) | Chaque entrée et sortie, avec qui, quand et le n° du ticket | ☐ OK ☐ Non | |

## 5. Fournisseurs et commandes

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 5.1 | **Fournisseurs** → « Créer un fournisseur » : nom, téléphone, délai de paiement | Le fournisseur apparaît, « Total dû : 0 F » | ☐ OK ☐ Non | |
| 5.2 | **Commandes** → « Nouvelle commande » : choisissez le fournisseur, ajoutez des produits | Sous un carton : « = … boîtes » (le calcul est fait pour vous) | ☐ OK ☐ Non | |
| 5.3 | Cliquez sur « Proposer depuis les alertes » | La liste des produits en rupture ou stock bas | ☐ OK ☐ Non | |
| 5.4 | Enregistrez, puis icône **avion** (Marquer comme envoyée) → « Copier le texte » | Le texte se colle dans WhatsApp | ☐ OK ☐ Non | |

## 6. Réception d'une livraison

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 6.1 | **Réceptions** → « Nouvelle réception » : choisissez le fournisseur | Si une commande est attendue : « Livrer CA-… » | ☐ OK ☐ Non | |
| 6.2 | Scannez un carton, quantité, prix payé | Sous la ligne : « = … boîtes à … F/boîte » | ☐ OK ☐ Non | |
| 6.3 | Pour un produit qui périme : saisissez le n° de lot et la date | Sans lot ni date, on ne peut pas valider | ☐ OK ☐ Non | |
| 6.4 | Scannez un code inconnu → « Créer le produit » | La fiche s'ouvre avec le code ; on revient ensuite à la réception | ☐ OK ☐ Non | |
| 6.5 | Comparez le total au bon de livraison, puis « Valider la réception » | Un numéro RC-… ; le stock augmente | ☐ OK ☐ Non | |
| 6.6 | **Fournisseurs** | Le total dû a augmenté du montant de la réception | ☐ OK ☐ Non | |

## 7. Payer un fournisseur

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 7.1 | Sur le fournisseur, icône **billet** (Payer) : un montant, le mode | Le total dû baisse | ☐ OK ☐ Non | |
| 7.2 | Icône **reçu** (Dettes) | Les livraisons, ce qui est réglé, ce qui reste, la date limite | ☐ OK ☐ Non | |
| 7.3 | Annulez un paiement (icône **flèche retour**, avec un motif) | Le paiement reste visible, marqué « Annulé » ; le dû remonte | ☐ OK ☐ Non | |
| 7.4 | Icône **chariot** (Achats) | Les livraisons et les derniers prix d'achat | ☐ OK ☐ Non | |

## 8. Péremptions

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 8.1 | **Péremptions** | Les lots qui périment bientôt : rouge (3 jours ou moins), orange sinon | ☐ OK ☐ Non | |
| 8.2 | Sur un lot périmé, icône **cercle moins** (Retirer) : quantité | Le lot sort du stock, compté en perte | ☐ OK ☐ Non | |

## 9. Sorties de stock

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 9.1 | **Sorties de stock** : scannez un produit abîmé | Une fenêtre de sortie | ☐ OK ☐ Non | |
| 9.2 | Quantité, motif « Défectueux ou casse », cochez « Retour au fournisseur » | « Avoir attendu : … F » ; le stock baisse | ☐ OK ☐ Non | |
| 9.3 | Dans **Fournisseurs** → Dettes, sur cet avoir : « Avoir reçu » | Le total dû baisse | ☐ OK ☐ Non | |

## 10. Inventaire

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 10.1 | **Inventaires** → « Ouvrir un inventaire » : un rayon | Un numéro INV-… et la liste des produits | ☐ OK ☐ Non | |
| 10.2 | Comptez chaque produit (icône **Compter**) par cartons, lots et unités | Le total converti et l'écart s'affichent | ☐ OK ☐ Non | |
| 10.3 | Pour un écart, choisissez le motif | Sans motif, on ne peut pas enregistrer | ☐ OK ☐ Non | |
| 10.4 | « Valider l'inventaire » | La perte en francs ; le stock est corrigé | ☐ OK ☐ Non | |

## 11. Dépenses

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 11.1 | **Dépenses** → « Nouvelle dépense » : catégorie, libellé, montant, « Fonds propres » | Un numéro DEP-… ; le total de la période augmente | ☐ OK ☐ Non | |
| 11.2 | Annulez-la (icône **flèche retour**, avec un motif) | Elle reste visible, « Annulée » ; le total baisse | ☐ OK ☐ Non | |

## 12. Caisse : ce que seul le gérant fait

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 12.1 | Quand la caisse demande « le code du gérant » (remise, annulation, retour), tapez votre code sur la caisse de la caissière | L'action passe, la caissière reste connectée | ☐ OK ☐ Non | |
| 12.2 | Dans la caisse, « Espèces du tiroir » : un apport (ex. monnaie) avec un motif | Le tiroir s'ouvre | ☐ OK ☐ Non | |
| 12.3 | **Clôture de caisse** : clôturez la caisse d'une caissière absente | Le rapport Z s'imprime | ☐ OK ☐ Non | |

## 13. Rapports et exports

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 13.1 | **Rapports de gestion** → onglet Pertes | Les pertes du mois par cause (péremption, casse, inventaire…) | ☐ OK ☐ Non | |
| 13.2 | Onglets Valeur du stock, Achats, Résultat | Les chiffres s'affichent (la marge : « en attente », normal) | ☐ OK ☐ Non | |
| 13.3 | Sur Stock, cliquez sur « Exporter » | Le fichier s'ouvre dans Excel avec toute la liste | ☐ OK ☐ Non | |

## 14. Imprimante et sauvegarde

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 14.1 | **Réglages matériel** → « Imprimer le test en cp1252 » | « éèêàçùôî ÉÇ € » justes sur le papier | ☐ OK ☐ Non | |
| 14.2 | « Ouvrir le tiroir » | Le tiroir s'ouvre | ☐ OK ☐ Non | |
| 14.3 | **Sauvegardes** → « Sauvegarder maintenant » | Une nouvelle ligne dans la liste | ☐ OK ☐ Non | |

## 15. Vendre

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 15.1 | Le gérant peut aussi vendre : faites la **fiche Caissier**, parties 2 à 4 | Mêmes résultats, sans code de gérant demandé | ☐ OK ☐ Non | |

---

**Problèmes rencontrés** (écrivez ici, ou au dos) :

______________________________________________________________________

______________________________________________________________________

Signature :
