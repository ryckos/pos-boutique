# Règles métier

Référence des règles de gestion. **Si une règle nécessaire n'est pas ici, ne pas l'inventer :
demander au développeur**, puis l'ajouter ici une fois tranchée.

Les exemples chiffrés sont repris de `SCENARIO_REFERENCE.md` et servent de cas de test.

---

## 1. Principes transverses

### 1.1 Traçabilité et immutabilité
- Toute opération enregistre **qui** (utilisateur de la session), **quand** (horodatage local) et,
  pour toute correction, **pourquoi** (motif obligatoire).
- `mouvements_stock` et `journal_audit` sont **immuables** : des triggers refusent `UPDATE` et
  `DELETE`. Les ventes et leurs lignes ne peuvent pas être supprimées.
- Une erreur se corrige par :
  - une **contre-passation** (`contrePasser()` : mouvement inverse lié à l'original, une seule
    fois par mouvement) ;
  - ou un **changement de statut** (vente `annulee`, inventaire `annule`) ;
  - ou une **désactivation** (`actif = 0`) pour les référentiels : produits, conditionnements,
    fournisseurs, clients, comptes.

### 1.2 Argent
- Montants en **entiers FCFA**. Pas de centimes, pas de flottants.
- Prix de vente saisis et stockés **TTC**.
- Seules valeurs non entières autorisées : le CUMP et les coûts unitaires (résultats de
  divisions), et les quantités (produits pesés futurs).

### 1.3 Photocopie au moment T
Une ligne de vente copie la désignation, le prix, la TVA, le coût et la quantité de base **au
moment de la vente**. Un changement de prix ultérieur ne modifie jamais un ticket passé, et la
marge calculée est la marge réellement réalisée.

### 1.4 Journal d'audit
Actions à journaliser avec `journaliser()` :

| Action                        | Contenu            |
|-------------------------------|--------------------|
| `connexion`                   |                    |
| `deconnexion`                 |                    |
| `echec_connexion_verrouillage`| n° du verrouillage, délai (au nom du compte visé) |
| `modification_prix`           | avant/après        |
| `desactivation_produit`       | motif, stock restant |
| `import_catalogue`            | fichier, produits créés, lignes ignorées, nouveaux rayons (B3) |
| `stock_initial`               | quantité, coût par unité, comptage, stock avant (§ 9.1) |
| `annulation_stock_initial`    | quantité ; motif, stock après (§ 9.1) |
| `remise`                      | montant, ticket    |
| `annulation_ligne`            |                    |
| `annulation_ticket`           | numéro, montant, motif, gérant qui a autorisé (§ 6.7) |
| `impression_ticket`           | duplicata ou non |
| `ouverture_tiroir_hors_vente` |                    |
| `ouverture_session_caisse`    | fond de caisse |
| `cloture_session_caisse`      | caissier, espèces attendues et comptées, écart, commentaire (§ 6.9) |
| `impression_rapport_z`        | duplicata ou non (§ 6.9) |
| `mouvement_caisse`            | session, sens, motif, montant, commentaire, document (§ 6.10) |
| `annulation_mouvement_caisse` | mouvement annulé, contre-mouvement, motif (§ 6.10) |
| `retour_client`               | numéros, montant, mode, motif, sort, gérant qui a autorisé (§ 6.8) |
| `facture`                     | numéro, ticket, client, montant (A10) |
| `edition_facture`             | enregistrée en PDF ou imprimée, copie ou non (A10) |
| `proforma`                    | numéro, montant, client s'il est connu (A10) |
| `creation_client`             | nom, téléphone, plafond (§ 7.1) |
| `modification_client`         | nom, téléphone, adresse, NIF, avant/après (§ 7.1) |
| `plafond_credit`              | client, plafond avant/après (§ 7.1) |
| `desactivation_client`        | client ; motif (§ 7.1) |
| `vente_credit`                | ticket, client, montant, échéance (§ 7.1) |
| `modification_parametre`      |                    |
| `creation_utilisateur`        | nom, rôle, code provisoire |
| `modification_role`           |                    |
| `desactivation_utilisateur`   | motif              |
| `modification_pin`            | la personne a choisi son code ; jamais la valeur |
| `reinitialisation_pin`        | l'admin a donné un code provisoire ; jamais la valeur |
| `desactivation_fournisseur`   | nom ; motif (§ 4.6) |
| `annulation_commande`         | numéro, statut, motif (§ 4.7) |
| `cloture_commande`            | numéro, reste non livré, motif (§ 4.7) |
| `annulation_reglement_fournisseur` | fournisseur, montant, date, motif (§ 4.5) |
| `annulation_sortie_stock`     | produit, type, quantité, motif d'origine, valeur ; motif (§ 8) |
| `refus_avoir_fournisseur`     | fournisseur, produit, avoir attendu, motif (§ 8) |
| `validation_inventaire`       | numéro, rayon, comptés, écarts, non comptés, manquants et surplus en FCFA (§ 9) |
| `annulation_inventaire`       | numéro, rayon, comptés, motif (§ 9) |
| `annulation_depense`          | numéro, date, catégorie, libellé, montant, source ; motif (§ 10) |
| `restauration_sauvegarde`     |                    |

**Lecture du journal (B14, validé par Dev B le 2026-10-09)** : écran « Journal des opérations »,
**admin seulement**. Filtres période (7 derniers jours par défaut, fin jamais dans le futur),
personne, action ; les plus récentes d'abord, 200 par page puis « Afficher plus ». Chaque action et
chaque valeur sont écrites en français (montants en F, rôles, noms des personnes au lieu des
identifiants) ; jamais de code ni de JSON à l'écran. **Toute nouvelle action journalisée doit
recevoir son libellé dans `src/shared/audit.ts`** (sinon elle s'affiche avec ses mots bruts) ; un test (`tests/audit.test.ts`) relit toutes les actions du code et échoue s'il en manque une.

---

## 2. Produits, conditionnements et codes-barres

### 2.1 Produit et unité de base
- Un **produit** est ce qu'on stocke. Son stock, son seuil d'alerte et son CUMP sont **toujours**
  exprimés dans son **unité de base** (la boîte, le sachet, la bouteille, le kg).
- Formats différents = produits différents. La tomate 70 g et la tomate 210 g sont deux produits,
  chacun avec ses conditionnements.

### 2.2 Conditionnements
- Un **conditionnement** est une façon de vendre ou d'acheter un produit : nom, `quantite_base`
  (nombre d'unités de base contenues), **prix de vente libre**, code-barres et/ou code PLU.
- Chaque produit a au moins un conditionnement « Unité » (`quantite_base = 1`, `est_defaut = 1`).
- Le prix d'un lot ou d'un carton est **saisi**, jamais calculé par multiplication.
- Exemple de référence (tomate concentrée 70 g) :

  | Conditionnement | Quantité | Prix     | Prix par boîte |
  |-----------------|----------|----------|----------------|
  | Unité           | ×1       | 350 F    | 350            |
  | Lot de 3        | ×3       | 1 000 F  | 333            |
  | Carton de 24    | ×24      | 7 500 F  | 313            |

- **Garde-fou** : si un conditionnement coûte plus cher que son équivalent à l'unité
  (`prix > prixUnité × quantite_base`), afficher une **alerte au gérant** sans bloquer. C'est
  probablement une erreur de saisie, mais cela peut être voulu.
- Un conditionnement peut être affiché comme **bouton tactile** de la caisse
  (`bouton_tactile`, `ordre_bouton`).
- Le conditionnement de base s'appelle toujours **« Unité »** (nom figé) ; il ne peut pas être
  désactivé tant que le produit est actif.
- La **quantité de base** d'un conditionnement existant **n'est pas modifiable** : pour la changer,
  on désactive le conditionnement et on en crée un autre. Ainsi, le sens des réceptions, ventes et
  inventaires passés ne change jamais.
- Tout changement de prix de vente d'un conditionnement est journalisé (`modification_prix`).
- **Désactivation d'un produit** (gérant) : motif obligatoire, journalisée
  (`desactivation_produit`). Autorisée même s'il reste du stock, avec un avertissement (le stock
  restant est noté au journal).
- Pas de photo de produit pour l'instant (reportée : elle demanderait de stocker et sauvegarder
  des images).

### 2.3 Codes-barres
- Un code-barres identifie une **référence**, jamais un exemplaire : toutes les boîtes d'une même
  référence portent le même code.
- La date de péremption **ne vient donc jamais du code-barres**. Elle se saisit à la réception, par
  lot.
- Chaque code est **unique dans toute la base**, contrainte `UNIQUE` sur `conditionnements`. Un scan
  n'est jamais ambigu.
- Types de codes rencontrés :
  - **EAN-13** du fabricant, sur l'unité : 13 chiffres.
  - **ITF-14** sur les cartons : 14 chiffres, lu par la douchette.
  - **Code interne EAN-13 à préfixe 20 à 29**, généré par l'application pour les lots constitués
    en boutique. Réservé à l'usage interne, il n'entre jamais en conflit avec un code fabricant.
    La clé de contrôle EAN-13 doit être calculée correctement. Exemple valide : `2000000000015`.
  - **Code PLU** : code court tapé au clavier pour les produits sans code-barres. Exemples :
    `101` pour la baguette, `205` pour le gari.
- Format accepté à la saisie : code-barres de **8 à 14 chiffres**, code PLU de **1 à 5 chiffres**,
  chiffres uniquement. La clé des codes fabricant n'est pas contrôlée (la douchette le fait déjà).
- Un code n'apparaît qu'**une fois, toutes colonnes confondues** : le PLU d'un article ne peut pas
  être le code-barres d'un autre (le scan cherche dans les deux).
- Les codes internes sont générés à la suite (`2000000000015`, `2000000000022`…), en sautant ceux
  déjà utilisés.
- **Piège connu** : le code d'une unité est parfois visible à travers le film d'un carton, et la
  caissière scanne alors l'unité au lieu du carton. La parade : un bouton « changer de
  conditionnement » sur la ligne du panier.

### 2.4 Produits sans code-barres
Trois moyens complémentaires, par ordre de priorité :

1. le bouton tactile ;
2. la recherche F2 par nom ou par code PLU ;
3. une étiquette avec code interne, si la boutique a une imprimante d'étiquettes (option).

La recherche par nom ignore les accents et les majuscules : « pate », « PATE » et « Pâte » trouvent
la même chose (une seule règle, `normaliserRecherche` dans `src/shared/texte.ts`).

---

### 2.5 Catégories (rayons et sous-rayons)
- Deux niveaux au plus : un **rayon** (ex. Alimentation) peut avoir des **sous-rayons** (ex.
  Conserves). Un sous-rayon ne contient pas d'autres catégories.
- Le nom est unique parmi les catégories actives du même niveau (casse et espaces ignorés) : deux
  rayons « Boissons » sont refusés, mais un sous-rayon « Boissons » sous Alimentation est accepté.
