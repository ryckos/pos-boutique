# Procédure de déploiement sur le terminal de la boutique

**Ma Boutique POS** — terminal OMA POS M120w (Windows 10), imprimante Xprinter M804, douchette USB.

Ce document décrit :
1. la **première installation** chez la cliente, qui commence à travailler avec l'application telle
   qu'elle est aujourd'hui ;
2. les **mises à jour** suivantes, pendant que nous terminons les fonctions restantes ;
3. le **retour arrière** et la **reprise après panne**.

Il s'adresse à l'équipe qui installe (développeurs, chef de projet). Les annexes sont à imprimer et à
remplir sur place.

---

## 1. Le principe à ne jamais oublier

**À partir du premier jour, la base de données de la boutique est le bien le plus précieux du
projet.** Elle contient chaque vente, chaque franc et chaque boîte. Elle ne se recrée jamais, ne
se remplace jamais par une base de développement, et ne se modifie jamais à la main.

- La base est **un seul fichier**, `boutique.db`, sur le terminal.
- Une nouvelle version de l'application **ne recrée pas la base** : au démarrage, elle applique
  seulement les **migrations** qu'elle ne trouve pas encore dans la base (table `schema_migrations`),
  chacune en tout ou rien.
- **Avant** d'appliquer une migration, l'application fait d'elle-même une sauvegarde complète de la
  base (« Avant une mise à jour » dans l’écran Sauvegardes). Nous en faisons en plus une copie sur clé USB avant chaque mise à jour.
- En production, l'application ne crée **aucune donnée de démonstration** : au tout premier
  lancement, un assistant fait créer le compte de l'administratrice.

---

## 2. Où se trouvent les choses sur le terminal

| Élément | Emplacement | Remarque |
|---------|-------------|----------|
| Application | `%LOCALAPPDATA%\Programs\…` (installée pour le compte Windows courant) | Remplacée à chaque mise à jour |
| **Base de données** | `%APPDATA%\<dossier de l'application>\boutique.db` | **Ne jamais supprimer.** Le désinstalleur ne la supprime pas |
| Fichiers liés à la base | `boutique.db-wal`, `boutique.db-shm` à côté | Font partie de la base tant que l'application tourne : ne pas les effacer |
| Sauvegardes automatiques | dossier `sauvegardes` **à côté** de `boutique.db` | 30 dernières + 1 par semaine sur un an |
| Copie des sauvegardes | dossier choisi sur la clé USB (écran Sauvegardes) | Copiée si la clé est branchée |

