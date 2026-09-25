# Interface et ergonomie

Les écrans décrits ici reprennent les **maquettes validées** lors de la conception. Elles ont été
présentées dans le scénario de référence. Respecter leur disposition, leurs zones et leurs textes ;
les proportions exactes peuvent s'ajuster.

## 1. Parti pris

L'application est un **outil de comptoir** : elle est lue d'un coup d'œil, touchée du doigt, et
utilisée des centaines de fois par jour par des personnes pressées, devant un client qui attend.

1. **La vitesse avant tout.** Le chemin le plus court pour vendre est toujours visible. Aucun clic
   superflu, aucune confirmation inutile.
2. **La caisse n'est jamais bloquée.** Une panne d'imprimante ou un code inconnu produit un
   message, jamais un écran figé. La douchette reste active en permanence sur l'écran de caisse.
3. **Un seul élément fort par écran.** Sur la caisse, c'est le **total**. Sur le paiement, c'est
   la **monnaie à rendre**. Tout le reste reste calme.
4. **Le personnel saisit ce qu'il voit.** Des cartons, des lots, des unités. L'application convertit
   et affiche le résultat en direct (« = 72 boîtes à 250 F/boîte »).
5. **Les chiffres s'alignent.** Tout montant utilise la classe `.montant` (chiffres tabulaires) et
   `formaterFCFA()`.

## 2. Jetons de design (source unique : `src/renderer/src/ui/styles.css`)

| Jeton           | Valeur    | Usage                                                  |
|-----------------|-----------|--------------------------------------------------------|
| `--encre`       | `#1f2d33` | Texte principal, menu latéral, fonds sombres            |
| `--encre-douce` | `#56646a` | Texte secondaire, en-têtes de tableaux                 |
| `--fond`        | `#f4f6f5` | Fond de l'application                                  |
| `--surface`     | `#ffffff` | Cartes, tableaux, zone ticket                          |
| `--bord`        | `#d9dedb` | Bordures et séparateurs                                |
| `--vert`        | `#0f6e56` | Action principale, élément actif, prix                 |
| `--vert-fonce`  | `#0b5543` | Survol de l'action principale                          |
| `--vert-pale`   | `#e3f1ec` | Retour tactile, ligne mise en avant                    |
| `--ambre` / `--ambre-pale` | `#8a5a0b` / `#fbf1dc` | Avertissement : stock bas, péremption proche, brouillon |
| `--rouge` / `--rouge-pale` | `#a3321f` / `#f9e4e0` | Erreur, écart négatif, péremption imminente |
| `--rayon`       | `8px`     | Arrondi unique                                         |
| `--cible`       | `56px`    | Hauteur minimale d'une cible tactile de navigation     |

Règles :
- **Aucune couleur en dur** hors de `styles.css`. Si un besoin nouveau apparaît, ajouter un jeton
  par une PR de zone partagée.
- **Police Segoe UI**, native sur le terminal : aucune police web, car l'application est hors
  ligne. Taille de base 16 px ; pas de texte sous 13 px.
- **Pas de décoration** : pas de dégradé, pas d'ombre systématique, pas d'animation d'entrée. Une
  animation n'est acceptée que si elle répond à une action, par exemple le retour visuel au toucher.
- Le vert signifie « action ou valeur positive », l'ambre « attention », le rouge « problème ».
  Ne jamais s'appuyer sur la couleur seule : toujours ajouter un texte ou une pastille.

Classes existantes :

| Classe                                      | Rôle                                  |
|---------------------------------------------|---------------------------------------|
| `.btn`, `.btn-discret`                      | Boutons                               |
| `.page`, `.page-entete`                     | Pages de gestion                      |
| `.tableau-cadre`, `.tableau` (+ `.nombre`)  | Tableaux (colonne numérique alignée)  |
| `.pastille`, `.pastille-alerte`             | Pastilles d'état                      |
| `.alerte`, `.bandeau`, `.vide`              | Messages et états vides               |
| `.montant`                                  | Montants en chiffres tabulaires       |
| `.voile`, `.fenetre`, `.fenetre-large`, `.formulaire-bloc` | Fenêtres modales (`ui/FenetreFormulaire.tsx`) |
| `.champ`, `.champ-large`, `.champ-etroit`, `.case` | Champs de formulaire, case à cocher de 48 px |
| `.tableau-saisie`, `.champ-avec-action`     | Tableau dont les cellules sont des champs (conditionnements) |
| `.filtres`                                  | Filtres au-dessus d'un tableau de gestion |
| `.caisse*`, `.grille-boutons`, `.bouton-article`, `.ticket-*` | Écran de caisse       |
| `.ecran-client*`                            | Écran client                          |
| `.connexion*`, `.pave*`                     | Écran de connexion                    |