- Jamais de suppression. Une catégorie se **désactive**, et seulement si elle ne contient plus
  aucun produit actif ni sous-rayon actif (message : « déplacez-les d'abord »). Pas de réactivation
  pour l'instant.
- Gestion par le gérant (et l'admin) ; lecture pour tous. Création et renommage ne sont pas
  journalisés (pas des actions sensibles).
- La caisse reçoit le **rayon** de chaque article (`ArticleCatalogue.categorie`) : pour un produit
  rangé dans un sous-rayon, c'est le nom du rayon parent. Les onglets de la grille sont donc les
  rayons, par ordre alphabétique.

### 2.6 Import du catalogue depuis Excel (validé par Dev B le 2026-09-25)
- Réservé au gérant (et à l'admin). Un fichier `.xlsx` (5 Mo et 5 000 produits au plus) ; seule la
  première feuille est lue. Modèle téléchargeable : **Nom\***, Catégorie, Code-barres,
  **Prix de vente\***, Prix d'achat, TVA, Seuil d'alerte. Les titres sont reconnus sans accents ni
  majuscules, dans n'importe quel ordre ; les colonnes inconnues et les lignes vides sont ignorées.
- **Deux temps** : « Vérifier le fichier » affiche le rapport ligne par ligne sans rien écrire ;
  « Importer » relit le fichier, le revérifie et enregistre **tout ou rien**, en une transaction.
- Sort de chaque ligne :
  - **à créer** : un produit (unité « pièce », sans suivi de péremption) et son conditionnement
    « Unité » ×1 au prix de vente du fichier ;
  - **ignorée** : son code est déjà au catalogue (code-barres ou PLU, désactivés compris), ou, sans
    code, un produit actif sans code-barres porte déjà ce nom. Réimporter un fichier ne crée donc
    pas de doublon ;
  - **en erreur** : nom ou prix de vente manquant, montant non entier, TVA autre que 18 ou 0,
    code-barres hors 8 à 14 chiffres, catégorie à plus de deux niveaux, ou même code (ou même nom
    sans code) sur deux lignes du fichier (les deux lignes sont en erreur). **Une seule ligne en
    erreur bloque tout l'import.**
- Valeurs par défaut : TVA = `tva_defaut` ; seuil = 0. « 1 500 » écrit en texte vaut 1 500 ; une
  case au format pourcentage (« 18 % ») vaut 18.
- Catégorie : « Rayon » ou « Rayon / Sous-rayon », reconnue sans accents ni majuscules. Un rayon ou
  un sous-rayon absent est **créé** (une seule fois). Vide : produit non classé.
- Ligne **sans code-barres** : le produit n'a pas de code (on le trouve par son nom, F2). Pas de
  code interne généré.
- Le **prix d'achat** est gardé à titre **indicatif** (`produits.prix_achat_indicatif`, par unité) :
  il pré-remplira le coût du stock initial (B6). Il ne modifie jamais le CUMP et n'entre dans aucun
  calcul de marge ou de valeur de stock.
- L'import ne crée **aucun mouvement de stock**. Une ligne au journal : `import_catalogue` (fichier,
  nombre de produits créés et ignorés, catégories créées).

## 3. Stock

### 3.1 Le stock est calculé
```
stock(produit)   = SUM(mouvements_stock.quantite) pour ce produit
stock(lot)       = SUM(mouvements_stock.quantite) pour ce lot
valeur du stock  = stock × CUMP
```
Aucune colonne de stock n'existe. Vues de lecture : `v_stock_produits`, `v_stock_lots`,
`v_alertes_stock`, `v_peremptions`.

### 3.2 Types et sens des mouvements
`core/mouvements.ts` impose le sens de chaque type de mouvement :

| Type                    | Sens    | Déclencheur                                  |
|-------------------------|---------|----------------------------------------------|
| `reception`             | +       | Validation d'une réception fournisseur       |
| `vente`                 | −       | Encaissement d'une vente                     |
| `retour_client`         | +       | Retour d'un article par un client            |
| `retour_fournisseur`    | −       | Renvoi de marchandise au fournisseur         |
| `perte_peremption`      | −       | Retrait d'un lot périmé                      |
| `casse`                 | −       | Produit abîmé ou défectueux                  |
| `vol`                   | −       | Vol constaté                                 |
| `ajustement_inventaire` | ±       | Écart d'inventaire validé, stock initial     |
| `contre_passation`      | ±       | Annulation d'un mouvement précédent          |

Toutes les quantités sont exprimées **en unités de base** : un carton de 24 vendu donne un
mouvement de −24.

### 3.3 Alertes
- **Rupture** : stock ≤ 0.
- **Stock bas** : stock ≤ seuil d'alerte.
- **Produit dormant** : aucune vente depuis N jours (paramètre).

Précisions validées par Dev B le 2026-09-28 (écran stock, B4) :
- **Dormant** : seules comptent les ventes **terminées** (tickets et factures ; ni proforma, ni retour,
  ni vente annulée). Un produit jamais vendu compte depuis sa **première entrée en stock** (à défaut,
  sa création). Seul un produit **qui a du stock** peut être dormant : sans stock, aucun argent n'est
  immobilisé. Seuil : `dormant_jours` (§ 13).
- **Répartition indicative** d'un stock en conditionnements : on remplit d'abord le plus grand
  conditionnement actif, puis le suivant, le reste en unités (46 = 1 carton de 24 + 7 lots de 3 +
  1 unité ; 41 = 1 carton + 5 lots + 2 unités). Rien n'est affiché si le stock est ≤ 0 ou si la
  répartition n'ajoute rien (produit sans conditionnement plus grand que l'Unité, ou stock plus petit
  que le moindre). Au poids, le reste à virgule reste en unités.
- **Historique d'un produit** : sur une période (30 derniers jours par défaut), il part du stock au
  début de la période, liste chaque mouvement du plus ancien au plus récent avec le stock après chacun,
  et finit sur le stock actuel. Document lisible : n° de ticket pour une vente, « Stock initial »,
  « Stock de démonstration », « Annulation » avec le motif ; n° RC ou INV dès que B8 et B12 existent.

- **Alertes de l'écran d'accueil** (validé par Dev B le 2026-10-30, rendez-vous A15) : l'accueil du
  gérant résume les pages Stock et Péremptions **avec les mêmes règles et les mêmes chiffres** : nombre
  de ruptures et de stocks bas (§ 3.3, produits actifs seulement ; un produit jamais approvisionné, à
  stock 0, est une rupture comme sur la page Stock), nombre de lots périmés, à 3 jours ou moins, et plus
  lointains dans l'horizon `peremption_seuil_jours`, valeur en jeu totale (§ 5.1). Seuls les **5
  premiers** de chaque sorte sont détaillés (ruptures d'abord puis du stock le plus bas ; lots du plus
  proche au plus lointain) ; le reste se consulte sur les pages. **Gérant seul**, comme ces pages.

### 3.4 Stock négatif — ⚠ DÉCISION EN ATTENTE
Le schéma autorise un stock négatif, par exemple quand on vend une baguette avant que la réception
du matin soit saisie. La politique reste à valider avec la cliente (voir `DECISIONS.md`). **D'ici
là, ne jamais bloquer une vente** pour cause de stock insuffisant ; afficher une alerte.

---

## 4. Approvisionnements (Dev B)

### 4.1 Réception : ce que fait l'utilisateur
L'utilisateur saisit **ce qu'il a physiquement devant lui**, dans le conditionnement reçu, au prix
payé.

Exemple : il reçoit 3 cartons de tomate. Il scanne le code du carton, saisit la quantité (**3**)
et le prix d'achat du carton (**6 000 F**). L'application affiche en direct
« = 72 boîtes à 250 F/boîte ».

Il ne convertit jamais rien de tête.

### 4.2 Réception : ce que fait l'application à la validation
Tout se fait dans **une seule transaction** :

1. Enregistre les lignes de réception telles que saisies (photo du bon de livraison).
2. Crée un **lot** par ligne si le produit est suivi en péremption. Le numéro de lot et la date de
   péremption sont alors **obligatoires**.
3. Crée un mouvement `reception` en unités de base : quantité reçue × `quantite_base`.
4. **Recalcule le CUMP** du produit (voir 4.3).
5. Crée la **dette fournisseur** (total de la réception) et calcule son échéance à partir du délai
   de paiement du fournisseur.
6. Attribue le numéro `RC-AAAA-NNNNNN`.

Précisions validées par Dev B le 2026-09-30 (B8) :
- **Brouillon** : la réception en cours de saisie ne vit que dans l'écran (gardée sur le poste pour
  survivre à une coupure). Rien n'est écrit en base et **le numéro RC n'est attribué qu'à la
  validation** : pas de trou dans la numérotation, pas de réception abandonnée en base.
- **Prix proposé** pour un conditionnement : le dernier prix payé pour ce même conditionnement ; à
  défaut, le prix d'achat indicatif de l'import × la quantité du conditionnement ; sinon le champ est
  vide. Le prix reste modifiable : on saisit celui du bon de livraison.
- **Prix d'achat** : francs entiers, strictement positif. Alerte non bloquante si le coût par unité
  atteint le prix de vente de l'Unité (comme au stock initial).
- **Quantité reçue** : entière et positive ; décimales permises seulement pour un produit au poids ou
  au volume (kg, g, litre, ml), le total de la ligne étant alors arrondi au franc.
- **Péremption** : n° de lot et date obligatoires ; une date déjà passée est refusée ; une date proche
  (sous `peremption_seuil_jours`) donne une alerte non bloquante.
- **Échéance** de la dette = jour de la réception + délai de paiement du fournisseur à ce moment,
  figée sur la réception (`receptions.date_echeance`).
- **Fournisseur** : seuls les actifs sont proposés et acceptés.
- **Une réception validée ne se modifie ni ne s'annule** : une erreur se corrige par un retour
  fournisseur (§ 8) ou par l'inventaire (§ 9). Elle n'est pas journalisée : le document est sa propre
  trace.
- Plusieurs lignes du même produit (deux lots de lait, par exemple) sont permises ; le CUMP se
  recalcule ligne après ligne. Le lot créé porte le coût par unité arrondi au franc (il ne sert qu'à
  chiffrer la valeur en jeu des péremptions) ; le CUMP garde le coût exact.

### 4.3 CUMP (coût unitaire moyen pondéré)
```
coûtBase       = prix d'achat du conditionnement / quantite_base
nouveauCUMP    = (stockAvant × ancienCUMP + qteBaseReçue × coûtBase) / (stockAvant + qteBaseReçue)
```

Exemples de référence :

- **Premier arrivage** : 3 cartons à 6 000 F donnent 72 boîtes à 250 F. Le CUMP vaut 250.
- **Arrivage suivant**, avec 46 boîtes en stock à 250 F : 2 cartons à 6 600 F donnent 48 boîtes à
  275 F. Le nouveau CUMP vaut (46×250 + 48×275) / 94 = **262,8**.

Cas limite : si le stock avant réception est ≤ 0, le nouveau CUMP est le coût de la réception.

Le CUMP n'est **jamais** modifié ailleurs que dans le service de réception, et au stock initial.

### 4.4 Cas particuliers
- **Code inconnu** à la réception : proposer de créer le produit (formulaire pré-rempli avec le
  code), puis revenir à la réception.
- **Premier achat en carton** d'un produit connu : créer le conditionnement « Carton de N » depuis
  la réception.
- **Livraison en vrac** : choisir le conditionnement « Unité ».
- **Réception partielle** d'une commande : la commande passe au statut `recue_partiel` (§ 4.7).