**Le dossier de données exact** (`Ma Boutique POS` ou `pos-boutique`, selon le nom que Windows donne
à l'application) se relève à la première installation (§ 5.3) et s'écrit sur la fiche d'installation
(annexe A). Pour l'ouvrir : touche Windows + R, taper `%APPDATA%`, Entrée.

**Un seul compte Windows.** La base est dans le profil du compte Windows qui utilise l'application.
Toujours ouvrir la même session Windows sur le terminal ; un autre compte verrait une autre base,
vide.

---

## 3. Avant la première livraison (au bureau)

### 3.1 Points à régler avant d'installer chez la cliente

| Point | Pourquoi | Qui |
|-------|----------|-----|
| **Figer le nom de l'application** : ajouter `"productName": "Ma Boutique POS"` à la racine de `package.json` (il n'est aujourd'hui que dans la section `build`) | Le nom du dossier de données en dépend. **S'il changeait entre deux versions, l'application ouvrirait une base vide dans un nouveau dossier.** Le fixer une fois pour toutes, avant la première installation | Dev B |
| Plafond de remise de la caissière (D-A3) | Sans plafond, toute remise de la caissière demande le code du gérant | La cliente |
| Politique de stock négatif (D-A1) | En attendant, une vente n'est jamais bloquée | La cliente |
| Démarrage automatique et mode kiosque | Pas encore développés (Phase 5) : solution provisoire au § 5.6 | Dev B |
| Signature de l'installateur | Non signé : Windows affiche un avertissement (§ 5.2) | Plus tard |

### 3.2 Ce que la cliente doit savoir le premier jour

L'application est livrée **en l'état**. Ces fonctions ne sont pas encore disponibles et le seront par
des mises à jour, **sans perte de données** :

- vente à crédit, fiches clients, avoir en boutique, recouvrement (le bouton « Crédit » est grisé) ;
- rapports de ventes et marge (le rapport « Résultat » affiche « en attente ») ;
- tableau de bord d'accueil, promotions programmées (le bouton « Promo » est grisé) ;
- dépense payée directement depuis le tiroir (les dépenses se saisissent en « Fonds propres ») ;
- envoi des sauvegardes sur Internet (les sauvegardes restent sur le terminal et la clé USB).

### 3.3 Fabriquer la version à livrer

Sur le poste de développement, toujours à partir de la branche **`main`** (version validée après le
test commun du vendredi) :

```powershell
git switch main
git pull
# 1. Augmenter la version dans package.json ("version": "1.0.0" pour la première livraison,
#    puis 1.0.1, 1.1.0…). Une version plus grande est indispensable pour remplacer l'ancienne.
npm ci                 # installation propre des dépendances
npm run verifier       # typecheck + tests : tout doit être vert
npm run dist           # compile et produit l'installateur dans dist\
git tag v1.0.0         # même numéro que dans package.json
git push --tags
```

L'installateur se trouve dans `dist\` : `Ma Boutique POS Setup 1.0.0.exe`.

### 3.4 Essayer l'installateur avant de partir

Sur un PC Windows de test (ou une machine virtuelle), **jamais** sur le terminal de la boutique :

1. installer `Ma Boutique POS Setup 1.0.0.exe` ;
2. lancer l'application : l'assistant de premier démarrage doit apparaître (aucune donnée de démo) ;
3. créer un compte, se connecter, créer un produit, faire une vente, une clôture ;
4. fermer, relancer : les données sont toujours là ;
5. désinstaller, réinstaller : **les données sont toujours là** (la base survit à la désinstallation).

### 3.5 Le matériel à emporter

- L'installateur sur **deux** clés USB (une de secours).
- **Une clé USB dédiée aux sauvegardes**, qui restera à la boutique (§ 5.5).
- Le fichier Excel du catalogue préparé avec la cliente (modèle téléchargeable depuis l'écran
  Produits), vérifié au bureau.
- Les annexes A et B imprimées.

---

## 4. Préparer le terminal (Windows)

À faire une fois, avant d'installer l'application :

| Réglage | Valeur | Pourquoi |
|---------|--------|----------|
| Date, heure et fuseau | Fuseau de Lomé (UTC+0), heure réglée automatiquement ou vérifiée | Toutes les dates (tickets, échéances, péremptions) en dépendent |
| Mise en veille | Écran et ordinateur : **jamais** pendant les heures d'ouverture | La caisse doit rester prête |
| Alimentation | Onduleur conseillé ; à défaut, la base résiste aux coupures (transactions), mais un arrêt brutal reste à éviter | Coupures fréquentes |
| Mises à jour Windows | Heures d'activité réglées sur les heures d'ouverture | Pas de redémarrage pendant une vente |
| Imprimante Xprinter M804 | Pilote installé, imprimante visible dans Windows, page de test Windows réussie | Préalable à tout le reste |
| **Partage de l'imprimante** | Paramètres › Imprimantes › Xprinter › Propriétés de l'imprimante › onglet **Partage** : cocher « Partager cette imprimante », nom du partage **`XPOS`** (exactement, sans espace) | Configuration validée en Phase 0 (D-20) : l'application envoie le ticket vers `\\localhost\XPOS` |
| Tiroir-caisse | Câble RJ11 branché sur le port tiroir de l'imprimante | Le tiroir s'ouvre par l'imprimante |
| Douchette | Branchée, scan dans le Bloc-notes : le code s'écrit puis passe à la ligne (suffixe Entrée) | La caisse attend Entrée après le code |
| Écran client | Paramètres d'affichage : **Étendre ces affichages**, écran 15,6″ en principal | L'écran client s'ouvre sur le second écran |
| Compte Windows | Un compte dédié à la boutique, toujours le même (§ 2) | La base est dans ce profil |

---

## 5. Première installation chez la cliente (jour J)

### 5.1 Vérifier qu'il n'existe pas déjà une base

Ouvrir `%APPDATA%` (Windows + R). S'il existe déjà un dossier de l'application (essai précédent) :
**le renommer** en ajoutant `_ancien` plutôt que de le supprimer, pour partir d'une base vierge.

### 5.2 Installer

1. Lancer `Ma Boutique POS Setup 1.0.0.exe`.
2. Si Windows affiche « Windows a protégé votre ordinateur » : **Informations complémentaires**,
   puis **Exécuter quand même** (installateur non signé).
3. L'installation se fait d'elle-même, puis l'application démarre.

### 5.3 Premier démarrage

1. L'assistant demande de **créer le compte administrateur** : nom (ex. le prénom de la patronne) et
   code à 4 chiffres choisi par elle, deux fois. Ce code n'est connu que d'elle.
2. Relever l'emplacement de la base : ouvrir `%APPDATA%`, trouver le dossier qui contient
   `boutique.db` et le dossier `sauvegardes`, et **l'écrire sur la fiche d'installation**.

### 5.4 Faire les réglages, dans cet ordre

Connectée en administratrice :

| Ordre | Écran | Quoi |
|-------|-------|------|
| 1 | **Paramètres** | Nom, adresse, NIF de la boutique, pied du ticket, TVA par défaut, seuil des péremptions, produits dormants, plafond de remise (si décidé) |
| 2 | **Réglages matériel** | « Modifier les réglages » : méthode **Partage réseau**, nom du partage **`XPOS`**, page de codes **cp1252** (valeurs validées, D-20). « Imprimer le test en cp1252 » : « éèêàçùôî ÉÇ € » justes sur le papier ; « Ouvrir le tiroir » |
| 3 | **Comptes utilisateurs** | Un compte par personne (gérant, caissières), avec un code **provisoire** que chacun remplacera à sa première connexion |
| 4 | **Catégories** | Les rayons (onglets de la caisse) — l'import Excel peut aussi les créer |
| 5 | **Produits** → Importer depuis Excel | « Vérifier le fichier », corriger jusqu'à zéro erreur, puis « Importer » |
| 6 | **Produits** | Compléter les conditionnements (Lot, Carton) et les boutons tactiles des articles sans code |
| 7 | **Fournisseurs** | Les fournisseurs habituels et leur délai de paiement |
| 8 | **Stock initial** | Compter les rayons, produit par produit, avec le coût d'achat (la clôture d'une soirée suffit rarement : prévoir le temps nécessaire) |
| 9 | **Sauvegardes** | Choisir la clé USB (§ 5.5) puis « Sauvegarder maintenant » |

