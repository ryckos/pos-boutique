# Scénario de référence — une semaine à « Ma Boutique »

Ce scénario a été présenté et validé avec les maquettes. Il sert de **référence de recette** : à la
fin de chaque phase, l'application doit le reproduire, et les chiffres attendus doivent sortir **au
franc près**. Chaque étape est aussi un bon cas de test automatique.

**Personnages**
- **Patron** : administrateur, PIN `1234`.
- **Kossi** : gérant, PIN `5678`.
- **Afi** : caissière, PIN `0000`.

---

## Dimanche soir — Initialisation (Phase 1, B3 et B6)
- Le Patron importe le catalogue depuis Excel (nom, code-barres, prix d'achat, prix de vente,
  catégorie). L'application crée un conditionnement « Unité » par ligne.
- Il saisit le stock initial en comptant les rayons. L'application génère des mouvements
  `ajustement_inventaire` avec le document `stock_initial`, et initialise le CUMP.
- **Attendu** : chaque produit a un stock et un CUMP, et son historique montre une ligne
  « stock initial ».

## Lundi 8 h — Livraison du grossiste (Phase 2, B8)
Le fournisseur est le Grossiste Hédzranawoé, avec un délai de paiement de 15 jours.

| Ligne | Saisie                                                        | Conversion attendue                 |
|-------|---------------------------------------------------------------|-------------------------------------|
| 1     | Tomate concentrée — **Carton de 24**, qté **3**, prix **6 000** | +72 boîtes, coût 250 F/boîte, 18 000 F |
| 2     | Lait en poudre 400 g, qté **12**, prix **2 100**, lot **LOT-B03**, péremption saisie | +12, lot créé, 25 200 F |
| 3     | **Code inconnu** `6034000012345` → création de « Jus d'ananas Fruity 1L » | voir ci-dessous |

Création du nouveau produit, jus d'ananas Fruity 1 L :
- catégorie Boissons, TVA 18 %, suivi de péremption, seuil d'alerte 6 ;
- conditionnements :
  - **Unité** ×1 à **600 F** (code scanné) ;
  - **Pack de 6** ×6 à **3 300 F**, sans code, en bouton tactile.

À la validation, la réception reçoit le numéro RC. On attend :
- le stock de tomate à +72 ;
- le CUMP de la tomate à 250 (premier arrivage) ;
- la dette fournisseur égale au total de la réception ;
- des lots créés pour les produits périssables.

## Lundi 10 h — Vente mixte (Phase 1, A1 à A3)
Afi ouvre sa session de caisse avec un fond de **10 000 F**. Ticket **T-2026-000158** :

| Article                                     | Moyen de saisie                   | Montant  |
|---------------------------------------------|-----------------------------------|----------|
| Tomate concentrée — Carton de 24            | scan du code du carton            | 7 500    |
| Tomate concentrée — Lot de 3                | bouton tactile                    | 1 000    |
| 2 × Tomate concentrée (unité)               | scan ×2                           | 700      |
| Baguette                                    | bouton ou PLU `101`               | 300      |
| Jus d'ananas Fruity 1L                      | scan                              | 600      |
| **Total**                                   |                                   | **10 100 F** |

Stock de tomate sorti : 24 + 3 + 2 = **29 boîtes**.

Marge sur la tomate, au CUMP de 250 :
- carton : 7 500 − 24×250 = **1 500** ;
- lot : 1 000 − 3×250 = **250** ;
- unités : 700 − 2×250 = **200**.

La vente est payée en espèces. Le ticket s'imprime et le tiroir s'ouvre.

## Mardi — Péremptions (Phase 2, B9)
Tableau « sous 15 jours », pour une valeur totale en jeu de **24 300 F** :

| Lot                       | Échéance | Restant  | Valeur   | Couleur |
|---------------------------|----------|----------|----------|---------|
| Yaourt nature · LOT-Y07   | 3 jours  | 18 pots  | 5 400 F  | rouge   |
| Lait en poudre · LOT-A12  | 8 jours  | 9 boîtes | 18 900 F | ambre   |