### 4.5 Dettes fournisseurs
```
solde dû = somme des réceptions − somme des règlements − avoirs reçus
```
Les règlements peuvent être partiels (espèces, mobile money, virement). La vue de référence est
`v_dettes_fournisseurs`.

**Règlements (validé par Dev B le 2026-10-06, B10)** :
- **Droits** : le gérant (et l'admin).
- **Imputation** : le règlement paie une **réception précise** ou le **solde global**. Un règlement
  global couvre d'abord la réception la plus ancienne (ordre d'arrivée).
- **Montant** : francs entiers > 0, **au plus le reste dû** (de la réception choisie, ou le solde
  global). Pas d'avance : une dette ne devient jamais négative.
- **Modes** : espèces, TMoney, Flooz, virement, autre. Référence (n° de transaction) facultative.
- **Date** : aujourd'hui par défaut ; une date passée est acceptée, jamais une date future.
- **Hors caisse** pour l'instant : un règlement n'écrit rien dans la caisse. Payer depuis le tiroir
  viendra après `enregistrerMouvementCaisse()` (Dev A, A8), avec le motif de mouvement de caisse
  `reglement_fournisseur` (ajouté par A8, § 6.10).
- **Pas de numéro** de règlement. Le paiement n'est pas journalisé (comme une réception).
- **Correction** : un règlement saisi par erreur est **annulé** avec motif obligatoire, journalisé
  (`annulation_reglement_fournisseur`). Il reste visible, marqué annulé, et ne compte plus ; on
  ressaisit le bon règlement. Une seule annulation par règlement.
