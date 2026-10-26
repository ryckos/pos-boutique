# Fiche de test — Caissière / Caissier

| Nom | Date | Version |
|-----|------|---------|
| | | 1.0.0-rc.1 |

**Comment remplir**
- Faites les lignes dans l'ordre, avec de vrais articles.
- Cochez **OK** si vous voyez ce qui est écrit. Sinon cochez **Non** et notez ce que vous voyez.
- Pour les lignes marquées **gérant**, appelez le gérant : il tape son code sur votre caisse.

---

## 1. Connexion

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 1.1 | Touchez votre nom, tapez le code provisoire donné par la patronne | On vous demande de choisir votre code | ☐ OK ☐ Non | |
| 1.2 | Choisissez votre code, deux fois | Le menu : Caisse, Clôture de caisse, Mon code | ☐ OK ☐ Non | |
| 1.3 | **Mon code** : changez votre code | « Code changé » ; le nouveau code marche | ☐ OK ☐ Non | |

## 2. Ouvrir la caisse

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 2.1 | **Caisse** → « Ouvrir la caisse » : comptez le fond de caisse et tapez le montant | L'écran de vente, ticket vide | ☐ OK ☐ Non | |

## 3. Vendre

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 3.1 | Scannez un article | La ligne apparaît tout de suite, avec son prix | ☐ OK ☐ Non | |
| 3.2 | Scannez le même article une 2ᵉ fois | La quantité passe à 2 (pas de nouvelle ligne) | ☐ OK ☐ Non | |
| 3.3 | Scannez un carton | La ligne porte « Carton de … » | ☐ OK ☐ Non | |
| 3.4 | Touchez un bouton d'article (ex. Baguette) | La ligne apparaît | ☐ OK ☐ Non | |
| 3.5 | Touche **F2**, tapez un nom sans accent, choisissez l'article | La ligne apparaît | ☐ OK ☐ Non | |
| 3.6 | Touchez une ligne : **+**, puis **−** | La quantité et le total changent | ☐ OK ☐ Non | |
| 3.7 | Touchez une ligne → « Changer le conditionnement » → choisissez l'unité | La ligne et le prix changent | ☐ OK ☐ Non | |
| 3.8 | Touchez une ligne → « Supprimer la ligne » | La ligne disparaît | ☐ OK ☐ Non | |
| 3.9 | Regardez l'écran client | Le client voit les articles et le total | ☐ OK ☐ Non | |

## 4. Encaisser

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 4.1 | **Espèces (F4)** : tapez le montant reçu → « Encaisser » | La monnaie à rendre en grand ; le ticket s'imprime ; le tiroir s'ouvre | ☐ OK ☐ Non | |
| 4.2 | Nouvelle vente → **TMoney** sans référence | On ne peut pas encaisser : la référence est demandée | ☐ OK ☐ Non | |
| 4.3 | Tapez la référence de la transaction → « Encaisser » | Le ticket s'imprime ; le tiroir **ne s'ouvre pas** | ☐ OK ☐ Non | |
| 4.4 | Nouvelle vente : une partie en espèces, le reste en Flooz | Encaissé seulement quand la somme fait le total | ☐ OK ☐ Non | |

## 5. Mettre un client en attente

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 5.1 | Avec des articles au ticket : **F8** (Mettre en attente) | Le ticket vide ; le ticket en attente reste affiché | ☐ OK ☐ Non | |
| 5.2 | Servez un autre client et encaissez | Vente normale | ☐ OK ☐ Non | |
| 5.3 | Touchez « Reprendre le ticket » | Les articles du 1er client reviennent | ☐ OK ☐ Non | |

## 6. Remise (gérant)

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 6.1 | Touchez une ligne → « Faire une remise » : un montant | Si la caisse demande le code : le **gérant** le tape | ☐ OK ☐ Non | |
| 6.2 | Regardez le ticket | Le prix, la remise et le nouveau total | ☐ OK ☐ Non | |

## 7. Ticket : réimprimer, facture, proforma

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 7.1 | « Réimprimer un ticket » : le n° du dernier ticket | Le ticket sort avec « DUPLICATA » | ☐ OK ☐ Non | |
| 7.2 | « Faire une facture » : le n° du ticket, le nom du client → PDF ou impression | La facture avec le montant en lettres et « Payée » | ☐ OK ☐ Non | |
| 7.3 | Mettez des articles au ticket → « Proforma » → PDF, puis « Vider le ticket » | Une proforma PF-…, valable 30 jours | ☐ OK ☐ Non | |
| 7.4 | « Reprendre une proforma » : son numéro | Les articles reviennent au ticket | ☐ OK ☐ Non | |

## 8. Retour d'un client (gérant)

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 8.1 | « Retour client » : le n° du ticket | Les articles du ticket | ☐ OK ☐ Non | |
| 8.2 | Cochez l'article rendu, le motif, « Remettre en stock » ou « Détruire », le mode de remboursement | Le montant à rendre | ☐ OK ☐ Non | |
| 8.3 | Le **gérant** tape son code → valider | Ticket « RETOUR CLIENT » imprimé ; le tiroir s'ouvre si espèces | ☐ OK ☐ Non | |

## 9. Annuler un ticket (gérant)

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 9.1 | « Annuler un ticket » : le n° d'un ticket du jour, un motif | Ce qu'il faut rendre au client | ☐ OK ☐ Non | |
| 9.2 | Le **gérant** tape son code → valider | Le ticket est annulé ; le tiroir s'ouvre si espèces | ☐ OK ☐ Non | |

## 10. Si l'imprimante ne marche pas

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 10.1 | Éteignez l'imprimante, puis encaissez une vente | La vente est enregistrée et la caisse n'est pas bloquée | ☐ OK ☐ Non | |
| 10.2 | Rallumez l'imprimante | Le ticket sort, ou un message propose « Réimprimer » : touchez-le | ☐ OK ☐ Non | |

## 11. Fermer la caisse le soir

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 11.1 | Encaissez ou videz tous les tickets en attente | Plus aucun ticket en attente | ☐ OK ☐ Non | |
| 11.2 | **Clôture de caisse** → « Imprimer le rapport X » | Le rapport « Provisoire » s'imprime | ☐ OK ☐ Non | |
| 11.3 | Comptez les espèces du tiroir et tapez le montant | L'écart s'affiche (vert si juste, rouge s'il manque) | ☐ OK ☐ Non | |
| 11.4 | S'il y a un écart, écrivez un commentaire | Sans commentaire, on ne peut pas clôturer | ☐ OK ☐ Non | |
| 11.5 | « Clôturer et imprimer le Z » | Le rapport Z s'imprime ; on ne peut plus vendre sur cette caisse | ☐ OK ☐ Non | |
| 11.6 | Se déconnecter | La liste des noms | ☐ OK ☐ Non | |

---

**Problèmes rencontrés** (écrivez ici, ou au dos) :

______________________________________________________________________

______________________________________________________________________

Signature :
