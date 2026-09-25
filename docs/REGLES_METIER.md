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
| `remise`                      | montant, ticket    |
| `annulation_ligne`            |                    |
| `annulation_ticket`           |                    |
| `ouverture_tiroir_hors_vente` |                    |
| `modification_parametre`      |                    |
| `creation_utilisateur`        | nom, rôle, code provisoire |
| `modification_role`           |                    |
| `desactivation_utilisateur`   | motif              |
| `modification_pin`            | la personne a choisi son code ; jamais la valeur |
| `reinitialisation_pin`        | l'admin a donné un code provisoire ; jamais la valeur |
| `validation_inventaire`       |                    |
| `restauration_sauvegarde`     |                    |

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
- **Réception partielle** d'une commande : la commande passe au statut `recue_partiel`.

### 4.5 Dettes fournisseurs
```
solde dû = somme des réceptions − somme des règlements − avoirs reçus
```
Les règlements peuvent être partiels (espèces, mobile money, virement). La vue de référence est
`v_dettes_fournisseurs`.

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

### 6.7 Annulation d'un ticket
- Réservée au gérant, avec un motif obligatoire.
- Le ticket passe au statut `annulee`.
- Chaque mouvement de stock est contre-passé et un paiement inverse est créé.
- Le ticket reste visible. Il n'est jamais supprimé.

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

### 6.11 Numérotation
| Préfixe | Document                 | Module | Développeur |
|---------|--------------------------|--------|-------------|
| `T`     | Ticket                   | caisse | Dev A       |
| `F`     | Facture                  | caisse | Dev A       |
| `RC`    | Réception                | achats | Dev B       |
| `CA`    | Commande d'achat         | achats | Dev B       |
| `INV`   | Inventaire               | inventaires | Dev B  |
| `DEP`   | Dépense                  | dépenses | Dev B     |

Les numéros ont la forme `PREFIXE-AAAA-NNNNNN`. Ils sont séquentiels, sans trou, et le compteur
repart à 1 chaque année.

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
- **Stock initial** au démarrage : même mécanisme, avec le document `stock_initial` et le coût
  d'achat saisi, qui initialise le CUMP.

---

## 10. Dépenses (Dev B)

- Chaque dépense a une catégorie (loyer, électricité, salaires, transport…), un libellé, un montant,
  et éventuellement une photo de justificatif.
- Source **« caisse »** : une session doit être ouverte. La dépense crée un mouvement de caisse
  `sortie`, via la fonction fournie par Dev A.
- Source **« fonds propres »** : la dépense n'a aucun effet sur la caisse.
- Numéro de la forme `DEP-AAAA-NNNNNN`.

---

## 11. Rapports

- **Chiffre d'affaires** : somme des `total_ligne` des ventes au statut `terminee`. Les retours se
  soustraient.
- **Marge brute** :
  ```
  marge brute = Σ total_ligne − Σ (quantite × cout_unitaire)
  ```
  Elle se calcule sur les lignes, donc avec les coûts photocopiés au moment de la vente.
- **Top et flop produits** : on agrège **par produit**, tous conditionnements confondus, avec
  `quantite_base_totale`.
- **Résultat de la période** : marge brute − dépenses de la période.
- **Pertes** : somme des mouvements de pertes (péremption, casse, vol, écarts négatifs
  d'inventaire), chacun valorisé à son `cout_unitaire`.

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
| `imprimante_methode`             | `spooler` ou `share`                       | spooler                 |
| `imprimante_cible`               | Nom de l'imprimante ou du partage          | —                       |
| `imprimante_page_codes`          | Page de codes validée en Phase 0           | voir DECISIONS.md       |

**Utilisation par la caisse (A3)** : le ticket prend son en-tête et son pied dans `boutique_nom`,
`boutique_adresse` (une ligne imprimée par ligne saisie) et `ticket_pied` ; « Ma Boutique » s'imprime si
le nom n'est pas renseigné. L'imprimante est réglée par les clés `imprimante_*`, depuis l'écran
« Réglages matériel » (gérant). Tant que `imprimante_page_codes` est vide ou illisible, la page de codes
est `cp858` (**provisoire**, D-A2).

Ajouter ici toute nouvelle clé.

**Droits** (validé par Dev B le 2026-09-24) : lecture par tous les rôles (la caissière imprime le
ticket) ; écriture par l'**admin**, sauf les trois clés `imprimante_*`, que le **gérant** peut aussi
modifier (écran « Réglages matériel » de Dev A, A3). Chaque clé réellement modifiée est journalisée
(`modification_parametre`, avant/après).

**Lecture** : `parametres:lire` (ou `lireParametres(db)` dans le processus principal) renvoie un objet
typé, défauts appliqués. Une valeur vide ou illisible vaut son défaut ; une clé sans défaut vaut
`null` (non renseignée) — c'est le cas du plafond de remise tant que D-A3 n'est pas tranchée.