## 3. Tactile et clavier

- Cibles tactiles : **48 px minimum** pour un bouton d'action, 56 px pour la navigation, 72 px pour
  le pavé PIN et les touches de billets.
- L'espacement entre deux cibles est de 8 px minimum, pour éviter qu'un doigt en touche deux.
- Tout ce qui se fait au doigt se fait aussi au clavier, et le focus est toujours visible.
- **Raccourcis de la caisse** :

  | Touche  | Action                           |
  |---------|----------------------------------|
  | F2      | Rechercher un produit            |
  | F4      | Encaisser                        |
  | F8      | Mettre le ticket en attente      |
  | Suppr   | Supprimer la ligne sélectionnée  |
  | Échap   | Fermer la fenêtre ouverte        |
  | + / −   | Quantité de la ligne sélectionnée |

- **Fenêtres modales (décision de Dev B, 2026-09-23, pour tout le projet)** : toute création,
  modification ou désactivation s'ouvre dans une **fenêtre modale** par-dessus la page, jamais dans
  un encadré au milieu de la page. Composant commun `ui/FenetreFormulaire.tsx` (titre, champs,
  bouton verbe + « Fermer », variante `large` pour les formulaires avec tableau). L'erreur d'un
  refus s'affiche **dans** la fenêtre, la saisie est gardée. Échap ou « Fermer » ferment ; un
  toucher à côté ne ferme pas (pas de saisie perdue au doigt). Le curseur va dans le premier champ.
  Les fenêtres propres à la caisse (recherche F2, paiement) utilisent les mêmes classes `.voile` /
  `.fenetre`.
- **Douchette** : écoutée par `useScanner()` sur toute la fenêtre. Elle est ignorée dans les champs
  de saisie, sauf dans ceux qui portent l'attribut `data-scan`. Un scan réussi met en évidence la
  ligne ajoutée (fond `--vert-pale` bref).

## 4. Textes de l'interface

- **Français simple**, en minuscules de phrase (pas de MAJUSCULES pour les libellés), vouvoiement
  implicite ou formes impersonnelles.
- **Un bouton dit exactement ce qu'il fait**, avec un verbe : « Valider la réception »,
  « Encaisser », « Clôturer et imprimer le Z ». Jamais « OK » ou « Soumettre ». La même action
  garde le même nom partout : le bouton « Valider l'inventaire » donne le message « Inventaire
  validé ».
- **Les messages d'erreur disent quoi et comment corriger**, sans s'excuser ni rester vagues :
  - « Code 6034000099999 inconnu. Créez le produit ou vérifiez le code. »
  - « Paiement incomplet : il manque 1 200 F. »
  - « Vente enregistrée, ticket non imprimé. Vérifiez le papier puis touchez Réimprimer. »
  - à proscrire : « Une erreur est survenue ».
- **Un état vide invite à agir** : « Scannez un article ou touchez un bouton pour commencer. »
- Vocabulaire métier fixé (glossaire du cahier des charges) :

  | Terme            | Usage                                          |
  |------------------|------------------------------------------------|
  | conditionnement  | unité, lot, carton                             |
  | lot d'arrivage   | pour la péremption                             |
  | unité de compte  | l'unité dans laquelle le stock est compté      |
  | session de caisse |                                               |
  | écart de caisse  |                                                |
  | créance          |                                                |
  | démarque         |                                                |
  | avoir            |                                                |
  | réception        | et non « entrée de stock »                     |
- Les montants s'écrivent toujours `7 500 F` (espace des milliers, lettre F), via `formaterFCFA()`.

## 5. Écrans validés

### 5.1 Connexion (fait — deux gestes depuis D-17)
Fond `--encre`, nom de la boutique.
1. « Touchez votre nom » : un gros bouton par compte actif, deux colonnes, par ordre alphabétique.
2. « Bonjour Afi » — « Entrez votre code personnel », 4 points de saisie, pavé tactile 3×4
   (chiffres, Effacer, ←), bouton « Ce n'est pas moi » pour revenir aux noms. La connexion part
   automatiquement au 4e chiffre. En cas d'échec, le message s'affiche sous les points et la saisie
   est vidée.
