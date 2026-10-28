# Guide de la caissière / du caissier

Ma Boutique POS — version 1.0.0-rc.1

## L'écran en bref

- **À gauche** : le menu (Caisse, Clôture de caisse, Mon code).
- **Une icône ?** Gardez le doigt appuyé dessus : son nom s'affiche.
- **« Code du gérant » demandé ?** Appelez le gérant : il tape son code sur votre caisse.

## Raccourcis du clavier

| Touche | Action |
|--------|--------|
| F2 | Chercher un article par son nom ou son code court |
| F4 | Encaisser en espèces |
| F8 | Mettre le ticket en attente |
| + / − | Augmenter / diminuer la quantité de la ligne choisie |
| Suppr | Supprimer la ligne choisie |
| Échap | Fermer la fenêtre ouverte |

---

## 1. Se connecter

1. Touchez votre nom.
2. Tapez votre code à 4 chiffres.
3. **Première fois** : tapez le code donné par la patronne, puis choisissez votre propre code (deux fois).

**Bon à savoir** : 5 codes faux bloquent votre compte quelques minutes. Attendez, puis réessayez.

## 2. Changer son code

1. Menu **Mon code**.
2. Tapez votre code actuel.
3. Tapez le nouveau code deux fois.
4. Touchez « Changer mon code ».

## 3. Ouvrir la caisse (le matin)

1. Menu **Caisse**.
2. Touchez « Ouvrir la caisse ».
3. Comptez les espèces du tiroir (le fond de caisse) et tapez le montant.
4. Validez : vous pouvez vendre.

## 4. Vendre

1. Scannez chaque article.
   - Même article scanné deux fois : la quantité passe à 2.
   - Article sans code (pain, gari…) : touchez son bouton, en bas, dans l'onglet de son rayon.
   - Article introuvable : touche **F2**, tapez son nom (les accents ne comptent pas), choisissez-le.
2. Vérifiez le total en bas du ticket.

**Bon à savoir** : un code inconnu affiche un message. Mettez l'article de côté, continuez la vente, et prévenez le gérant.

## 5. Corriger le ticket

1. Touchez la ligne à corriger.
2. Choisissez :
   - **− / +** : changer la quantité ;
   - **Changer le conditionnement** : par exemple, vous avez scanné une boîte au lieu du carton ;
   - **Faire une remise** : voir § 8 ;
   - **Supprimer la ligne**.
3. Pour tout effacer : « Vider le ticket ».

## 6. Encaisser

**En espèces**
1. Touchez « Espèces (F4) ».
2. Tapez le montant donné par le client (ou touchez un billet).
3. Touchez « Encaisser ».
4. Rendez la monnaie affichée en grand. Le ticket sort, le tiroir s'ouvre.

**En TMoney ou Flooz**
1. Touchez « TMoney » ou « Flooz ».
2. Tapez la **référence de la transaction** (obligatoire).
3. Touchez « Encaisser ».

**En plusieurs fois** (une partie en espèces, le reste en mobile money)
1. Ouvrez le paiement.
2. Ajoutez un second mode de paiement.
3. Répartissez les montants : la somme doit faire le total.
4. Touchez « Encaisser ».

**Bon à savoir** : « Crédit » n'est pas encore disponible.

## 7. Mettre un client en attente

1. Le client a oublié quelque chose : touchez « Mettre en attente » (F8).
2. Servez le client suivant.
3. Quand il revient : touchez « Reprendre le ticket … ».

## 8. Faire une remise

1. Touchez la ligne (ou « Remise sur le ticket » pour tout le ticket).
2. Touchez « Faire une remise ».
3. Tapez le montant en francs.
4. Si la caisse le demande : le **gérant** tape son code.

## 9. Réimprimer un ticket

1. Touchez « Réimprimer un ticket ».
2. Tapez son numéro (ex. `158`).
3. Le ticket sort avec la mention DUPLICATA.

## 10. Faire une facture

1. Le client a payé et veut une facture : touchez « Faire une facture ».
2. Tapez le numéro du ticket.
3. Tapez le nom du client (et son téléphone, son adresse, son NIF s'il les donne).
4. Choisissez « PDF » ou « Imprimer ».

**Bon à savoir** : une seule facture par ticket. Pour la ressortir, tapez à nouveau le numéro du ticket : elle sort avec la mention COPIE.

## 11. Faire une proforma (devis)

1. Mettez les articles au ticket, comme pour une vente.
2. Touchez « Proforma ».
3. Tapez le nom du client (facultatif), puis PDF ou impression.
4. Touchez « Vider le ticket ».

**Quand le client revient acheter**
1. Touchez « Reprendre une proforma ».
2. Tapez son numéro.
3. Les articles reviennent au ticket, **aux prix du jour**. Encaissez.

## 12. Retour d'un article par un client

1. Touchez « Retour client ».
2. Tapez le numéro du ticket d'achat.
3. Cochez l'article rendu et sa quantité.
4. Choisissez le motif.
5. Choisissez : « Remettre en stock » (article bon) ou « Détruire » (article abîmé).
6. Choisissez comment rembourser : espèces, TMoney ou Flooz.
7. Le **gérant** tape son code.
8. Validez : le ticket de retour sort, rendez l'argent.

## 13. Annuler un ticket (erreur du jour)

1. Touchez « Annuler un ticket ».
2. Tapez le numéro du ticket.
3. Tapez le motif.
4. Le **gérant** tape son code.
5. Validez, puis rendez au client le montant affiché.

**Bon à savoir** : seulement pour un ticket de la caisse ouverte. Après la clôture, faites un retour (§ 12).

## 14. Si l'imprimante ne marche pas

1. Continuez à vendre : la vente est enregistrée, la caisse n'est jamais bloquée.
2. Vérifiez le papier et le câble, puis rallumez l'imprimante.
3. Touchez « Réimprimer » dans le message, ou réimprimez le ticket (§ 9).

## 15. Payer une dépense depuis le tiroir

Exemple : un taxi-moto pour une livraison.

1. Menu **Dépenses** → « Nouvelle dépense ».
2. Catégorie, à quoi sert la dépense (ex. : « taxi-moto »), montant, numéro du reçu s'il y en a un.
3. Touchez « Enregistrer la dépense ». Le montant sort des espèces de votre caisse et apparaît sur le
   rapport X et le Z.

**Bon à savoir** : votre caisse doit être ouverte. Vous ne pouvez pas sortir plus que ce qu'il y a dans le
tiroir. En cas d'erreur, demandez au gérant de l'annuler **avant** de fermer la caisse.

## 16. Fermer la caisse (le soir)

1. Encaissez ou videz tous les tickets en attente.
2. Menu **Clôture de caisse**.
3. (Facultatif) Touchez « Imprimer le rapport X » pour voir où vous en êtes.
4. Comptez les espèces du tiroir et tapez le montant.
5. Regardez l'écart : vert = juste, rouge = il manque, orange = il y a trop.
6. S'il y a un écart : écrivez une explication (obligatoire).
7. Touchez « Clôturer et imprimer le Z ». Donnez le Z au gérant.
8. Touchez « Se déconnecter ».
