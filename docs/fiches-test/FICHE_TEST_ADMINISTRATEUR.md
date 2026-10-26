# Fiche de test — Administrateur (la patronne)

| Nom | Date | Version |
|-----|------|---------|
| | | 1.0.0-rc.1 |

**Comment remplir**
- Faites les lignes dans l'ordre.
- Cochez **OK** si vous voyez ce qui est écrit. Sinon cochez **Non** et notez ce que vous voyez.
- Une icône ne vous dit rien ? Passez la souris dessus, ou gardez le doigt appuyé dessus. Le bouton **?** en haut de chaque page explique toutes les icônes.

---

## 1. Premier démarrage

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 1.1 | Ouvrez l'application pour la première fois | Une page « Créer le compte administrateur » | ☐ OK ☐ Non | |
| 1.2 | Tapez votre nom, puis votre code à 4 chiffres deux fois | Le menu complet s'affiche | ☐ OK ☐ Non | |
| 1.3 | Cliquez sur « Se déconnecter », puis touchez votre nom et tapez votre code | Vous êtes reconnectée | ☐ OK ☐ Non | |

## 2. Paramètres de la boutique

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 2.1 | Menu **Paramètres** → crayon « Boutique et ticket » : saisissez le nom, l'adresse, le NIF et le message du bas du ticket | « Enregistré » | ☐ OK ☐ Non | |
| 2.2 | Crayon « Caisse » : fixez la remise maximale de la caissière (ou laissez vide) | La valeur s'affiche | ☐ OK ☐ Non | |
| 2.3 | Crayon « Stock » : vérifiez le nombre de jours pour les péremptions | La valeur s'affiche | ☐ OK ☐ Non | |

## 3. Comptes des employés

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 3.1 | Menu **Comptes utilisateurs** → « Créer un compte » : le gérant, rôle Gérant, code provisoire `1111` | Le compte apparaît, avec « Code provisoire » | ☐ OK ☐ Non | |
| 3.2 | Créez chaque caissière, rôle Caissier, code provisoire `2222` | Les comptes apparaissent | ☐ OK ☐ Non | |
| 3.3 | Déconnectez-vous. Le gérant touche son nom et tape `1111` | On lui demande de choisir **son propre code** | ☐ OK ☐ Non | |
| 3.4 | Reconnectez-vous. Sur une caissière, icône **clé** : donnez un nouveau code provisoire | L'ancien code de la caissière ne marche plus | ☐ OK ☐ Non | |
| 3.5 | Icône **personne** : changez le rôle d'un compte, puis remettez-le | Le rôle change dans la liste | ☐ OK ☐ Non | |
| 3.6 | Essayez de désactiver **votre propre** compte | C'est refusé | ☐ OK ☐ Non | |
| 3.7 | Créez un compte « Essai », puis désactivez-le (icône **cercle barré**, avec un motif) | « Désactivé » ; il n'apparaît plus à la connexion | ☐ OK ☐ Non | |

## 4. Sécurité des codes

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 4.1 | À la connexion, touchez le nom d'une caissière et tapez 5 fois un code faux | Le compte est bloqué 30 secondes | ☐ OK ☐ Non | |
| 4.2 | Pendant ce temps, connectez-vous avec votre nom | Ça marche : les autres comptes ne sont pas bloqués | ☐ OK ☐ Non | |
| 4.3 | Menu **Mon code** : changez votre code, déconnectez-vous, reconnectez-vous avec le nouveau | Le nouveau code marche, l'ancien non | ☐ OK ☐ Non | |

## 5. Journal des opérations

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 5.1 | Menu **Journal des opérations** | Les actions des tests ci-dessus (comptes, paramètres, blocage), en français | ☐ OK ☐ Non | |
| 5.2 | Filtrez par personne, puis par action | Seules les lignes choisies restent | ☐ OK ☐ Non | |
| 5.3 | Cliquez sur « Exporter » et enregistrez | Le fichier s'ouvre dans Excel | ☐ OK ☐ Non | |

## 6. Sauvegardes

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 6.1 | Branchez la clé USB des sauvegardes. Menu **Sauvegardes** → « Choisir la clé USB » → choisissez son dossier | « Branchée » | ☐ OK ☐ Non | |
| 6.2 | Cliquez sur « Sauvegarder maintenant » | Une nouvelle ligne « Sauvegarde manuelle » ; le fichier est aussi sur la clé | ☐ OK ☐ Non | |
| 6.3 | Le soir, après la clôture de la caisse : ouvrez **Sauvegardes** | Une ligne « Clôture de caisse » | ☐ OK ☐ Non | |
| 6.4 | **Restaurer une sauvegarde : ne le faites pas seule.** Uniquement avec le technicien | — | ☐ Fait avec le technicien | |

## 7. Le reste de l'application

| N° | À faire | Vous devez voir | Résultat | Remarque |
|----|---------|-----------------|----------|----------|
| 7.1 | Vous avez accès à tout : faites aussi la **fiche Gérant**, au moins les parties 2 (produits), 6 (réception) et 13 (rapports) | Mêmes résultats que pour le gérant | ☐ OK ☐ Non | |

---

**Problèmes rencontrés** (écrivez ici, ou au dos) :

______________________________________________________________________

______________________________________________________________________

Signature :