### 5.5 Mettre en place les sauvegardes

1. Brancher la clé USB dédiée, créer dessus un dossier `Sauvegardes_Boutique`.
2. Écran **Sauvegardes** (administratrice) : « Choisir la clé USB », sélectionner ce dossier.
3. « Sauvegarder maintenant » : la sauvegarde apparaît dans la liste et sur la clé.
4. Expliquer à la cliente : une sauvegarde se fait d'elle-même à **chaque clôture de caisse** ; la
   clé doit rester branchée, et être emportée hors de la boutique une fois par semaine (vol, incendie).

### 5.6 Démarrage automatique (solution provisoire)

En attendant le démarrage automatique et le mode kiosque (Phase 5) :

1. Windows + R, taper `shell:startup`, Entrée.
2. Y copier le raccourci « Ma Boutique POS » du bureau.
3. Redémarrer le terminal : l'application doit s'ouvrir seule.

### 5.7 Contrôles avant d'ouvrir la caisse

Pour vérifier le matériel **sans laisser de vente d'essai dans la base de la boutique**, utiliser
d'abord le **ticket de test** de « Réglages matériel ». Si un essai de vente complet est nécessaire,
le faire sur une **base d'essai séparée** :

```bat
:: Fichier Essai.cmd, à poser sur le bureau le temps des essais puis à effacer
set POS_DB=C:\PosEssai\essai.db
start "" "%LOCALAPPDATA%\Programs\<dossier de l'application>\Ma Boutique POS.exe"
```

