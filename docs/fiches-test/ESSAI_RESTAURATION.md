# Essai de restauration sur le terminal de la boutique

| Technicien | Date | Version installée | Terminal |
|------------|------|-------------------|----------|
| | | 1.0.0-rc.1 | OMA POS M120w |

**But** : prouver, sur le vrai terminal, qu'une sauvegarde de la boutique se restaure et redonne
exactement les mêmes chiffres : depuis la liste, depuis la clé USB, à la main quand l'application ne
démarre plus, et après une coupure de courant (règles : `REGLES_METIER.md` § 14 ; procédures :
`DEPLOIEMENT.md` § 7.3 et § 8).

**Règle d'or : la vraie base de la boutique n'est jamais touchée.** Tout l'essai se joue sur une
**copie** de sa dernière sauvegarde, dans un dossier à part (`C:\EssaiRestauration`), avec
l'application installée lancée par le script `lancer-essai-restauration.cmd`. On vérifie à la fin,
par son empreinte, que la vraie base n'a pas changé d'un octet.

**Quand** : en dehors des heures d'ouverture (environ 1 h 30). Les essais 7 et 8 coupent le
courant du terminal.

**Avec qui** : la patronne, ou quelqu'un qui connaît un **code administrateur** de la boutique (la
copie contient les vrais comptes et les vrais codes).

**Apporter** :
- la **clé USB des sauvegardes** de la boutique ;
- une seconde clé avec le script `scripts\lancer-essai-restauration.cmd` du dépôt ;
- cette fiche imprimée, un stylo, un chronomètre (téléphone).

**Comment remplir** : faire les étapes dans l'ordre ; cocher **OK** si l'on voit ce qui est attendu,
sinon **Non** et noter ce que l'on voit (photo de l'écran). Un **Non** arrête l'essai : passer
directement à la partie 4 (remise en état) et transmettre la fiche aux développeurs.

Dans cette fiche, `E:` désigne la clé USB des sauvegardes : remplacer par sa vraie lettre.

---

## 1. Préparer (application fermée)

| N° | À faire | Attendu | Résultat | Remarque |
|----|---------|---------|----------|----------|
| 1.1 | Clôturer les caisses ouvertes, fermer l'application. Gestionnaire des tâches : aucun « Ma Boutique POS » ne tourne | Plus rien ne tourne | ☐ OK ☐ Non | |
| 1.2 | PowerShell : `Get-FileHash "$env:APPDATA\Ma Boutique POS\boutique.db"`. Recopier ici les **8 premiers** et les **8 derniers** caractères de l'empreinte | Empreinte notée : `________ … ________` | ☐ OK ☐ Non | |
| 1.3 | Créer le dossier `C:\EssaiRestauration`. Dans `%APPDATA%\Ma Boutique POS\sauvegardes`, **copier** (pas déplacer) la sauvegarde la plus récente (`boutique_AAAA-MM-JJ_HHMMSS_cloture.db` de préférence) dans `C:\EssaiRestauration`, puis renommer la copie `boutique.db` | `C:\EssaiRestauration\boutique.db` existe ; le fichier d'origine est toujours dans `sauvegardes` | ☐ OK ☐ Non | Fichier copié : |
| 1.4 | Copier `lancer-essai-restauration.cmd` sur le Bureau | — | ☐ OK ☐ Non | |
| 1.5 | **Débrancher la clé USB des sauvegardes** | — | ☐ OK ☐ Non | |

La clé reste débranchée jusqu'à l'étape 2.3 : la copie contient le dossier de la clé de la boutique,
et l'application y copierait ses sauvegardes d'essai, ce qui ferait tourner la rotation de la vraie
clé.

## 2. Démarrer sur la copie et relever les repères

| N° | À faire | Attendu | Résultat | Remarque |
|----|---------|---------|----------|----------|
| 2.1 | Double-cliquer sur `lancer-essai-restauration.cmd` | L'écran de connexion avec **les vrais noms** de la boutique. **Si la page « Créer le compte administrateur » apparaît : arrêter**, fermer, revoir l'étape 1.3 | ☐ OK ☐ Non | |
| 2.2 | Se connecter en administrateur. Menu **Sauvegardes** | Une ligne « Au démarrage » (date du jour) ; la clé est « Non branchée » ; un avertissement de copie sur la clé est normal | ☐ OK ☐ Non | |
| 2.3 | Brancher la clé. Sur la clé, créer le dossier `E:\EssaiRestauration`. Écran Sauvegardes : « Changer de clé » → choisir `E:\EssaiRestauration` | La clé est « Branchée » ; le dossier affiché est `E:\EssaiRestauration` | ☐ OK ☐ Non | |
| 2.4 | Relever les **repères R0** (tableau ci-dessous) | Les cinq valeurs sont notées | ☐ OK ☐ Non | |