- **Échéancier** : pour chaque réception, total, réglé, reste et échéance (figée à la validation,
  § 4.2). État : « Soldée », « À payer le … » (le jour de l'échéance compris), ou « En retard de N j »
  dès le lendemain. **Alerte d'échéance dépassée** : montant en retard par fournisseur et au total
  sur la page Fournisseurs.
- Un règlement d'un fournisseur désactivé est refusé (sa dette est réglée, § 4.6).
- **Avoirs (B11, § 8)** : un avoir **reçu** s'impute comme un règlement global (réceptions les plus
  anciennes d'abord). S'il dépasse ce qui reste dû, le solde devient **négatif** : c'est un avoir à
  valoir, consommé automatiquement par les livraisons suivantes. Un règlement reste limité au reste
  dû. La désactivation d'un fournisseur est refusée tant que son solde n'est pas nul **ou** qu'un
  avoir est attendu.

### 4.6 Fiches fournisseurs (validé par Dev B le 2026-09-30)
- **Droits** : le gérant (et l'admin), comme la réception d'une livraison.
- **Nom** obligatoire, unique parmi les fournisseurs **actifs** (majuscules et espaces ignorés) ;
  le nom d'un fournisseur désactivé peut être repris.
- **Délai de paiement** : nombre entier de jours, de **0 (comptant)** à **365**. Il fixe l'échéance de
  la dette créée par chaque réception ; le modifier ne change pas les échéances passées.
- **Personne à contacter, téléphone, adresse** : facultatifs, texte libre (pas de format imposé).
- **Désactivation** (jamais de suppression) : motif obligatoire, journalisée
  (`desactivation_fournisseur`, motif). **Refusée tant que le solde dû est supérieur à 0** : désactivé,
  le fournisseur sortirait de `v_dettes_fournisseurs` et sa dette disparaîtrait des comptes. Un
  fournisseur désactivé ne se modifie plus et n'est plus proposé aux réceptions.
- Les modifications de la fiche ne sont pas journalisées (comme les catégories).
- **Historique des achats** (validé par Dev B le 2026-09-30, B7 partie 2), consultable même pour un
  fournisseur désactivé :
  - les **livraisons** d'une période, **90 derniers jours** par défaut, avec leur total ;
  - les **prix d'achat** sur **toute l'histoire** : pour chaque conditionnement acheté, le dernier
    prix payé et sa date, le coût par unité, le nombre de livraisons, et l'écart avec le prix de la
    **livraison précédente de ce même fournisseur** (deux lots d'une même livraison ne comptent pas
    comme deux livraisons) ;
  - pas de comparaison entre fournisseurs ici (rapports, B14).

### 4.7 Commandes fournisseur (validé par Dev B le 2026-10-01)
- **On commande dans le conditionnement**, comme à la réception : « 3 × Carton de 24 à 6 000 F »,
  avec la conversion affichée en direct (« = 72 boîtes »). Le gérant ne convertit jamais de tête.
  Les quantités commandées et reçues se comparent en **unités de base**.
- **Prix prévu** proposé = dernier prix payé pour ce conditionnement (comme à la réception).
- **Proposer depuis les alertes** : liste les produits en rupture ou en stock bas
  (`v_alertes_stock`) ; le gérant coche ceux qu'il commande et **saisit lui-même la quantité**.
  L'application ne calcule aucune quantité.
- **États** :
  - `brouillon` puis `envoyee` par le bouton « Marquer comme envoyée ». Il n'y a pas d'envoi
    automatique : un **aperçu** de la commande se recopie ou se photographie (WhatsApp) ;
    l'impression sur ticket pourra venir plus tard ;
  - à chaque réception liée, **automatiquement** : tout est arrivé → `recue`, sinon `recue_partiel` ;
  - « **Clôturer la commande** » (le reste ne viendra pas) : motif obligatoire, journalisé, → `recue` ;
  - une commande pas encore livrée peut être **annulée** : motif obligatoire, journalisé, → `annulee`.
- **Numéro `CA`** attribué dès la création du brouillon, enregistré en base (une commande peut se
  préparer sur plusieurs jours). Un brouillon abandonné s'annule et garde son numéro : pas de trou.
- **Une ligne par produit** dans une commande (le reste à recevoir se calcule produit par produit,
  quel que soit le conditionnement livré). **Prix prévu facultatif** : le total prévu ne compte que
  les lignes dont le prix est indiqué.
- Une réception ne se lie qu'à une commande **envoyée** ou **reçue en partie** du même fournisseur.
  « Clôturer » ne vaut que pour une commande reçue en partie ; une commande livrée en partie ne
  s'annule plus.
- **Seul le brouillon se modifie.** Une commande envoyée ne se modifie plus : le fournisseur en a
  reçu une version précise ; on l'annule et on en fait une autre.
- **Commande reçue en partie** : elle reste ouverte et affiche le **reste à recevoir** (« 1 carton »).
  À la réception, l'écran propose les commandes ouvertes du fournisseur ; en choisir une
  **pré-remplit les lignes avec le reste à recevoir**, que le gérant ajuste à ce qu'il a devant lui.
- **Le prix payé à la réception l'emporte** sur le prix prévu (la dette vient de la réception) ;
  l'écart s'affiche à titre d'information.
- Un article **non commandé** peut être reçu sur une réception liée à une commande. Une réception
  **sans commande** (achat au marché) reste possible.

---

## 5. Péremptions (Dev B, consommé par Dev A)

- Les dates de péremption sont gérées **par lot**. Un lot correspond à un arrivage.
- **FEFO** (premier périmé, premier sorti) : à la vente, les unités sortent des lots dont la date est
  la plus proche. Une ligne de vente peut se répartir sur plusieurs lots, avec un mouvement par lot.
  `allouerFefo(db, produitId, qteBase)` renvoie cette répartition.
- Le tableau des péremptions liste les lots en stock qui périment sous N jours (paramètre, par
  défaut 15). Il affiche les jours restants, la quantité et la valeur en jeu (quantité × prix
  d'achat du lot).
- Deux actions sont proposées sur un lot :
  - **promotion** (remise temporaire) ;
  - **retirer** (mouvement `perte_peremption`, chiffré dans les pertes).
- Ne pas confondre les deux sens du mot « lot » :
  - un **« lot de 3 »** est un conditionnement de vente ;
  - un **lot d'arrivage** (table `lots`) est une date de péremption.

### 5.1 FEFO et tableau des péremptions (validé par Dev B le 2026-10-04)
- **`allouerFefo`** ne sert que les lots qui ont encore du stock et **ne sont pas périmés** (date de
  péremption ≥ aujourd'hui), de la date la plus proche à la plus lointaine ; à date égale, le lot le
  plus ancien d'abord. Un lot périmé n'est jamais vendu par le FEFO : il reste au tableau des
  péremptions jusqu'à son retrait.
- La répartition couvre **toujours toute la quantité vendue** : si les lots ne suffisent pas (ou si le
  produit n'est pas suivi en péremption), le reste sort **sans lot**. La vente n'est jamais bloquée
  (D-A1) ; l'inventaire régularise ensuite.
- **Tableau des péremptions** : lots en stock qui périment dans `peremption_seuil_jours` jours ou
  moins, **lots déjà périmés compris** (« Périmé depuis 2 j », en rouge). Rouge à 3 jours ou moins,
  ambre au-delà. Valeur en jeu = restant × prix d'achat du lot.
- **Retirer** : quantité saisie (le restant du lot proposé), au plus le restant ; mouvement
  `perte_peremption` sur ce lot, motif « Périmé » d'office, commentaire facultatif ajouté au motif.
  Comme tout mouvement, il est chiffré au CUMP du produit. Gérant. Pas de journal d'audit : le
  mouvement trace déjà qui, quand et pourquoi.
- **Promotion** : une promotion vaut pour tout un produit, et appartient aux promotions programmées
  (A16, Dev A). Le bouton « Promo » est affiché inactif d'ici là.

---

## 6. Caisse et ventes (Dev A)

### 6.1 Session de caisse
- **Aucune vente sans session ouverte.** À l'ouverture, le caissier déclare le fond de caisse.
- Un caissier a au plus une session ouverte. Se déconnecter ne clôture pas la session.
- Une fois clôturée, la session est figée : plus aucune opération ne peut y être rattachée.

### 6.2 Panier
- Scanner deux fois le même conditionnement augmente la quantité de la ligne.
- On peut changer le conditionnement d'une ligne.
- Une ligne à quantité zéro est supprimée.
- On peut mettre un ticket en attente et le reprendre. Plusieurs tickets peuvent être en attente.
- Un code inconnu affiche un message clair et n'empêche pas de scanner l'article suivant.

### 6.3 Enregistrement d'une vente
Tout se fait dans **une seule transaction** :

1. Le service **relit les prix et les coûts en base** à partir des identifiants de conditionnement.
   L'interface n'envoie que des identifiants, des quantités et des paiements.
2. Il attribue le numéro `T-AAAA-NNNNNN`.
3. Il crée une ligne de vente par ligne du panier, en photocopie :
   - `quantite` : nombre de conditionnements ;
   - `prix_unitaire` : prix du conditionnement ;
   - `cout_unitaire` : CUMP × quantite_base ;
   - `quantite_base_totale` : quantite × quantite_base.
4. Il crée un mouvement `vente` de −`quantite_base_totale` par ligne, ou par lot si FEFO.
5. Il enregistre les paiements. **La somme des paiements doit être égale au total TTC**, sinon
   `ErreurMetier`.
6. Si une partie est à crédit, il crée la créance (voir 7).

**FEFO à la vente** (validé par Dev A, 2026-10-12, tâche A9) :
- Un produit **suivi en péremption** sort de ses lots par `allouerFefo` (§ 5.1), ligne après ligne
  dans la transaction : un mouvement `vente` par lot servi, avec son `lot_id`, chiffré au CUMP. Deux
  lignes du même produit sur un ticket se suivent (la seconde voit ce que la première a pris). Un
  produit non suivi sort en un seul mouvement, sans lot.
- `lignes_vente.lot_id` est renseigné quand **un seul lot** sert toute la ligne, `NULL` sinon : le
  détail exact est dans les mouvements de la vente, que le retour client (A7) relira.
- Une part qu'aucun lot valable ne couvre sort **sans lot** (jamais bloquant). Si, pour ce produit, un
  **lot périmé a encore du stock**, l'article vendu en vient peut-être : la vente passe et la caisse
  affiche un bandeau « Lait en poudre : vérifiez la date de l'article vendu, le stock restant connu est
  périmé (LOT-A12). Prévenez le gérant. » (`alertesPeremption` de la réponse de la vente).

L'impression et l'ouverture du tiroir se font **après** la validation de la transaction. Si
l'imprimante échoue, la vente reste enregistrée : afficher « Vente enregistrée, ticket non
imprimé » et proposer la réimpression.

**Ticket imprimé et réimpression** (validé par Dev A, 2026-09-24, tâche A3) :
- La **première impression réussie** d'une vente est l'original ; **toute impression suivante porte
  la mention DUPLICATA**. Le processus principal le déduit du journal d'audit (action
  `impression_ticket`, notée seulement après un envoi réussi) : l'écran ne peut pas demander un
  second original. Un « Réimprimer » après une panne d'imprimante sort donc l'original.
- **Qui réimprime** : une caissière, les tickets de **sa session ouverte** ; le gérant (et l'admin),
  n'importe quel ticket, par son numéro.
- Le **tiroir** s'ouvre à l'impression de l'original d'une vente payée, même en partie, en espèces ;
  jamais pour un duplicata ni pour une vente sans espèces. Une ouverture manuelle (Réglages
  matériel) est journalisée (`ouverture_tiroir_hors_vente`).
- Le ticket tient sur 48 colonnes et affiche la TVA ventilée par taux (§ 6.4), les paiements avec
  leur référence, les espèces reçues et la monnaie rendue.

### 6.4 TVA
Les prix sont TTC. Le calcul se fait **par taux**, puis on additionne :
```
HT(taux)   = arrondi( TTC(taux) / (1 + taux/100) )
TVA(taux)  = TTC(taux) − HT(taux)
```
Le ticket affiche la TVA ventilée par taux. La baguette est à 0 %.

Exemple : un ticket de 13 300 F TTC contient 12 700 F à 18 % et 600 F à 0 %.
- HT à 18 % = arrondi(12 700 / 1,18) = 10 763 F, et la TVA correspondante vaut 1 937 F.
- HT à 0 % = 600 F.
- Total HT = 11 363 F.

### 6.5 Paiements
- Modes de paiement : `especes`, `tmoney`, `flooz`, `carte`, `credit`, `autre`.
- Espèces : saisie du montant reçu et affichage de la **monnaie à rendre**.
- Mobile money : **référence de transaction obligatoire**.
- Paiement mixte possible : plusieurs lignes de paiement sur un même ticket.

### 6.6 Remises
- Une remise s'applique sur une ligne (`remise_ligne`) ou sur le ticket (`remise_globale`), en
  FCFA.
- Plafond pour le caissier : paramètre (`plafond_remise_caissier`). Au-delà, il faut un gérant.
- **Chaque remise est journalisée.**

**Précisions validées par Dev A (2026-10-01, tâche A5)** — le montant du plafond reste à fixer par la
cliente (D-A3) :
- Le plafond porte sur le **total des remises du ticket** (lignes + ticket), pas sur chaque remise :
  sinon il suffirait de découper une remise pour passer dessous.
- **Plafond non renseigné** (`null`) : la caissière ne peut accorder **aucune** remise sans gérant.
  Plafond à 0 : même effet. Le gérant et l'admin ne sont pas plafonnés.
- **Autorisation du gérant** : il tape son code sur la caisse, sans déconnecter la caissière. Le code
  passe par la même vérification que la connexion (verrouillage après 5 codes faux). La remise reste
  au nom de la caissière ; le journal note qui l'a autorisée. L'accord vaut **pour ce ticket, cette
  caissière et jusqu'au total de remises affiché au gérant** : au-delà, il retape son code. Il sert une
  seule fois (consommé par la vente encaissée) et tombe si le ticket est vidé ou si l'application
  redémarre.
- Une remise est un montant entier ≥ 0, jamais supérieur à sa ligne (remise de ligne) ou au total des
  lignes (remise sur le ticket). `total_ligne` = quantité × prix − remise de ligne ; total du ticket
  = somme des lignes − `remise_globale`. Un ticket ne peut pas tomber à 0 F (un don est une sortie de
  stock).
- **TVA d'une remise sur le ticket** : elle est répartie entre les taux **au prorata du TTC de chaque
  taux** (partie entière), le reste de la division allant au taux le plus élevé ; puis la règle 6.4
  s'applique au TTC net de chaque taux. Exemple : 12 700 F à 18 % + 600 F à 0 %, remise de 1 000 F →
  955 F sur le 18 % et 45 F sur le 0 % ; TTC 11 745 + 555 = 12 300, HT 9 953 + 555 = 10 508,
  TVA 1 792.
- Journal : une entrée `remise` par remise appliquée, écrite **dans la transaction de vente** (montant,
  ticket, ligne ou ticket entier, autorisée par). Une remise saisie puis retirée avant l'encaissement
  n'est pas journalisée.
- **Annulation de ligne** (`annulation_ligne`) : l'écran client montre le ticket en permanence, donc
  toute **suppression d'une ligne** et tout **abandon d'un ticket non vide** avant encaissement sont
  journalisés (désignation, quantité, montant). Une simple baisse de quantité ne l'est pas.

### 6.7 Annulation d'un ticket
- Réservée au gérant, avec un motif obligatoire.
- Le ticket passe au statut `annulee`.
- Chaque mouvement de stock est contre-passé et un paiement inverse est créé.
- Le ticket reste visible. Il n'est jamais supprimé.

**Précisions validées par Dev A (2026-10-13, tâche A6)** :
- **Seulement un ticket d'une caisse encore ouverte** (l'erreur de la journée). Après la clôture, le Z
  est figé : on passe par le **retour client** (§ 6.8), qui rembourse sur la caisse du jour.
- **Qui** : le gérant (et l'admin) connecté annule un ticket de n'importe quelle caisse ouverte. La
  caissière annule un ticket de **sa** caisse si le gérant **tape son code sur la caisse**, sans la
  déconnecter (même vérification que la connexion, verrouillage après 5 codes faux, comme pour une
  remise). Le code est vérifié avant l'annulation : un code faux reste compté.
- **En une transaction** : statut `annulee` et motif ; contre-passation de **chaque** mouvement de
  stock du ticket (un par lot depuis le FEFO) ; un paiement inverse par paiement d'origine (la somme
  des paiements du ticket revient à 0) ; journal `annulation_ticket` (numéro, montant, motif, et le
  gérant qui a autorisé si ce n'est pas lui qui annule).
- Un ticket annulé ne compte plus dans le X ni dans le Z : les espèces théoriques baissent de sa part
  en espèces, que l'on **rend au client**. Le tiroir s'ouvre alors, après la transaction ; une panne
  ne bloque pas l'annulation. Le mobile money se renvoie au client par TMoney ou Flooz (référence
  d'origine rappelée). Rien ne s'ouvre pour un ticket payé seulement en mobile money.
- **Réimpression** d'un ticket annulé : mention « TICKET ANNULÉ » et motif, paiements d'origine,
  jamais d'ouverture du tiroir.

### 6.8 Retour client
1. On part du **ticket d'origine**, retrouvé par son numéro, et on sélectionne les lignes
   retournées. On ne peut pas retourner plus que ce qui a été vendu, retours précédents compris.
2. Le motif est obligatoire.
3. Sort du produit retourné :
   - **remise en stock** : un mouvement `retour_client` (+) ;
   - **destruction** : un mouvement `retour_client` (+), puis un mouvement `casse` (−).
4. Remboursement : espèces, mobile money ou avoir en boutique.
5. L'application crée une vente de type `retour`, liée à l'originale (`vente_origine_id`), avec un
   paiement négatif.

**Précisions validées par Dev A (2026-10-13, tâche A7)** :
- **Ticket d'origine** retrouvé par son numéro complet, ou « 158 » pour `T-<année en cours>-000158`.
  Refus : ticket annulé, document qui n'est pas un ticket de vente (un retour ne se retourne pas),
  ticket entièrement retourné. **Aucun délai limite** pour l'instant (à proposer à la cliente).
- **Qui** : le gérant (et l'admin), ou la caissière si le gérant **tape son code sur la caisse**, comme
  pour l'annulation (§ 6.7), vérifié hors transaction, un code faux reste compté.
- **Sur quelle caisse** : la caisse **ouverte de celui qui fait le retour**, quel que soit le jour du
  ticket. Sans caisse ouverte : « Ouvrez votre caisse avant de faire un retour ».
- **Quantité** : en conditionnements de la ligne vendue (on ne rend pas 1 boîte d'un carton), pas plus
  que vendu moins les retours précédents, **ligne par ligne** (`lignes_vente.ligne_origine_id`).
- **Montant rendu** : ce que le client a réellement payé pour la ligne, net de sa remise et de sa part
  de la remise du ticket (répartie entre les lignes au prorata, comme au § 6.6), au prorata de la
  quantité rendue, partie entière. Le retour qui rend les **derniers** conditionnements d'une ligne
  prend le reste : une ligne rendue en plusieurs fois rend exactement le payé. Exemple : 3 unités
  remisées de 100 F (950 F payés) rendues une à une → 316, 316, 318 F.
- **Remboursement** : espèces, TMoney ou Flooz, au choix (le mode d'origine est proposé). Référence du
  transfert obligatoire en mobile money. En espèces, **pas plus que les espèces théoriques du tiroir**
  (comme toute sortie, § 6.10). L'**avoir en boutique** : voir § 7.2. Ticket **à crédit** : voir § 7.3.
- **Le retour** : numéro **`R-AAAA-NNNNNN`**, `type = 'retour'`, montants **négatifs** (lignes,
  HT/TVA/TTC ventilés comme à la vente, paiement), motif en clair (`motif_retour`) et sort
  (`sort_retour`). Le ticket d'origine n'est jamais modifié. Rien n'est écrit dans `mouvements_caisse` :
  le X et le Z lisent les remboursements dans les paiements des retours (§ 6.9).
- **Stock** : un `retour_client` (+) sur les **lots servis à la vente**, le dernier servi d'abord, sans
  dépasser ce que chaque lot a vendu moins les retours précédents, au coût de la sortie d'origine ;
  « Détruire » ajoute aussitôt un `casse` (−) sur le même lot (la perte apparaît dans les rapports de
  pertes). Le CUMP ne change pas.
- **Tiroir** : il s'ouvre après la transaction pour un remboursement en espèces ; une panne ne bloque
  pas le retour. Le ticket de retour imprimé porte « RETOUR CLIENT », le ticket d'origine, le motif,
  le sort et « Rendu : … » ; son impression n'ouvre jamais le tiroir.
- **Journal** : `retour_client` (numéros, montant, mode, motif, sort, gérant qui a autorisé).
- Un retour ne s'annule pas (A6 refuse tout ce qui n'est pas un ticket de vente).

### 6.9 Rapport X et clôture (rapport Z)
```
espèces théoriques = fond d'ouverture
                   + ventes payées en espèces (tickets terminés)
                   + entrées de caisse (encaissements de créances, apports)
                   − sorties de caisse (dépenses payées au tiroir, retraits, remboursements)
écart = espèces comptées − espèces théoriques      (négatif = manque)
```
- Le rapport **X** se consulte à tout moment sans clôturer.
- La **clôture** enregistre dans `sessions_caisse` les espèces théoriques, les espèces comptées et
  l'écart, avec un commentaire. Elle imprime ensuite le rapport **Z**.

**Précisions validées par Dev A** (2026-09-25, tâche A4) :
- « Ventes en espèces » = la **part payée en espèces** des tickets terminés (paiements), jamais le
  montant reçu : la monnaie rendue ne reste pas dans le tiroir. Un ticket annulé ne compte pas.
- Les espèces théoriques sont **recalculées par le processus principal** à la clôture ; l'écran
  n'envoie que le compté (entier ≥ 0) et le commentaire.
- **Qui clôture** : la caissière, sa propre session ; le gérant (et l'admin), n'importe quelle
  session ouverte (caissière absente, session oubliée la veille). Journal : `cloture_session_caisse`.
- **Commentaire obligatoire si l'écart n'est pas nul** ; facultatif si l'écart est nul.
- **Rapport Z** : la première impression réussie est l'original, les suivantes portent
  **DUPLICATA** (journal, action `impression_rapport_z`). Caissière : le Z de sa dernière session
  clôturée ; gérant : tous. Une imprimante en panne n'annule jamais la clôture. Le **X** (session
  ouverte) porte « Provisoire » et n'est pas journalisé.
- Une session clôturée est figée par le service (aucune vente ni seconde clôture), sans trigger.
- **Retours client (A7, 2026-10-13)** : les « remboursements » de la formule sont les paiements des
  retours (`type = 'retour'`) de la session. Les ventes par mode et le nombre de tickets restent ceux
  des tickets de vente ; le X et le Z ajoutent un bloc « Retours client » (nombre, rendu par mode) et
  la ligne « − Remboursements (retours) » dans les espèces.

Exemple de référence :

| Poste                              | Montant   |
|------------------------------------|-----------|
| Fond d'ouverture                   | 10 000    |
| + Ventes en espèces                | 46 200    |
| + Encaissement de créance          | 3 500     |
| − Dépense                          | 1 000     |
| **= Espèces théoriques**           | **58 700**|
| Espèces comptées                   | 58 200    |
| **Écart**                          | **−500**  |

### 6.10 Mouvements de caisse
- Apports et retraits d'espèces hors vente : motif obligatoire, réservés au gérant.
- Dev A fournit à Dev B `sessionOuverte(db)` et `enregistrerMouvementCaisse(db, …)`, utilisés pour
  les dépenses payées au tiroir.

**Précisions validées par Dev A (2026-10-08, tâche A8)** :
- **Saisie au tiroir** : le gérant (et l'admin) saisit un **apport** (entrée), un **retrait** (sortie)
  ou un **« Autre »** (il choisit le sens), avec un montant en francs entiers > 0 et un **motif en
  clair obligatoire**, imprimé sur le X et le Z (« Retrait (versement à la banque) »). Les autres
  motifs (dépense, encaissement de créance, remboursement, règlement fournisseur) naissent de leur
  document et ne se saisissent pas à la main.
- **Session visée** : une seule caisse ouverte → elle est prise d'office ; plusieurs → le gérant
  choisit celle du tiroir. `sessionOuverte(db)` sans utilisateur renvoie la seule session ouverte,
  sinon `null` (aucune ou plusieurs : l'écran fait choisir dans `sessionsOuvertes(db)`).
- **Une sortie ne dépasse jamais les espèces théoriques** du tiroir à cet instant (« Il n'y a que
  12 500 F en caisse… »). Cela vaut pour les dépenses et les règlements payés au tiroir.
- **Session clôturée = figée** : aucun mouvement ne s'y rattache (service et trigger de la base).
- **Tiroir** : il s'ouvre après l'enregistrement, hors transaction. S'il ne s'ouvre pas (imprimante
  en panne), le mouvement reste enregistré et l'écran le dit. Pas de bon imprimé.
- **Journal** : chaque mouvement de caisse (`mouvement_caisse`), quelle que soit son origine.
- **Correction** : un mouvement ne se modifie ni ne s'efface. Il s'**annule** par un contre-mouvement
  de sens inverse, même montant, même motif et même document, lié à l'original
  (`mouvement_origine_id`), avec un motif d'annulation obligatoire, journalisé
  (`annulation_mouvement_caisse`). Une seule annulation par mouvement, jamais d'annulation d'une
  annulation, et seulement **tant que la session est ouverte**. Annuler une entrée est une sortie :
  elle doit tenir dans le tiroir. Au tiroir, le gérant n'annule que ce qui s'y saisit (apport,
  retrait, autre) ; une dépense ou un règlement s'annule depuis son document, qui appelle
  `annulerMouvementCaisse`. Le X et le Z listent les deux lignes (« Annulation : Apport (erreur) »).

### 6.11 Numérotation
| Préfixe | Document                 | Module | Développeur |
|---------|--------------------------|--------|-------------|
| `T`     | Ticket                   | caisse | Dev A       |
| `R`     | Retour client            | caisse | Dev A       |
| `F`     | Facture                  | caisse | Dev A       |
| `PF`    | Proforma                 | caisse | Dev A       |
| `AV`    | Avoir en boutique        | clients | Dev A      |
| `RC`    | Réception                | achats | Dev B       |
| `CA`    | Commande d'achat         | achats | Dev B       |
| `INV`   | Inventaire               | inventaires | Dev B  |
| `DEP`   | Dépense                  | dépenses | Dev B     |

Les numéros ont la forme `PREFIXE-AAAA-NNNNNN`. Ils sont séquentiels, sans trou, et le compteur
repart à 1 chaque année.

### 6.12 Facture (validé par Dev A, 2026-10-15, tâche A10)
- Une facture se fait à partir d'un **ticket déjà encaissé** : le client paie à la caisse, puis demande
  sa facture. Elle ne crée **ni vente, ni mouvement de stock, ni paiement**, et ne demande pas de
  caisse ouverte. **Une seule facture par ticket**, numéro **`F-AAAA-NNNNNN`** (table `factures`).
- Ticket retrouvé par son numéro complet ou court (« 158 »). Refus : ticket annulé, document qui n'est
  pas un ticket de vente (retour), ticket entièrement retourné, ticket déjà facturé (« rééditez-la »).
- **Client** : nom (ou raison sociale) obligatoire ; téléphone, adresse et NIF facultatifs ; recopiés
  sur la facture au moment T. La fiche client (A11) permettra ensuite d'en choisir un.
- **Contenu** (A4) : nom, adresse et NIF de la boutique (`boutique_nif`) ; numéro et date de la
  facture ; ticket d'origine, sa date et la caisse ; le client ; les lignes (désignation, quantité,
  prix unitaire TTC, remise, taux de TVA, total TTC) ; remise sur le ticket ; HT et TVA **par taux**
  (§ 6.4, mêmes chiffres que le ticket), total HT, TVA, TTC ; mention **« Payée »** avec les modes de
  paiement et leurs références ; si le ticket a eu des **retours**, une section « Retours » (numéro R,
  date, lignes rendues) et le **net payé** ; « Arrêtée la présente facture à la somme de … francs CFA »
  (**net payé en toutes lettres**). Autres mentions légales (RCCM, régime fiscal) : à confirmer avec la
  cliente ; NIF seulement d'ici là.
- **Sortie** : PDF enregistré où l'on veut (clé USB, envoi par WhatsApp), ou fenêtre d'impression de
  Windows (imprimante A4 s'il y en a une), toujours hors transaction. La **première sortie réussie de
  chaque sorte** (un PDF enregistré, une impression) est l'original ; les suivantes portent **« COPIE »**.
  Une sortie annulée par l'utilisateur ne compte pas.
- **Qui** : caissière et gérant, n'importe quel ticket. Journal : `facture` (création),
  `edition_facture` (chaque sortie réussie, avec original ou copie).

### 6.13 Proforma (validé par Dev A, 2026-10-15, tâche A10)
- Un **devis** fait depuis le panier de la caisse (bouton « Proforma ») : **pas de vente, pas de
  stock, pas de paiement, pas besoin de caisse ouverte**. Numéro **`PF-AAAA-NNNNNN`** (tables
  `proformas`, `lignes_proforma`).
- Prix, remises, désignations et TVA **relus en base** et recopiés, comme à la vente (§ 6.3, 6.6) ;
  client facultatif (mêmes champs que la facture).
- **Validité imprimée : 30 jours** (« Valable jusqu'au … ») ; durée à proposer à la cliente comme
  paramètre.
- **Reprise dans la caisse** : la proforma recharge ses lignes dans le panier ; la vente se fait **aux
  prix du jour** (le service relit toujours les prix) ; si un prix a changé, la caisse le signale. La
  proforma ne garantit donc pas le prix.
- Même sortie PDF / impression que la facture. Journal : `proforma`.
- Précisions de réalisation (PR 2) : les remises suivent le **plafond de la caissière** (§ 6.6) ; l'accord
  du gérant n'est **pas consommé** par la proforma (il servira à la vente). Proforma retrouvée par son
  numéro complet ou court (« 12 » = `PF-<année>-000012`). Une proforma **périmée** est signalée, sa
  reprise reste possible (aux prix du jour, comme toujours). Un article retiré de la vente est signalé
  et ne revient pas au panier. Le PDF d'une proforma ne porte ni original ni « COPIE » : c'est un devis.

---

## 7. Clients, crédits et recouvrement (Dev A)

- Chaque client a un **plafond de crédit**. Un plafond de 0 signifie qu'aucun crédit n'est
  autorisé. La vente à crédit est **bloquée** si l'encours après la vente dépasserait ce plafond.
- Une créance naît de la partie d'une vente payée en mode `credit`, avec une date d'échéance.
- Calcul du restant dû :
  ```
  restant dû = montant initial − somme des encaissements
  ```
  La créance passe au statut `soldee` quand le restant dû atteint 0.
- **Chaque encaissement de créance passe par la session de caisse en cours** : un mouvement de
  caisse `entree` est créé si le paiement est en espèces.
- La **balance âgée** classe le restant dû par ancienneté de la créance : 0–30 jours, 31–60 jours,
  plus de 60 jours.

### 7.1 Précisions validées par Dev A (2026-10-28, A11)
- **Fiche client** : nom obligatoire ; téléphone, adresse et NIF facultatifs ; **téléphone obligatoire
  dès que le plafond dépasse 0** (pour relancer). Un même téléphone ne sert pas à deux clients actifs
  (deux fiches doubleraient le plafond) ; deux clients de même nom sans téléphone restent possibles.
- **Droits** : la caissière crée un client (plafond 0) et corrige ses coordonnées ; **seul le gérant**
  fixe ou change un plafond (journal `plafond_credit`, avant / après). Désactivation par le gérant, motif
  obligatoire, **refusée tant que le client doit de l'argent** ; jamais de suppression.
- **Encours** = restant dû des créances non annulées ; la part dont l'échéance est dépassée est
  affichée à part (« en retard »).
- **Vente à crédit** : la caissière vend à crédit sans code du gérant tant que le plafond tient ; au-delà,
  **refus strict** (le gérant relève d'abord le plafond dans la fiche). Crédit sans client : refusé.
  Échéance **30 jours** par défaut, modifiable à l'encaissement ; une créance échue impayée affiche une
  alerte sans bloquer.
- **Ticket à crédit** : nom du client, part à crédit, échéance, ligne « Signature du client » ; imprimé
  en **deux exemplaires** (client, et boutique qui garde la copie signée).
- **Annulation d'un ticket à crédit** (§ 6.7) : la créance est annulée (`annulee_le`, motif), sauf si un
  encaissement a déjà eu lieu sur elle (refus).
- **Retour sur un ticket à crédit** (§ 6.8) : accepté depuis A12, la part à crédit réduit la dette (§ 7.3).
- **Avoir en boutique** (reporté depuis A7) : dernière partie d'A11.
- Journal : `creation_client`, `modification_client`, `plafond_credit`, `desactivation_client`,
  `vente_credit` (`numeroTicket`, `client`, `montant`, `echeance`).
- Précisions de réalisation (PR 2) : **une seule part à crédit** par ticket ; le plafond est relu dans la
  transaction de la vente (deux ventes simultanées ne le dépassent pas à elles deux) ; l'encours exact au
  plafond passe ; échéance dans le passé refusée ; un client peut être joint à une vente sans crédit
  (`ventes.client_id`). La part à crédit compte dans « Ventes crédit » du X / Z et dans le chiffre
  d'affaires (§ 11), jamais dans les espèces théoriques. À l'annulation, rien n'est rendu pour la part
  à crédit : la créance est annulée. Un duplicata du ticket à crédit ne sort qu'en exemplaire boutique.

### 7.2 Avoir en boutique (validé par Dev A, 2026-11-01)
- Un **avoir** est un crédit **nominatif** (toujours au nom d'un client actif) né d'un retour client
  remboursé « en avoir ». Numéro **`AV-AAAA-NNNNNN`**. Il ne se rembourse pas en argent ensuite, n'expire
  pas, et se dépense à la caisse **en une ou plusieurs fois** (une part du ticket, le solde est gardé).
- **Création** (retour client, § 6.8) : mêmes droits que tout retour (gérant, ou caissière avec le code du
  gérant). Le retour garde son paiement négatif, de mode `avoir` : **rien ne sort du tiroir ni du mobile
  money**. Le ticket de retour porte le numéro de l'avoir et le solde du client.
- **Solde** = montant − utilisations, calculé (vue `v_avoirs_clients`), jamais stocké. Les avoirs d'un client
  se dépensent **du plus ancien au plus récent**.
- **Dépense** : mode de paiement « Avoir » à la caisse, après le choix du client, jamais au-delà du solde
  (le service relit le solde dans la transaction). La caissière peut l'utiliser. La part payée par avoir
  n'entre ni dans les espèces théoriques ni dans TMoney / Flooz : le X et le Z la montrent à part.
- **Annulation d'un ticket** payé en partie par avoir : l'avoir est rétabli par une ligne négative liée
  (`utilisation_origine_id`), une seule fois ; rien n'est effacé.
- **Retour sur un ticket payé en partie par avoir** : il se rembourse **uniquement en avoir**, au nom du client
  du ticket (le remboursement ne peut pas sortir en argent ce que le client a payé en avoir).
- **Un client qui a un solde d'avoir ne se désactive pas.**
- Journal : le `retour_client` porte `avoir` (numéro) et `client` ; la dépense se lit dans le paiement du ticket.

### 7.3 Recouvrement des créances (validé par Dev A, 2026-11-01, A12)
- **Qui encaisse** : la caissière comme le gérant, sur **leur** caisse ouverte (« Ouvrez votre caisse avant
  d'encaisser un paiement »). Seul le **gérant annule** un encaissement.
- **Modes** : espèces, TMoney, Flooz ; référence du transfert obligatoire en mobile money. Les **espèces**
  créent une entrée de caisse `encaissement_creance` (une par créance payée, commentaire « client, ticket »),
  donc entrent dans les espèces théoriques ; le **mobile money n'y entre jamais** (il apparaît seulement dans
  le bloc « Créances encaissées » du X, du Z et de l'écran de clôture, par mode).
- **Imputation** : le paiement va sur la créance choisie ; sans choix, sur la **plus ancienne d'abord**, et se
  répartit sur plusieurs créances (chacune soldée avant la suivante, la dernière peut rester partielle).
  **Jamais plus que ce que le client doit** (refus, et trigger de la base). Paiement partiel autorisé.
- **Reçu** : un paiement a un numéro **`EC-AAAA-NNNNNN`** (toutes ses lignes le partagent) et sort sur
  l'imprimante (tickets payés, reste dû par ticket, reste à payer), le tiroir s'ouvrant dans le même envoi pour
  les espèces. Imprimante en panne : le paiement reste enregistré, l'écran le dit (jamais bloquant).
- **Statut** d'une créance (calculé par la vue) : `soldee` quand le restant dû est 0, sinon `ouverte`, `annulee`
  si son ticket est annulé. Restant dû = initial − encaissements non annulés − réductions par retour.
- **Annulation d'un paiement** (gérant, **motif obligatoire**, tant que la **caisse du paiement est ouverte**,
  une seule fois) : table `annulations_encaissements` ; les espèces ressortent par un contre-mouvement de caisse
  (refusé s'il n'y a plus assez d'espèces, § 6.10) ; la dette est rétablie ; journal `annulation_encaissement`.
  Rien n'est effacé. Une caisse clôturée est figée : l'annulation est refusée.
- **Annulation d'un ticket à crédit** (§ 6.7) : toujours refusée tant qu'un encaissement existe (même annulé).
- **Balance âgée** (gérant) : restant dû par client, classé selon l'**ancienneté de la créance** (date de la
  vente) : 0–30, 31–60, plus de 60 jours.
- **Liste de relance** (gérant, imprimable) : clients dont **au moins une échéance est dépassée**, du plus
  en retard au moins en retard, avec téléphone, tickets échus et montant échu, regroupée en 0–30 / 31–60 / +60
  jours **de retard**. Un client à jour n'y figure pas.
- **Historique d'un client** : crédits, paiements, annulations et réductions par retour, avec ce qu'il devait
  après chaque ligne. Une créance annulée n'y figure pas.
- **Retour sur un ticket à crédit** (§ 6.8) : la **part du retour qui était à crédit** réduit la créance restante
  (table `reductions_creances`, montant initial intact), calculée **au prorata du ticket** (le retour qui solde
  le ticket prend le reste), **jamais plus que ce que le client doit encore**. Seul le reste se rembourse, dans le
  mode choisi (espèces plafonnées au tiroir, TMoney, Flooz, avoir) ; si la dette absorbe tout, rien n'est rendu et
  aucun paiement n'est écrit. Exemple : ticket 2 800 F espèces + 4 200 F crédit, retour de 1 750 F → 1 050 F de
  dette en moins + 700 F rendus ; le client a déjà payé 3 000 F d'un crédit de 3 500 F et rend tout → 500 F de
  dette en moins + 3 000 F rendus. Le ticket de retour imprime « Dette du client réduite de … ».
- Journal : `encaissement_creance` (`recu`, `client`, `montant`, `mode`, `reference`, `tickets`, `resteDu`) et
  `annulation_encaissement` (`recu`, `client`, `montant`, `motif`) ; le `retour_client` porte `creanceReduite`.

---

## 8. Sorties de stock et retours fournisseur (Dev B)

- Motifs de sortie de stock : défectueux ou casse (`casse`), périmé (`perte_peremption`), vol
  constaté (`vol`), don. **Le motif est toujours obligatoire.**
- Pour un don : utiliser le type `casse` avec le motif « don » tant qu'aucun type dédié n'existe.
  Un type dédié demanderait une migration du CHECK ; c'est à décider avec les deux développeurs.
- **Retour fournisseur** :
  1. Mouvement `retour_fournisseur` (−).
  2. **Avoir attendu** = quantité × coût d'achat. Exemple : 2 boîtes bombées × 250 F = 500 F.
  3. L'avoir est déduit de la dette quand il est confirmé.

**Précisions validées par Dev B le 2026-10-06 (B11)** :
- **Droits** : le gérant (et l'admin).
- **Motifs** : « Défectueux ou casse » (`casse`), « Périmé » (`perte_peremption`), « Vol constaté »
  (`vol`), « Don » (`casse`, libellé « Don »). Commentaire facultatif, ajouté au libellé
  (« Défectueux ou casse : boîtes bombées »).
- **Quantité** en unités de base, entière sauf au poids ou au volume ; **au plus le stock** du lot
  choisi, ou du produit pour une sortie sans lot (une sortie n'est pas une vente : D-A1 ne s'applique
  pas). Le mouvement est chiffré au **CUMP**.
- **Lot** : pour un produit suivi par lots, on choisit le lot parmi ceux en stock ; le plus proche de
  sa date est proposé. Une sortie sans lot reste possible.
- **Retour fournisseur** : seulement pour « Défectueux ou casse » et « Périmé ». Fournisseur proposé :
  celui du lot (via sa réception), sinon le dernier qui a livré ce produit ; modifiable, actifs
  seulement. Le mouvement est de type `retour_fournisseur` (document `retour_fournisseur`).
- **Coût de l'avoir** : prix d'achat du lot s'il vient de ce fournisseur, sinon le dernier prix
  payé à ce fournisseur pour ce produit (prix du conditionnement / quantité de base), sinon le CUMP.
  Avoir attendu = quantité × coût, **arrondi au franc**, corrigeable avant validation.
- **Suite de l'avoir** : « Avoir reçu » (montant reçu en francs entiers > 0, peut différer de
  l'attendu ; date jamais future ; référence facultative ; non journalisé, comme un règlement), qui
  se déduit de la dette (§ 4.5) ; ou « Refusé » avec motif, journalisé (`refus_avoir_fournisseur`).
- **Correction** : une sortie s'annule par **contre-passation**, motif obligatoire, journalisée
  (`annulation_sortie_stock`), une seule fois. Avec un retour, l'avoir doit être encore attendu : il
  passe à « annulé » ; une sortie dont l'avoir est reçu ou refusé ne s'annule plus. Les retraits du
  tableau des péremptions (§ 5.1) s'annulent de la même façon ; une casse issue d'un retour client
  (Dev A) non.
- **Pas de numéro** de sortie ni de retour. L'historique du produit affiche « Sortie de stock » ou
  « Retour à <fournisseur> ».

---

## 9. Inventaires (Dev B)

- Un inventaire est **total**, ou **partiel** par rayon ou par catégorie.
- La quantité théorique est **photographiée au moment du comptage**.
- Le comptage se fait **par conditionnement**, puis il est converti en unités de base.
  Exemple : 1 carton + 5 lots + 2 unités = 24 + 15 + 2 = **41** boîtes.
  Le détail du comptage est conservé dans `detail_comptage`, au format JSON.
- L'écart est une colonne **générée** (`comptee − theorique`). Il ne peut donc pas être incohérent.
- Un **motif est obligatoire pour chaque écart non nul** : casse, vol, erreur de saisie,
  péremption, don, autre.
- La validation est faite par un gérant. Elle crée un mouvement `ajustement_inventaire` par écart
  non nul, au CUMP, et produit un **rapport de démarque chiffré**.
  Exemple : 2 savons manquants à 150 F = 300 F.
- Une fois validé, un inventaire est figé.

### 9.0 Précisions (validées par Dev B le 2026-10-07)
- **Gérant** (et admin) seul : ouvrir, compter, valider, annuler.
- **Un seul inventaire en cours** à la fois. Numéro `INV` donné **dès l'ouverture** (gardé s'il est
  annulé).
- Partiel = **un rayon et ses sous-rayons** (ou un seul sous-rayon). Un produit hors du périmètre se
  refuse au comptage.
- Chaque comptage est **enregistré aussitôt** (une transaction par produit : une coupure ne perd que
  le produit en cours). Le théorique est photographié **à l'enregistrement du comptage** : une vente
  faite ensuite reste dans le stock après l'ajustement (27 comptés, 1 vendu ensuite → 26).
- Tant que l'inventaire est en cours, un **recomptage remplace** le comptage et reprend le théorique.
  Compter 0 est un comptage (tout manque).
- Le motif est choisi **au comptage** quand l'écart n'est pas nul, avec un **commentaire facultatif**
  (« vol présumé »).
- **Produits non comptés** à la validation (inventaire total ou partiel) : **leur stock ne change pas** ;
  l'écran l'annonce avant de valider. Valider sans aucun comptage est refusé.
- Produits suivis en péremption : on compte **le produit en entier**, pas lot par lot. À la validation,
  un **manquant** est retiré des lots, la **date la plus ancienne d'abord, périmés compris** ; ce que
  les lots ne couvrent pas sort sans lot. Un **surplus** entre sans lot.
- Mouvements `ajustement_inventaire` au **CUMP du moment de la validation**, document `inventaire`,
  motif « Inventaire INV-… : Vol (vol présumé) ».
- **Rapport de démarque** : manquants (écarts négatifs × CUMP, arrondis au franc par produit),
  surplus (écarts positifs × CUMP) et net = surplus − manquants.
- **Annulation** d'un inventaire en cours : motif obligatoire, journalisée (`annulation_inventaire`),
  aucun mouvement. Validé ou annulé, l'inventaire est figé (triggers en base).
- **Stock initial** au démarrage : même mécanisme, avec le document `stock_initial` et le coût
  d'achat saisi, qui initialise le CUMP (détail en 9.1).

### 9.1 Stock initial de démarrage (validé par Dev B le 2026-09-25)
- Gérant. On compte **produit par produit**, par conditionnement (1 carton de 24 + 5 lots de 3 +
  2 unités = **41**) ; chaque produit est **enregistré aussitôt**, en une transaction : une coupure
  de courant ne fait perdre que le produit en cours.
- **Une seule fois par produit**, et seulement pour un produit **sans réception** (sinon son stock
  et son CUMP viennent déjà des réceptions : il est « non concerné »).
- La quantité comptée est le **stock réel**. Le comptage est un mouvement `ajustement_inventaire`
  (document `stock_initial`, motif « Stock initial : 1 Carton de 24 + 5 Lot de 3 + 2 Unité ») ; si
  des mouvements existaient déjà (ventes faites avant le comptage), un second mouvement les remet à
  zéro (motif « Stock initial : remise à zéro des mouvements antérieurs au comptage »). Exemple :
  3 ventes, puis 41 comptés → mouvements +41 et +3, stock 41.
- **Coût d'achat par unité** obligatoire, en francs entiers, supérieur à 0, pré-rempli avec le prix
  d'achat indicatif de l'import (§ 2.6). Le CUMP prend **exactement** cette valeur. Un coût supérieur
  ou égal au prix de vente de l'unité déclenche une alerte, sans bloquer.
- Produit suivi en péremption : **date de péremption obligatoire**, n° de lot facultatif ; un lot est
  créé au coût saisi et porte la quantité comptée (pour le FEFO). Une seule date par produit au
  stock initial.
- Un comptage vide (0) est refusé : le produit reste « à compter ».
- **Correction** : « Annuler le stock initial » (gérant, **motif obligatoire**, journalisé
  `annulation_stock_initial`) contre-passe ses mouvements ; le produit repasse « à compter ».
  Impossible une fois une réception arrivée (on corrige alors par un inventaire).
- Chaque stock initial est journalisé (`stock_initial` : quantité, coût, détail, stock avant).

---

## 10. Dépenses (Dev B)

- Chaque dépense a une catégorie (loyer, électricité, salaires, transport…), un libellé, un montant,
  et éventuellement une photo de justificatif.
- Source **« caisse »** : une session doit être ouverte. La dépense crée un mouvement de caisse
  `sortie`, via la fonction fournie par Dev A.
- Source **« fonds propres »** : la dépense n'a aucun effet sur la caisse.
- Numéro de la forme `DEP-AAAA-NNNNNN`.

### 10.1 Précisions (validées par Dev B le 2026-10-08)
- **Catégories** : neuf de départ, présentes aussi en production (Loyer, Électricité, Eau, Salaires,
  Transport, Entretien et réparations, Fournitures, Impôts et taxes, Autre). Le gérant en crée et en
  désactive, jamais de suppression ; il reste toujours au moins une catégorie active. Le nom est unique
  parmi **toutes** les catégories, désactivées comprises (majuscules et espaces ignorés) : la base
  l'impose, et la réactivation n'est pas prévue. Une dépense garde sa catégorie désactivée.
- **Saisie** : catégorie active, libellé obligatoire, montant en francs entiers > 0, pas de plafond.
  Date du jour par défaut ; une date passée est acceptée pour « fonds propres », jamais une date
  future ; une dépense « caisse » est toujours datée du jour. Numéro `DEP` attribué à l'enregistrement.
- **Justificatif** : référence texte facultative (n° du reçu ou de la facture). La photo est reportée.
- **Droits** : gérant (et admin) pour tout. La caissière n'enregistre que des dépenses « caisse »,
  sur sa session ouverte (§ 10.2).
- **Correction** : annulation par le gérant, motif obligatoire, journalisée (`annulation_depense`,
  § 1.4), une seule fois. La dépense reste visible et ne compte plus dans les totaux. Une dépense
  « caisse » s'annule par une entrée de caisse compensatoire, refusée si la session est clôturée
  (§ 10.2).
- **Liste** : 30 derniers jours par défaut, filtre par catégorie, total et total par catégorie (hors
  annulées).

### 10.2 Dépense payée au tiroir (validé par Dev B le 2026-10-28)
- **Quelle caisse** : la caissière paie toujours sur **sa** caisse ouverte (refus sinon : « Ouvrez votre
  caisse… »), jamais sur celle d'une autre ; elle ne saisit pas de dépense « fonds propres ». Le gérant
  paie sur la caisse qu'il choisit, sinon sur la sienne si elle est ouverte, sinon sur la seule caisse
  ouverte ; s'il y en a plusieurs, il doit choisir ; s'il n'y en a aucune, refus.
- **Écriture** : dans une seule transaction, la dépense (datée du jour, `session_caisse_id`) et un
  mouvement de caisse `sortie`, motif `depense`, `document_type = 'depense'`, commentaire = libellé
  (« Dépense (Taxi-moto) » sur le X et le Z). La sortie ne dépasse jamais les espèces théoriques du
  tiroir (règle de Dev A, § 6.10) : sinon rien n'est écrit et aucun numéro DEP n'est consommé.
- **Annulation** : gérant seulement, tant que la caisse est ouverte ; les espèces reviennent au tiroir
  par un contre-mouvement lié à la sortie. Après la clôture, refus : le Z est figé.
- **Liste de la caissière** : les dépenses de sa caisse ouverte seulement, sans période ni catégories ni
  annulation ; après sa clôture, la liste est vide.
- Exemple (vendredi soir, `SCENARIO_REFERENCE.md`) : fond 10 000 + espèces 46 200 + créance 3 500 −
  taxi-moto 1 000 = **58 700** d'espèces théoriques.

---

## 11. Rapports

- **Chiffre d'affaires** : somme des `total_ligne` des ventes au statut `terminee`. Les retours se
  soustraient.
- **Marge brute** :
  ```
  marge brute = Σ total_ligne − Σ (quantite × cout_unitaire)
  ```
  Elle se calcule sur les lignes, donc avec les coûts photocopiés au moment de la vente.
- **Précisions de réalisation (A14, validées par Dev A le 2026-10-28)**, canal `caisse:ventesPeriode`
  et fonction `ventesPeriode(db, { du, au })` de `modules/caisse/service-rapports.ts` :
  - **chiffre d'affaires = Σ `ventes.total_ttc`** des tickets et des retours au statut `terminee` (et
    non Σ `total_ligne`) : la remise sur le ticket n'est pas dans les lignes d'un ticket ; elle l'est
    dans celles d'un retour, au prorata. Un ticket annulé, une facture, une proforma ne comptent pas ;
  - **un retour rend son coût** : coût = Σ `quantite × cout_unitaire` des lignes de tickets **moins**
    celles des retours. Une boîte détruite au retour est déjà comptée en casse dans les pertes (§ 11.1) ;
  - chaque document compte **à sa propre date** (un retour du jour sur un ticket d'hier compte aujourd'hui) ;
  - le coût (à virgule, CUMP) est arrondi au franc **une seule fois**, sur le total ;
  - `marge` suit la règle ci-dessus (sur le **TTC**) ; `margeHt` (HT − coût) est donnée pour
    information, la question TTC / HT reste à poser à la cliente ;
  - période comme les rapports de gestion (§ 11.1) : mois en cours par défaut, fin jamais future ; gérant.
- **Top et flop produits** : on agrège **par produit**, tous conditionnements confondus, avec
  `quantite_base_totale`.
- **Résultat de la période** : marge brute − dépenses de la période.
- **Pertes** : somme des mouvements de pertes (péremption, casse, vol, écarts négatifs
  d'inventaire), chacun valorisé à son `cout_unitaire`.

### 11.1 Rapports de gestion (validé par Dev B le 2026-10-09, B14)
- **Droits** : gérant (et admin). **Période** : mois en cours par défaut, dates libres, la fin
  jamais dans le futur.
- **Pertes par cause**, chacune à son `cout_unitaire`, arrondie au franc par produit :
  péremption (`perte_peremption`), casse, **dons** (casse au libellé « Don », ligne à part), vol,
  **démarque d'inventaire** (écarts négatifs d'un inventaire validé), **avoirs fournisseur non
  obtenus** (avoir refusé = tout l'attendu, daté du refus ; avoir reçu en dessous de l'attendu = la
  différence, datée de l'avoir ; un avoir encore attendu n'est pas une perte).
  Ne comptent pas : une sortie annulée (contre-passée), le stock initial, le retour fournisseur
  lui-même. Une casse issue d'un retour client (A7) compte comme casse. Les **surplus
  d'inventaire** sont affichés à part et ne se déduisent pas des pertes.
- **Valeur du stock** : aujourd'hui seulement, au CUMP actuel, par rayon (un sous-rayon compte dans
  son rayon) ; même total que l'écran Stock.
- **Achats par fournisseur** : livré (réceptions de la période), avoirs reçus et règlements non
  annulés de la période, reste dû d'aujourd'hui. Un fournisseur apparaît s'il a une opération dans
  la période ou un solde non nul.
- **Résultat** : marge brute − dépenses non annulées. La marge est celle de `ventesPeriode` (A14,
  § 11 ci-dessus) sur la même période : chiffre d'affaires TTC − coût des marchandises vendues,
  retours déduits ; l'écran détaille ces deux montants. Seule la marge **TTC** est affichée (marge HT :
  D-A6 en attente). Les pertes sont rappelées pour information, sans être déduites (elles ne font pas
  partie de la règle).

### 11.2 Exports Excel (validé par Dev B le 2026-10-09, B15)
- On exporte **ce que l'écran affiche, filtres compris** ; mêmes droits que l'écran.
- Chaque feuille : une ligne de titre (« Pertes du 01/10/2026 au 09/10/2026 — exporté le 09/10/2026
  à 10 h 52 par Kossi »), une ligne vide, les en-têtes, les lignes.
- Montants et quantités en vrais nombres (montants affichés « 1 000 F »), dates en vraies dates ; un
  code-barres reste du texte (zéros gardés) ; un texte n'est jamais interprété comme une formule.
- Nom proposé : `<Liste>_<période ou jour>.xlsx` ; la personne choisit le dossier.
- Le journal des opérations s'exporte en entier pour le filtre choisi, pas seulement les lignes
  affichées.

### 11.3 Rapports de ventes et de caisse (validé par Dev A le 2026-11-01, A14)
- **Droits** : gérant (et admin), lecture seule. **Période** : comme § 11.1 (mois en cours par défaut, fin
  jamais future). Chaque document compte à sa date et **au nom de celui qui l'a saisi**.
- **Par heure** : tranches d'une heure (heure locale), additionnées sur toute la période ; tickets terminés
  seulement (ni retour, ni ticket annulé) ; seules les tranches ayant des ventes sont listées. Panier moyen =
  chiffre d'affaires / tickets, arrondi au franc.
- **Par caissier** : tickets, ventes, retours (au nom de la personne qui les saisit), chiffre d'affaires **net des
  retours** (la somme des caissiers égale `ventesPeriode`), panier moyen sur les ventes, remises accordées
  (remise du ticket + remises de ligne des tickets terminés), tickets annulés (nombre et montant, à la date du
  ticket). Cela ne tranche pas la ligne « tickets annulés » du X et du Z (question ouverte pour la cliente).
- **Top et flop** : par produit, tous conditionnements confondus, en unités de base, retours déduits. Classement
  au choix par chiffre d'affaires (défaut), marge ou quantité ; 10 lignes par défaut (1 à 100). Seuls les produits
  **vendus au moins une fois** dans la période sont classés (un produit seulement retourné ne l'est pas) ; le flop
  est l'ordre inverse parmi eux, les produits dormants relevant du stock (B). **Le chiffre d'affaires d'un produit
  est la somme de ses lignes** : la remise faite sur le ticket entier n'est pas répartie par produit, la somme des
  produits dépasse donc le chiffre d'affaires de `ventesPeriode` de ces remises (50 F dans le cas de test).
- **Historique des sessions** : sessions ouvertes dans la période (date d'ouverture), avec les valeurs figées à la
  clôture (attendu, compté, écart, commentaire) ; une session en cours n'a pas d'écart. Total des écarts des
  sessions clôturées en tête.
---

## 12. Utilisateurs et sécurité (Dev B)

- **Connexion en deux gestes (D-17)** : la personne touche son nom (comptes actifs, par ordre
  alphabétique), puis tape son **code à 4 chiffres**. Les codes ne sont **pas uniques** : c'est le
  nom touché qui identifie la personne.
- Les codes sont stockés **hachés** : scrypt avec un sel aléatoire. Jamais de valeur de code dans le
  journal, même hachée.
- **Verrouillage du compte** après 5 codes faux consécutifs sur ce compte, avec un délai croissant.
  Chaque verrouillage est journalisé au nom du compte visé.
  - Délais successifs : **30 s, 1 min, 2 min, 5 min, puis 15 min** (plafond). Pendant le
    verrouillage, même un code juste est refusé. Les autres comptes ne sont pas bloqués.
  - Une connexion réussie remet le compteur et le délai à zéro. Un code mal formé (moins de 4
    chiffres) ne compte pas comme une tentative.
  - Le compteur est gardé en base : un redémarrage ne le remet pas à zéro.
  - **Toute** saisie d'un code est comptée : connexion, remplacement du code provisoire, « Mon code ».
- **Code provisoire** : le code donné par l'admin (création d'un compte, réinitialisation) est
  provisoire. À la connexion suivante, la personne doit choisir son propre code (deux fois, différent
  du provisoire) **avant tout accès** : aucune session n'est ouverte avant. L'admin ne connaît donc
  jamais le code définitif de quelqu'un d'autre.
- **Réinitialiser le code** (code oublié) : réservé à l'admin, jamais sur son propre compte ; donne un
  code provisoire et débloque le compte s'il était verrouillé. La personne s'en aperçoit forcément
  (son ancien code ne marche plus) : une réinitialisation faite à son insu devient visible.
- **Mon code** : toute personne connectée change son code en donnant le code actuel.
- Un compte n'est jamais supprimé, il est désactivé (motif obligatoire, journalisé). Il disparaît
  de l'écran de connexion. La réactivation n'est pas prévue pour l'instant.
- Garde-fous : on ne peut ni désactiver ni rétrograder le **dernier administrateur actif**, et on
  ne peut pas désactiver son propre compte.
- **Premier démarrage en production** : si aucun compte n'existe, un assistant fait créer le compte
  administrateur, avec le code qu'il choisit (non provisoire).
- L'identité vient toujours de la session côté processus principal.
- Limite connue : un admin malhonnête peut réinitialiser un code et s'en servir avant la personne.
  Le code provisoire rend la manœuvre visible et journalisée, sans l'empêcher : le rôle admin reste
  réservé à la propriétaire.

---

## 13. Paramètres (clés de la table `parametres`)

| Clé                              | Rôle                                       | Défaut                  |
|----------------------------------|--------------------------------------------|-------------------------|
| `boutique_nom`                   | En-tête du ticket                          | —                       |
| `boutique_adresse`               | En-tête du ticket                          | —                       |
| `boutique_nif`                   | Factures                                   | —                       |
| `ticket_pied`                    | Pied du ticket                             | Merci de votre visite ! |
| `tva_defaut`                     | Taux proposé à la création d'un produit    | 18                      |
| `plafond_remise_caissier`        | Remise maximale sans gérant (FCFA)         | à définir               |
| `peremption_seuil_jours`         | Horizon du tableau des péremptions         | 15                      |
| `dormant_jours`                  | Seuil des produits dormants                | 60                      |
| `imprimante_methode`             | `spooler` ou `share`                       | spooler (boutique : `share`, D-20) |
| `imprimante_cible`               | Nom de l'imprimante ou du partage          | — (boutique : `XPOS`, D-20) |
| `imprimante_page_codes`          | Page de codes validée en Phase 0           | cp1252 (D-20)           |
| `sauvegarde_dossier_externe`     | Dossier de la clé USB des sauvegardes (§ 14) | —                     |

**Utilisation par la caisse (A3)** : le ticket prend son en-tête et son pied dans `boutique_nom`,
`boutique_adresse` (une ligne imprimée par ligne saisie) et `ticket_pied` ; « Ma Boutique » s'imprime si
le nom n'est pas renseigné. L'imprimante est réglée par les clés `imprimante_*`, depuis l'écran
« Réglages matériel » (gérant). Tant que `imprimante_page_codes` est vide ou illisible, la page de codes
est `cp1252`, validée sur l'imprimante de la boutique (D-20).

Ajouter ici toute nouvelle clé.

**Droits** (validé par Dev B le 2026-09-24) : lecture par tous les rôles (la caissière imprime le
ticket) ; écriture par l'**admin**, sauf les trois clés `imprimante_*`, que le **gérant** peut aussi
modifier (écran « Réglages matériel » de Dev A, A3). Chaque clé réellement modifiée est journalisée
(`modification_parametre`, avant/après).

**Lecture** : `parametres:lire` (ou `lireParametres(db)` dans le processus principal) renvoie un objet
typé, défauts appliqués. Une valeur vide ou illisible vaut son défaut ; une clé sans défaut vaut
`null` (non renseignée) — c'est le cas du plafond de remise tant que D-A3 n'est pas tranchée.

---

## 14. Sauvegardes et restauration (Dev B, validé par Dev B le 2026-10-12)

- **Méthode** : API de sauvegarde de SQLite (`backup` de `node:sqlite`), compatible avec le mode WAL,
  jamais pendant une transaction. La copie est écrite sous un nom provisoire, vérifiée (contrôle
  d'intégrité), puis renommée : une coupure de courant ne laisse jamais une sauvegarde à moitié écrite.
- **Où** : dossier `sauvegardes` à côté de la base. Nom : `boutique_AAAA-MM-JJ_HHMMSS_<motif>.db`.
- **Quand** (motifs) :
  - `cloture` : après chaque clôture de caisse, une fois la clôture enregistrée ;
  - `mise_a_jour` : au démarrage, **avant** d'appliquer une migration (mise à jour sur site) ;
  - `demarrage` : au démarrage, si la dernière sauvegarde a plus de 24 heures ;
  - `manuelle` : bouton « Sauvegarder maintenant » ;
  - `avant_restauration` : la base en place, juste avant une restauration.
- **Jamais bloquante** : une sauvegarde automatique qui échoue ne bloque ni la clôture ni la caisse ;
  l'échec est noté et l'écran Sauvegardes signale une dernière sauvegarde trop ancienne (plus de 2 jours).
  Une seule sauvegarde à la fois : une demande pendant une autre attend son tour.
- **Rotation** : on garde les **30 plus récentes**, plus **la plus récente de chaque semaine** (lundi
  au dimanche) sur les **52 dernières semaines**. Les autres fichiers de sauvegarde sont effacés (ce sont
  des copies, pas de l'historique).
- **Clé USB** : l'admin choisit une fois un dossier (`sauvegarde_dossier_externe`, ex. `E:\Sauvegardes`).
  Chaque sauvegarde y est copiée si le dossier est présent (même rotation) ; sinon, simple avertissement.
- **Droits** : consulter et « Sauvegarder maintenant » = gérant (et admin) ; choisir le dossier de la
  clé et **restaurer** = admin seul.
- **Restauration** (admin) : depuis la liste, ou depuis un fichier choisi (sur la clé). Le fichier est
  vérifié (base lisible et intègre) ; une sauvegarde d'une **version plus récente** de l'application
  (migration inconnue) est refusée. La base en place est d'abord sauvegardée (`avant_restauration`),
  puis remplacée, et l'application redémarre. Au redémarrage, `restauration_sauvegarde` est journalisée
  **dans la base restaurée** (fichier restauré, date de la sauvegarde, sauvegarde de la base remplacée).
- **Distant** : envoi chiffré quand Internet est disponible, **en attente de D-A4** (hébergement).