Créer d'abord le dossier `C:\PosEssai`. Cette base d'essai est indépendante : on peut y vendre,
annuler, clôturer sans toucher la vraie base. **Fermer l'application et effacer `Essai.cmd` et
`C:\PosEssai` une fois les essais finis.**

Liste de contrôle (sur la base d'essai) :
- [ ] scan d'un article à la douchette : la ligne apparaît en moins d'une seconde ;
- [ ] vente en espèces : ticket imprimé, accents lisibles, tiroir ouvert ;
- [ ] écran client : lignes et total visibles ;
- [ ] clôture : rapport Z imprimé.

Sur la **vraie base** : chaque personne se connecte une fois et choisit son code définitif.

### 5.8 Remettre l'application à la cliente

- Former la caissière (vente, attente, retour, clôture) et le gérant (réception, stock, inventaire),
  avec `docs/SCENARIOS_TEST.md` comme fil conducteur.
- Remplir et faire signer la **fiche d'installation** (annexe A). En garder une copie.

---

## 6. Mettre à jour l'application (versions suivantes)

### 6.1 Règles pour les développeurs : écrire une migration sûre

La base de la cliente contient des données réelles. Une migration doit fonctionner **sur une base
pleine**, pas seulement sur une base neuve.

- **Nouveau fichier seulement** : `src/main/db/migrations/AAAAMMJJ_HHMM_sujet.sql` (commande
  `/migration`). **Ne jamais modifier une migration déjà livrée** : la base de la cliente ne la
  rejouerait pas, et les deux bases divergeraient.
- **Ajouter plutôt que changer** : nouvelle table, nouvelle colonne avec une valeur par défaut,
  nouvelle vue, nouvel index. Jamais de suppression de colonne d'historique.
- **Remplir les données existantes** dans la même migration quand une nouvelle colonne en a besoin
  (`UPDATE … SET nouvelle = …` sur les lignes anciennes — permis dans une migration, sur une colonne
  neuve).
- **Changer un `CHECK`** impose de recréer la table : copier les données (`INSERT INTO nouvelle
  SELECT … FROM ancienne`), recréer index, triggers et vues qui en dépendent ; décision à prendre à
  deux, et à essayer sur une copie de la base de la cliente.
- **Pas de `PRAGMA`** dans une migration (chaque migration tourne dans une transaction).
- **Jamais de données de démonstration** dans une migration.
- Un test automatique qui applique la migration sur une base contenant déjà des données
  (`tests/migrations.test.ts`).

### 6.2 Répétition générale sur une copie de la base de la cliente

Avant chaque mise à jour qui contient une migration :

1. Récupérer la **dernière sauvegarde** de la boutique (clé USB : fichier
   `boutique_AAAA-MM-JJ_HHMMSS_cloture.db`).
2. Sur le poste de développement, la copier dans `C:\Repetition\boutique.db` (ne jamais travailler
   sur l'original).
3. Installer la **nouvelle version** sur le PC de test, puis la lancer sur cette copie :

   ```bat
   set POS_DB=C:\Repetition\boutique.db
   start "" "%LOCALAPPDATA%\Programs\<dossier de l'application>\Ma Boutique POS.exe"
   ```

4. Vérifier :
   - [ ] l'application démarre sans message « Démarrage impossible » ;
   - [ ] une sauvegarde « Avant une mise à jour » est apparue dans `C:\Repetition\sauvegardes` ;
   - [ ] les chiffres n'ont pas bougé : valeur du stock (écran Stock), total dû aux fournisseurs,
     nombre de produits, dernières ventes, dernier Z ;
   - [ ] les nouvelles fonctions marchent sur ces données réelles.
5. Effacer la copie ensuite : elle contient les données de la cliente.

### 6.3 Mise à jour sur le terminal

Choisir un moment **sans client** : après la clôture du soir, ou avant l'ouverture.

1. **Toutes les caisses sont clôturées** (écran Clôture de caisse : aucune caisse ouverte).
2. Écran **Sauvegardes** : « Sauvegarder maintenant », vérifier qu'elle est aussi sur la clé USB.
3. **Fermer l'application.**
4. Copie de sécurité supplémentaire : copier le dossier de données complet (`%APPDATA%\<dossier>`)
   sur la clé USB, dans un dossier `Avant_maj_1.0.1_AAAA-MM-JJ`.
5. Lancer le nouvel installateur `Ma Boutique POS Setup 1.0.1.exe` (même procédure qu'au § 5.2). Il
   remplace l'application ; **la base n'est pas touchée** par l'installateur.
6. L'application démarre : elle sauvegarde la base (« Avant une mise à jour »), puis applique les migrations.
7. Vérifications :
   - [ ] connexion de l'administratrice ;
   - [ ] écran Sauvegardes : une sauvegarde « Avant une mise à jour » toute récente ;
   - [ ] Stock : même valeur totale qu'avant la mise à jour ;
   - [ ] Fournisseurs : même total dû ;
   - [ ] Réglages matériel : ticket de test imprimé ;
   - [ ] les nouveautés de la version, montrées à la cliente.
8. Noter la mise à jour sur la fiche de suivi (annexe B).

### 6.4 Mise à jour sans migration

Même procédure (étapes 1 à 8). Il n'y aura simplement pas de sauvegarde « Avant une mise à jour » à
l'étape 6 : c'est normal.

---

## 7. Retour arrière (si la mise à jour se passe mal)

### 7.1 L'application ne démarre plus après la mise à jour

Message « Démarrage impossible » : la migration en échec a été annulée (tout ou rien), mais celles
qui la précédaient dans la même mise à jour sont restées appliquées. On revient donc à la base
d'avant la mise à jour :

1. Noter le message exact (photo) et le transmettre aux développeurs.
2. Réinstaller **la version précédente** (`Setup 1.0.0.exe`, gardé sur la clé).
3. Remettre la base d'avant la mise à jour par la **restauration manuelle** (§ 7.3), avec la
   sauvegarde « Avant une mise à jour » (ou la copie de l'étape 4 du § 6.3).
4. La boutique peut revendre. Les développeurs corrigent la migration, refont la répétition générale
   (§ 6.2), puis une nouvelle mise à jour.

### 7.2 L'application démarre mais les données semblent fausses

1. **Arrêter tout de suite** de vendre sur cette version.
2. Réinstaller la version précédente.
3. Restaurer la sauvegarde « Avant une mise à jour » (§ 8.2) : elle date d'avant les migrations, donc
   l'ancienne version l'accepte. **Tout ce qui a été saisi après la mise à jour est perdu** : c'est
   pourquoi les vérifications du § 6.3 se font avant de rouvrir la caisse.

Une sauvegarde faite par une version **plus récente** est refusée par une version plus ancienne
(migration inconnue) : c'est voulu, pour ne jamais ouvrir une base avec un code qui ne la comprend
pas.

### 7.3 Restauration manuelle (quand l'application ne démarre pas)

1. Fermer l'application (vérifier dans le Gestionnaire des tâches qu'elle ne tourne plus).
2. Ouvrir le dossier de données (`%APPDATA%\<dossier>`).
3. Renommer `boutique.db` en `boutique_HS_AAAA-MM-JJ.db` (ne rien effacer), ainsi que
   `boutique.db-wal` et `boutique.db-shm` s'ils existent.
4. Copier la sauvegarde choisie (dossier `sauvegardes`, ex.
   `boutique_AAAA-MM-JJ_HHMMSS_mise_a_jour.db`) dans le dossier de données, et la renommer
   `boutique.db`.
5. Lancer l'application et vérifier comme au § 6.3, étape 7.

---

## 8. Sauvegardes et reprise après panne

### 8.1 Au quotidien (la cliente)

- Une sauvegarde à chaque clôture de caisse, sur le terminal et sur la clé USB.
- Écran Sauvegardes : vérifier de temps en temps la date de la dernière ; une alerte apparaît si
  elle a plus de 2 jours.
- Emporter la clé hors de la boutique une fois par semaine, la rebrancher le lendemain.

### 8.2 Restaurer une sauvegarde (administratrice)

1. Écran **Sauvegardes** : « Restaurer » sur une sauvegarde de la liste, ou « Restaurer depuis un
   fichier » pour une sauvegarde de la clé USB.
2. Lire l'avertissement, cocher « J'ai compris », valider.
3. L'application sauvegarde d'abord la base en place (« Avant une restauration »), la remplace,
   puis redémarre. Chacun se reconnecte.

### 8.3 Le terminal est en panne (disque, vol)

1. Préparer un nouveau poste Windows (§ 4) avec le **même compte Windows dédié**.
2. Installer **la même version** que celle du terminal (fiche de suivi, annexe B).
3. Au premier démarrage, l'assistant demande un compte administrateur : en créer un **provisoire**
   (il sera remplacé par la restauration).
4. Écran Sauvegardes : « Restaurer depuis un fichier », choisir la **dernière sauvegarde de la clé
   USB**. L'application redémarre avec les données de la boutique et les comptes d'origine.
5. Refaire les réglages propres au poste : Réglages matériel (imprimante), clé USB des sauvegardes,
   démarrage automatique.

Les opérations faites entre la dernière sauvegarde et la panne sont perdues : d'où l'intérêt de
clôturer chaque jour et de garder la clé branchée.

---

## Annexe A — Fiche d'installation

| Rubrique | À remplir |
|----------|-----------|
| Date de l'installation | |
| Installé par | |
| Version installée | |
| Compte Windows utilisé | |
| **Dossier de données (base)** | `%APPDATA%\…` |
| Dossier de l'application | `%LOCALAPPDATA%\Programs\…` |
| Dossier des sauvegardes sur la clé USB | |
| Imprimante partagée sous le nom `XPOS` | ☐ oui |
| Réglages matériel : Partage réseau · `XPOS` · cp1252 | ☐ oui |
| Ticket de test : « éèêàçùôî ÉÇ € » justes | ☐ oui |
| Écran client sur le second écran | ☐ oui |
| Démarrage automatique en place | ☐ oui |
| Comptes créés (nom, rôle) | |
| Catalogue importé (nombre de produits) | |
| Stock initial terminé | ☐ oui ☐ en cours |
| Première sauvegarde faite, présente sur la clé | ☐ oui |
| Formation caissière / gérant faite | ☐ oui |
| Signature de la cliente | |

## Annexe B — Fiche de suivi des mises à jour

| Date | Version avant → après | Migrations appliquées | Répétition générale faite | Sauvegarde avant (nom) | Vérifications OK | Par |
|------|-----------------------|-----------------------|---------------------------|------------------------|------------------|-----|
| | | | ☐ | | ☐ | |
| | | | ☐ | | ☐ | |
| | | | ☐ | | ☐ | |