**Repères** (à relever à chaque fois que la fiche le demande) :

| Repère | Où le lire | R0 (départ) | R1 (après 4.x) | R2 (après 5.x) |
|--------|-----------|-------------|-----------------|-----------------|
| Valeur du stock | **Rapports de gestion** → onglet « Valeur du stock » | | | |
| Total dû aux fournisseurs | **Fournisseurs**, en haut de la liste (« Total dû ») | | | |
| Dépenses du mois | **Dépenses**, période du mois en cours (« Total de la période ») | | | |
| Nombre de produits | **Produits**, nombre de lignes (ou export Excel) | | | |
| Dernière opération | **Journal des opérations** : première ligne (date, heure, action) | | | |

## 3. Les essais

### Essai 1 — Sauvegarder maintenant

| N° | À faire | Attendu | Résultat | Durée |
|----|---------|---------|----------|-------|
| 3.1 | « Sauvegarder maintenant » (chronométrer jusqu'au message) | Une nouvelle ligne « Sauvegarde manuelle » ; « Copie faite sur la clé USB. » ; le même fichier est dans `E:\EssaiRestauration` | ☐ OK ☐ Non | ___ s |

Noter le nom de cette sauvegarde (**S1**) : `boutique_________________manuelle.db`

### Essai 2 — Poser un repère qui doit disparaître

| N° | À faire | Attendu | Résultat | Remarque |
|----|---------|---------|----------|----------|
| 3.2 | Menu **Dépenses** → « Nouvelle dépense » : source « Fonds propres », catégorie « Autre », libellé **ESSAI RESTAURATION**, montant **100** | La dépense apparaît ; « Dépenses du mois » = R0 + 100 F | ☐ OK ☐ Non | N° DEP : |

### Essai 3 — Restaurer depuis la liste

| N° | À faire | Attendu | Résultat | Durée |
|----|---------|---------|----------|-------|
| 3.3 | Écran Sauvegardes, ligne **S1** : icône flèche circulaire (Restaurer) ; lire l'avertissement ; cocher « J'ai compris : faire la restauration » ; « Restaurer et redémarrer » (chronométrer jusqu'à l'écran de connexion) | « Restauration en cours : l'application redémarre… », puis l'écran de connexion | ☐ OK ☐ Non | ___ s |
| 3.4 | Se reconnecter en administrateur. Relever les **repères R1** | R1 = R0 pour les quatre premiers ; la dépense ESSAI RESTAURATION **n'existe plus** | ☐ OK ☐ Non | |
| 3.5 | **Journal des opérations** | Première ligne « Restauration d'une sauvegarde », avec le fichier S1 et la sauvegarde de la base remplacée | ☐ OK ☐ Non | |
| 3.6 | Écran Sauvegardes | Une ligne « Avant une restauration » (**S2**), aussi présente dans `E:\EssaiRestauration` | ☐ OK ☐ Non | |

### Essai 4 — Revenir en arrière depuis la clé USB

| N° | À faire | Attendu | Résultat | Durée |
|----|---------|---------|----------|-------|
| 3.7 | « Restaurer depuis un fichier » → « Choisir le fichier et restaurer » → dans `E:\EssaiRestauration`, choisir **S2** (`…_avant_restauration.db`) ; cocher, valider | L'application redémarre | ☐ OK ☐ Non | ___ s |
| 3.8 | Se reconnecter. Relever les **repères R2** | La dépense ESSAI RESTAURATION **est revenue** ; « Dépenses du mois » = R0 + 100 F ; les autres repères = R0 | ☐ OK ☐ Non | |

### Essai 5 — Un mauvais fichier est refusé

| N° | À faire | Attendu | Résultat | Remarque |
|----|---------|---------|----------|----------|
| 3.9 | Sur la clé, créer avec le Bloc-notes un fichier `faux.db` contenant « essai ». « Restaurer depuis un fichier » → choisir `faux.db` | Refus : « Ce fichier n'est pas une sauvegarde lisible de la boutique » ; l'application **ne redémarre pas** ; la dépense ESSAI RESTAURATION est toujours là | ☐ OK ☐ Non | |

### Essai 6 — Restauration à la main (l'application ne démarre plus)

On simule le cas du `DEPLOIEMENT.md` § 7.3, **dans `C:\EssaiRestauration` seulement**.

| N° | À faire | Attendu | Résultat | Remarque |
|----|---------|---------|----------|----------|
| 3.10 | Fermer l'application (vérifier le Gestionnaire des tâches) | Plus rien ne tourne | ☐ OK ☐ Non | |
| 3.11 | Dans `C:\EssaiRestauration` : renommer `boutique.db` en `boutique_HS_<date>.db` (et `boutique.db-wal`, `boutique.db-shm` s'ils existent) | — | ☐ OK ☐ Non | |
| 3.12 | Copier **S1** depuis `C:\EssaiRestauration\sauvegardes` dans `C:\EssaiRestauration`, la renommer `boutique.db` | — | ☐ OK ☐ Non | |
| 3.13 | Relancer par le script, se connecter | Les vrais comptes ; la dépense ESSAI RESTAURATION **n'existe pas** (S1 date d'avant) ; repères = R0 | ☐ OK ☐ Non | |

### Essai 7 — Coupure de courant pendant une sauvegarde

| N° | À faire | Attendu | Résultat | Remarque |
|----|---------|---------|----------|----------|
| 3.14 | Écran Sauvegardes : « Sauvegarder maintenant » et, **aussitôt**, débrancher le terminal du secteur | — | ☐ Fait | |
| 3.15 | Rebrancher, démarrer Windows, relancer par le script, se connecter | L'application démarre ; repères = R0 | ☐ OK ☐ Non | |
| 3.16 | Écran Sauvegardes | La liste ne montre que des sauvegardes complètes : la sauvegarde coupée est soit présente et entière, soit absente. Un fichier `….db.partiel` peut rester dans le dossier `sauvegardes` : il est ignoré | ☐ OK ☐ Non | Sauvegarde coupée : ☐ présente ☐ absente |
| 3.17 | Si elle est présente : la restaurer (comme en 3.3) | Redémarrage, repères = R0 | ☐ OK ☐ Non ☐ Sans objet | |

### Essai 8 — Coupure de courant pendant une restauration

| N° | À faire | Attendu | Résultat | Remarque |
|----|---------|---------|----------|----------|
| 3.18 | Restaurer **S2** depuis la liste (la dépense ESSAI RESTAURATION doit revenir) ; dès « Restauration en cours : l'application redémarre… », débrancher le terminal | — | ☐ Fait | |
| 3.19 | Rebrancher, relancer par le script, se connecter | L'application démarre. Soit la restauration est faite (la dépense est revenue, journal « Restauration d'une sauvegarde »), soit rien n'a changé (pas de dépense) : **jamais** un message « Démarrage impossible » | ☐ OK ☐ Non | ☐ faite ☐ rien changé |