- Le Patron lance une promotion de −20 % sur le yaourt.
- Le FEFO vend d'abord le lot LOT-A12 avant le lot LOT-B03, plus récent.

## Mercredi — Produits défectueux (Phase 3, B11)
Deux boîtes de tomate sont bombées au rayon. Le gérant enregistre une sortie de stock :
- quantité **2**, motif « Défectueux / casse » ;
- **retour fournisseur coché**.

On attend :
- un mouvement `retour_fournisseur` de −2 ;
- un **avoir attendu de 500 F** (2 × 250) auprès du Grossiste Hédzranawoé.

## Jeudi — Retour client (Phase 2, A7)
Un client rapporte le jus d'ananas du ticket T-2026-000158, qui est défectueux. Le retour se fait
ainsi :
- recherche du ticket et sélection de la ligne du jus (600 F) ;
- motif « Produit défectueux », sort du produit « Détruire » ;
- remboursement en espèces de 600 F.

On attend :
- un ticket de type `retour` lié au ticket T-2026-000158 ;
- un paiement de −600 F ;
- les mouvements `retour_client` (+1) puis `casse` (−1).

Le ticket d'origine n'est pas modifié.

## Vendredi soir — Clôture de caisse (Phase 1, A4)
Pendant la journée, la session d'Afi a enregistré :
- un encaissement de créance de Mme Abra, de 3 500 F en espèces ;
- une dépense de taxi-moto payée au tiroir, de 1 000 F.

| Mode de paiement | Total ventes |
|------------------|--------------|
| Espèces          | 46 200       |
| TMoney           | 22 500       |
| Flooz            | 8 000        |
| Crédit           | 8 400        |

| Calcul des espèces théoriques      | Montant   |
|------------------------------------|-----------|
| Fond d'ouverture                   | 10 000    |
| + Ventes en espèces                | 46 200    |
| + Encaissement de créance          | 3 500     |
| − Dépense                          | 1 000     |
| **= Espèces théoriques**           | **58 700**|
| Espèces comptées                   | 58 200    |
| **Écart**                          | **−500**  |

L'écart est enregistré avec un commentaire, et le Z est imprimé.

## Samedi — Inventaire du rayon conserves et entretien (Phase 3, B12)
Inventaire **INV-2026-0007** :

| Produit           | Théorique | Comptage                           | Converti | Écart | Motif                   |
|-------------------|-----------|------------------------------------|----------|-------|-------------------------|
| Tomate concentrée | 41 boîtes | 1 carton + 5 lots + 2 unités       | 41       | 0     | —                       |
| Savon de ménage   | 29        | 27 unités                          | 27       | −2    | Vol présumé (obligatoire) |

À la validation :
- un mouvement `ajustement_inventaire` de −2 sur le savon ;
- une **démarque de 300 F** (2 × 150) ;
- le détail du comptage conservé.

## Dimanche — Ce que le Patron doit pouvoir répondre (Phase 4)
- « **Pourquoi reste-t-il 41 boîtes de tomate ?** » : l'historique du produit, mouvement par
  mouvement, avec l'utilisateur et le document de chacun.
- « **Où sont passés les 500 F du tiroir de vendredi ?** » : la session d'Afi, avec son écart et
  son commentaire.
- « **Combien m'ont coûté les pertes ce mois-ci ?** » : le rapport des pertes par cause.

---

## Évolution du CUMP (Phase 2, B8, test obligatoire)
Il reste 46 boîtes de tomate à 250 F. Arrivent 2 cartons à 6 600 F, soit 48 boîtes à 275 F :
```
(46 × 250 + 48 × 275) / (46 + 48) = 24 700 / 94 = 262,77… ≈ 262,8
```
La marge d'un carton vendu 7 500 F passe de 1 500 à 7 500 − 24 × 262,77 ≈ **1 193 F**.