3. Compte verrouillé : pavé grisé, « Trop de codes faux. Réessayez dans 28 s. » avec compte à rebours.
4. Code provisoire : « Votre code a été donné par l'administrateur. » puis « Choisissez votre code
   personnel », « Tapez-le une seconde fois », sur le même pavé.

Écrans liés (B1) : **Comptes utilisateurs** (admin, liste § 5.12 : créer, réinitialiser le code,
changer le rôle, désactiver avec motif ; pastille « Code provisoire ») · **Mon code** (tout le
monde : code actuel, nouveau, confirmation) · **Assistant de premier démarrage** (nom, code,
confirmation, « Créer le compte administrateur »).

### 5.2 Caisse (Dev A — A1 à A5)
```
┌──────────────────────────────────────────┬─────────────────────────────────┐
│ [ Scan ou recherche (F2)            ]    │ Ticket T-2026-000158  Caisse:Afi│
│                                          │─────────────────────────────────│
│ ┌───────────┐ ┌───────────┐              │ Tomate concentrée [Carton 24]   │
│ │ Baguette  │ │ Gari      │              │                          7 500  │
│ │ 300 F     │ │ 500 F     │              │ Tomate concentrée [Lot de 3]    │
│ └───────────┘ └───────────┘              │                          1 000  │
│ ┌───────────┐ ┌───────────┐              │ 2 × Tomate concentrée      700  │
│ │ Tomate    │ │ Tomate    │              │ Baguette (PLU 101)         300  │
│ │ Lot de 3  │ │ Carton 24 │              │ Jus d'ananas 1L            600  │
│ └───────────┘ └───────────┘              │                                 │
│                                          │═════════════════════════════════│
│ Boulangerie · Conserves · Boissons …     │ Total              10 100 F     │ ← élément fort
│ (onglets de catégories)                  │ [Espèces][TMoney][Flooz][Crédit]│
└──────────────────────────────────────────┴─────────────────────────────────┘
```
- À gauche : champ de recherche, grille de boutons tactiles (`catalogue:grille`), onglets de
  catégories.
- À droite : ticket en cours. Le conditionnement apparaît en pastille verte sur la ligne quand il
  n'est pas l'unité. Le total est en très grand (40 px ou plus), avec les boutons de paiement en
  bas, et Espèces en action principale.
- Toucher une ligne la sélectionne : quantité +/−, changement de conditionnement, suppression,
  remise (selon les droits).
- Sans session ouverte, l'écran affiche uniquement « Ouvrir la caisse » (saisie du fond).

### 5.3 Paiement (Dev A — A2)
Une fenêtre centrée s'ouvre au-dessus de la caisse. Elle contient :
- en haut, le montant à payer ;
- les boutons de billets rapides : **1 000 · 2 000 · 5 000 · 10 000** et « Montant exact » ;
- le champ du montant reçu ;
- la **monnaie à rendre**, en très grand : c'est l'élément fort de cette fenêtre.

Pour TMoney ou Flooz, un champ « Référence de la transaction » est obligatoire. Le paiement mixte
ajoute une ligne de paiement par mode, avec l'affichage du « Reste à payer ».

Le bouton de validation s'appelle **« Encaisser »**. Il imprime le ticket, ouvre le tiroir et vide
le panier.

**Précisions validées à l'essai (Dev A, 2026-09-24)** :
- **Deux colonnes**, pour tenir sans défiler sur l'écran du terminal : à gauche les modes de
  paiement (montants TMoney / Flooz, références, « Ajouter un paiement… ») ; à droite, toujours
  visibles, « À payer », billets, montant reçu, monnaie à rendre (48 px) et « Encaisser ».
- **Les espèces prennent toujours le reste** : on ne saisit que les montants TMoney et Flooz, la part
  en espèces s'affiche en lecture seule. Un seul champ lié aux espèces : « Montant reçu du client »
  (pour la monnaie). Deux champs « payé » et « reçu » prêtaient à confusion.
- Sans espèces, avec TMoney et Flooz, l'un prend le reste de l'autre.
- Les billets rapides **s'additionnent** (5 000 puis 2 000 = 7 000 reçus) ; « Effacer » remet à zéro ;
  un montant reçu vide vaut le montant exact : **F4 puis Entrée** encaisse un paiement exact.
- Toucher un champ de montant **sélectionne tout** son contenu : la frappe remplace le montant.
- « Encaisser » reste grisé, avec la raison affichée, tant qu'un paiement est incohérent : reste à
  payer, référence manquante, ligne TMoney/Flooz à 0 F, espèces reçues insuffisantes.