### Essai 9 (facultatif) — Reprise sur un autre ordinateur

Sur un second PC Windows, avec **la même version** installée (`DEPLOIEMENT.md` § 8.3, test DEP-08) :
créer un administrateur provisoire, puis « Restaurer depuis un fichier » **S1** depuis
`E:\EssaiRestauration`.

| N° | Attendu | Résultat | Remarque |
|----|---------|----------|----------|
| 3.20 | Redémarrage avec les données et les comptes de la boutique ; l'administrateur provisoire n'existe plus ; repères = R0 | ☐ OK ☐ Non ☐ Pas fait | |

Le refus d'une sauvegarde venant d'une version plus récente (DEP-07) demande deux versions de
l'application : il se jouera à la première mise à jour avec migration.

## 4. Remettre en état (à faire même si l'essai s'est arrêté)

| N° | À faire | Attendu | Résultat | Remarque |
|----|---------|---------|----------|----------|
| 4.1 | Fermer l'application (Gestionnaire des tâches) | Plus rien ne tourne | ☐ OK ☐ Non | |
| 4.2 | PowerShell : `Get-FileHash "$env:APPDATA\Ma Boutique POS\boutique.db"` | **Même empreinte qu'en 1.2** | ☐ OK ☐ Non | |
| 4.3 | Supprimer `C:\EssaiRestauration`, `E:\EssaiRestauration` et le script du Bureau | — | ☐ OK ☐ Non | |
| 4.4 | Lancer l'application **normalement** (son raccourci), se connecter en administrateur, menu **Sauvegardes** | Les sauvegardes de la boutique sont là ; la clé est « Branchée » sur **son dossier habituel** ; aucune dépense ESSAI RESTAURATION | ☐ OK ☐ Non | |

## 5. Conclusion

| | |
|---|---|
| Tous les essais 1 à 8 sont OK | ☐ Oui ☐ Non |
| Durée d'une restauration (3.3) | ___ s |
| Taille de la base de la boutique | ___ Mo |
| Problèmes relevés | |

Signature du technicien : ……………………  Signature de la patronne : ……………………

Fiche à transmettre aux développeurs : si tout est OK, la restauration est déclarée **testée** (B16).