- Pendant le paiement, la douchette et les raccourcis de la caisse sont coupés.
- Impression du ticket et ouverture du tiroir : tâche A3 ; en attendant, « Encaisser » vide le ticket
  et affiche « Vente T-… enregistrée. Monnaie à rendre : … ».
- Sans session ouverte, l'écran de caisse affiche « Caisse fermée » et « Ouvrir la caisse » ; le fond
  se saisit dans la fenêtre commune `FenetreFormulaire`.

### 5.4 Clôture de caisse (Dev A — A4)
```
Clôture de caisse — session du vendredi              Caissière : Afi · ouverte à 07:45
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐
│ Espèces  │ │ TMoney   │ │ Flooz    │ │ Ventes crédit │   ← 4 totaux par mode
│ 46 200 F │ │ 22 500 F │ │ 8 000 F  │ │ 8 400 F       │
└──────────┘ └──────────┘ └──────────┘ └───────────────┘
 Fond d'ouverture                         10 000
 + Ventes en espèces                      46 200
 + Encaissement créance (Mme Abra)         3 500
 − Dépense (taxi-moto)                     1 000
 ─────────────────────────────────────────────────
 Espèces théoriques                     58 700 F
 Espèces comptées [ 58 200 ]   (Écart : −500 F)   [Commentaire ........]
                         [Rapport X (aperçu)]  [Clôturer et imprimer le Z]
```
L'écart s'affiche en rouge s'il est négatif, en ambre s'il est positif, et en vert s'il est nul.

### 5.5 Écran client (Dev A — A13)
Fond `--encre` et texte blanc, lisibles à 1,5 m. Il affiche :
- le nom de la boutique ;
- les lignes, en 24 px ;
- le total, en 56 px.

Au repos, il affiche « Bienvenue ». En fin de vente, il affiche le montant reçu et la monnaie
rendue pendant quelques secondes.

### 5.6 Nouvelle réception (Dev B — B8)
```
Nouvelle réception — RC-2026-0002                                   [Brouillon]
mardi 5 août 2026, 09:12
Fournisseur [ Grossiste Hédzranawoé ▾ ]   Ajouter un article [ Scannez ou tapez un nom ]
┌──────────────────────────────────────┬──────────┬─────────────┬──────────┐
│ Article                              │ Qté reçue│ Prix d'achat│    Total │
├──────────────────────────────────────┼──────────┼─────────────┼──────────┤
│ Tomate concentrée — Carton de 24     │    3     │    6 000    │ 18 000 F │
│ ⇄ = 72 boîtes à 250 F/boîte          │          │             │          │ ← conversion en direct
├──────────────────────────────────────┼──────────┼─────────────┼──────────┤
│ Lait en poudre 400g                  │   12     │    2 100    │ 25 200 F │
│ ⏱ Lot LOT-B03 · périme le 15/11/2026 │          │             │          │ ← champs exigés si périssable
└──────────────────────────────────────┴──────────┴─────────────┴──────────┘
2 lignes · à comparer au bon de livraison        Total : 43 200 F  [Valider la réception]
```
Le prix d'achat est pré-rempli avec le dernier prix connu. Le champ « Ajouter un article »
porte `data-scan`.

### 5.7 Nouveau produit (Dev B — B2.2), ouvert après le scan d'un code inconnu
L'en-tête « Nouveau produit » affiche une pastille « Code scanné : 6034000012345 ». Le formulaire
contient :

- les champs Nom, Catégorie et TVA (18 % ou 0 % exonéré) ;
- une case « Suivi de péremption » (le lot et la date sont alors exigés à la réception) ;
- le seuil d'alerte ;
- le tableau **Conditionnements**, avec les colonnes Nom · Contient · Prix de vente · Code.
  Exemple : Unité ×1 à 600, avec le code scanné ✓, et Pack de 6 ×6 à 3 300, sans code et affiché
  en bouton tactile ;
- le bouton « + Ajouter un conditionnement ».

Le bouton de validation s'appelle **« Enregistrer et ajouter à la réception »**.

Fait en B2.3 : la pastille et le pré-remplissage (`codeScanne` de `FenetreProduit`) : un code de 8 à 14
chiffres devient le code-barres de l'Unité, un code de 1 à 5 chiffres son code PLU. Le bouton
« Enregistrer et ajouter à la réception » viendra avec la réception (B8) ; depuis l'écran Produits, le
bouton reste « Créer le produit ».

### 5.8 Péremptions (Dev B — B9)
L'en-tête s'intitule « Péremptions — sous 15 jours » et affiche la valeur totale en jeu. Le tableau
a les colonnes Produit · lot, Périme le, Restant, Valeur et Actions (« Promo −20 % », « Retirer »).

Les lignes sont colorées selon l'urgence :
- rouge pour 3 jours ou moins ;
- ambre au-delà.

Sous le tableau, la note : « Le FEFO vend d'abord ces lots automatiquement. »

### 5.9 Sortie de stock (Dev B — B11)
Le formulaire contient :
- les champs Produit (scanné), Quantité (en unités de base) et Motif (Défectueux ou casse, Périmé,
  Vol constaté, Don) ;
- un commentaire ;
- la case « Créer un retour fournisseur », qui affiche le fournisseur et l'avoir attendu
  (quantité × coût d'achat) ;
- la note « Mouvement −2 tracé : qui, quand, pourquoi ».

Le bouton s'appelle **« Valider la sortie »**.

### 5.10 Retour client (Dev A — A7)
L'en-tête « Retour client » indique le ticket d'origine et sa date. L'écran contient :
- la liste des lignes du ticket, avec une case à cocher sur chacune ; les lignes non cochées sont
  grisées ;
- trois listes de choix :
  - Motif : Produit défectueux, Erreur d'article, Autre ;
  - Sort du produit : Détruire, Remettre en stock ;
  - Remboursement : Espèces, TMoney ou Avoir en boutique, avec le montant ;
- la note « Crée un ticket de type retour lié au T-… — rien n'est modifié ni effacé ».

Le bouton s'appelle **« Valider le retour »**.

### 5.11 Inventaire (Dev B — B12)
L'en-tête indique le numéro de l'inventaire et le rayon, avec le statut « En cours ». Chaque
produit apparaît dans une carte qui contient :
- son nom et son stock théorique ;
- un champ de comptage **par conditionnement** (Cartons de 24, Lots de 3, Unités) ;
- le total converti (« = 41 boîtes ») ;
- une pastille d'écart : verte si l'écart est de 0, rouge s'il est différent de 0. Dans ce second
  cas, un motif obligatoire est demandé.

Le bouton s'appelle **« Valider l'inventaire »** (réservé au gérant).

### 5.12 Pages de gestion (listes)
Chaque page de gestion utilise `.page` et `.page-entete`. L'en-tête contient :
- à gauche, le titre ;
- à droite, un chiffre clé ou l'action principale.

Le tableau est en `.tableau`, avec les colonnes numériques alignées à droite. Les états sont
signalés par des pastilles. Les filtres se placent au-dessus du tableau. Une action destructive
n'existe jamais : on propose « Désactiver » ou « Annuler », avec un motif. Les boutons « Créer… »,
« Modifier… », « Désactiver… » ouvrent une fenêtre modale (§ 3).

**Écran Produits** : la recherche ignore accents et majuscules (« pate » trouve « Pâte »). La
douchette y est écoutée hors des champs, et dans le champ de recherche des chiffres suivis d'Entrée
sont traités comme un code (tapé, collé ou scanné) : un code connu ouvre la fiche du produit ; un
code inconnu affiche « Code … inconnu » avec le bouton **« Créer le produit avec ce code »**, qui
ouvre la fiche pré-remplie (§ 5.7). Un code d'un autre format est signalé « illisible ».

### 5.13 Paramètres (Dev B — B5, admin)
Trois blocs `.panneau` (« Boutique et ticket », « Stock », « Caisse »), chacun en lecture
(`.liste-valeurs` : libellé à gauche, valeur à droite, « Non renseigné » en gris) avec un bouton
« Modifier » qui ouvre la fenêtre du bloc. « Enregistrer » reste grisé tant que rien n'a changé.
Chaque bloc s'enregistre à part, tout ou rien. Les réglages de l'imprimante n'y sont pas : ils sont
dans « Réglages matériel » (Dev A, A3, gérant).

## 6. Accessibilité et robustesse
- Contraste AA minimum : les jetons existants le respectent.
- Les messages d'erreur portent `role="alert"`.
- `prefers-reduced-motion` est respecté.
- L'interface est pensée pour 1366×768 et plus (écran 15,6″) ; l'écran client s'adapte à la
  résolution du 11,6″.
