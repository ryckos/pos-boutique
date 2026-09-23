# Dev B — Back-office et données

> **Avec Claude Code** : démarrez chaque tâche par `/tache <id>` et terminez par `/verifier`.
> Contexte à connaître : `docs/PROJET.md` (périmètre, droits), `docs/REGLES_METIER.md`,
> `docs/UI_UX.md` (écrans validés), `docs/SCENARIO_REFERENCE.md` (chiffres attendus),
> `docs/DECISIONS.md` (décisions prises et en attente), `docs/ETAT_AVANCEMENT.md` (à tenir à jour).

## Ta mission

Tu construis tout ce qui se passe **derrière le comptoir** : les comptes et les droits, le
catalogue et ses conditionnements, le stock, les approvisionnements, les péremptions, les
inventaires, les dépenses, les rapports de gestion et les sauvegardes. Tu es aussi le **gardien du
modèle de données** : tu relis en priorité toute nouvelle migration.

Ton critère de réussite : à tout instant, le patron peut expliquer chaque boîte en stock et chaque
franc de marge, preuve à l'appui, et aucune donnée ne se perd jamais.

---

## Ton périmètre

### Tu possèdes

| Côté principal                             | Côté interface                                 |
|--------------------------------------------|------------------------------------------------|
| `src/main/modules/auth/`                   | `src/renderer/src/modules/auth/`               |
| `src/main/modules/utilisateurs/`           | `src/renderer/src/modules/utilisateurs/`       |
| `src/main/modules/catalogue/`              | `src/renderer/src/modules/catalogue/`          |
| `src/main/modules/stock/`                  | `src/renderer/src/modules/stock/`              |
| `src/main/modules/parametres/`             | `src/renderer/src/modules/parametres/`         |
| `src/main/modules/achats/`                 | `src/renderer/src/modules/achats/`             |
| `src/main/modules/inventaires/`            | `src/renderer/src/modules/inventaires/`        |
| `src/main/modules/depenses/`               | `src/renderer/src/modules/depenses/`           |
| `src/main/modules/rapports-gestion/`       | `src/renderer/src/modules/rapports-gestion/`   |
| `src/main/modules/sauvegardes/`            | `src/renderer/src/modules/sauvegardes/`        |
| `src/shared/ipc/auth.ts`, `catalogue.ts`, `stock.ts`, `achats.ts`… | Empaquetage (Phase 5) |

### Zones partagées (petite PR dédiée, annoncée à Dev A)

`src/shared/types.ts`, `src/shared/ipc/index.ts`, `src/main/core/`, `src/main/db/`,
`src/main/ipc/index.ts`, `src/renderer/src/app/`, `lib/`, `ui/styles.css`, `package.json`.

### Tu ne modifies pas (propriété de Dev A)

Caisse, ventes, paiements, sessions, clients et crédits, matériel, fenêtres, écran client.
Tu **consommes** ses contrats.

---

## Contrats

### Ce que tu fournis

| Contrat                                   | Pour qui              | Échéance  |
|-------------------------------------------|-----------------------|-----------|
| `catalogue:rechercherCode`, `catalogue:grille`, `catalogue:rechercher` | Dev A | ✅ socle — tu les maintiens |
| Contrôle des rôles sur tous tes canaux    | Dev A (confiance)     | fin S3    |
| `catalogue:conditionnementsProduit`       | Dev A                 | **fin S4** |
| `parametres:lire`, `parametres:ecrire`    | Dev A (ticket, réglages matériel) | **fin S5** |
| Stock initial de démarrage                | Recette Phase 1       | fin S7    |
| `stock/allouerFefo(db, produitId, qteBase)` (fonction du main) | Dev A | **fin S10** |
| Alertes rupture et péremption (canal de lecture) | Dev A (tableau de bord) | fin S17 |

**Un contrat en retard bloque Dev A.** Stratégie : déclare le contrat dans `src/shared/ipc/`
et livre une première version simple très tôt, puis améliore-la. Mieux vaut un contrat stable
tôt qu'un contrat parfait tard.

### Ce que tu consommes

| Contrat                                        | Usage                         | Disponible |
|------------------------------------------------|-------------------------------|------------|
| `core/mouvements`, `numerotation`, `audit`, `session` | Toutes tes écritures   | ✅ socle   |
| `caisse/sessionOuverte()`, `enregistrerMouvementCaisse()` | Dépenses payées en caisse | fin S10 |
| `caisse:ventesPeriode`                         | Rapport de résultat           | fin S16    |

---

## Phase 1 — Les fondations de la gestion (S3 à S8)

### B1 — Utilisateurs, rôles et sécurité · S3

- Écran de gestion des comptes (admin) : créer, désactiver, changer le PIN, changer le rôle.
  On ne supprime jamais un compte (il est référencé par l'historique) : on le désactive.
- **Verrouillage** après 5 codes faux consécutifs (délai croissant), journalisé.
- Passe en revue **tous les canaux existants** et vérifie que chacun appelle `session.exiger()` avec
  les bons rôles (matrice du chapitre 5 du cahier des charges). **Rendez-vous fin S3.**
- Assistant de **premier démarrage en production** : si aucun utilisateur n'existe et que
  l'application est empaquetée, création du compte administrateur (en développement, le seed s'en
  charge).
- Tests : verrouillage, unicité des PIN, compte désactivé refusé.

### B2.1 — Catégories · S3

Création et renommage des catégories (sous-catégories possibles via `parent_id`), utilisées par la
grille de caisse et les rapports.

### B2.2 — Produits et conditionnements · S4

- Fiche produit (maquette validée) : nom, catégorie, unité de base, TVA, suivi de péremption,
  seuil d'alerte, photo.
- Gestion des conditionnements : nom, quantité de base, **prix libre**, code-barres et/ou PLU,
  bouton tactile et ordre d'affichage. Un conditionnement « Unité » (×1) obligatoire par produit.
- **Garde-fou prix** : alerte (sans blocage) si un lot ou un carton est plus cher que son
  équivalent à l'unité (requête R3 des requêtes types).
- **Générateur de codes internes EAN-13** (préfixe 20, clé de contrôle calculée), unicité garantie.
  Tests avec des clés de contrôle connues (`2000000000015`).
- Tout changement de prix de vente est **journalisé** (`modification_prix`, avant/après).
- Canal `catalogue:conditionnementsProduit` pour la caisse. **Rendez-vous fin S4.**

**Terminé quand** : le jus d'ananas du scénario (unité 600 F + pack de 6 à 3 300 F) se crée en
moins d'une minute et se vend immédiatement à la caisse.

### B2.3 — Recherche et création depuis un scan · S5

- Recherche **insensible aux accents et à la casse** (« pate » trouve « Pâte »). Piste : colonne
  normalisée remplie par le service, ou fonction de normalisation enregistrée sur la connexion.
- Création de produit pré-remplie à partir d'un **code inconnu scanné** (utilisée par la réception
  en Phase 2, et à terme par la caisse).

### B3 — Import du catalogue initial · S5–S6

- Import depuis un fichier Excel fourni par la cliente (bibliothèque `xlsx`, côté principal).
- Modèle de fichier téléchargeable : nom, catégorie, code-barres, prix d'achat, prix de vente, TVA,
  seuil. Crée le produit et son conditionnement « Unité ».
- **Rapport d'import** ligne par ligne : créé, ignoré (doublon de code-barres), en erreur (prix
  manquant…). Aucune ligne n'est importée à moitié ; import complet dans une transaction.

### B4 — Écran stock · S6

- Liste des produits : stock (unités de base), valeur, alertes rupture et stock bas, filtres.
- **Historique d'un produit** : chaque mouvement avec type, quantité, document, utilisateur, date.
  C'est la réponse à « pourquoi il reste 41 boîtes ? » (requête R12).
- Affichage lisible multi-conditionnements : « 46 boîtes = 1 carton + 7 lots + 1 unité » (à titre
  indicatif).
- Produits dormants (sans vente depuis N jours, paramétrable).

### B5 — Paramètres de la boutique · S7

- Écran des paramètres : nom, adresse, NIF, en-tête et pied de ticket, TVA par défaut, seuils de
  péremption, plafond de remise caissier.
- Canaux `parametres:lire` et `parametres:ecrire` (écriture réservée admin, journalisée).
  **Rendez-vous fin S5** pour la lecture (Dev A en a besoin pour le ticket) : livre d'abord la
  lecture, l'écran vient ensuite.

### B6 — Stock initial de démarrage · S7–S8

Écran de saisie du stock de départ (par scan ou recherche), qui génère des mouvements
`ajustement_inventaire` avec document `stock_initial` et le coût d'achat saisi (qui initialise le
CUMP). Indispensable pour la mise en service : sans lui, la boutique démarre à zéro.

### Stabilisation · S8

Recette de la Phase 1 avec Dev A, sur le terminal.

---

## Phase 2 — Achats, lots et péremptions (S9 à S12)

### B7 — Fournisseurs · S9

Fiche fournisseur (coordonnées, délai de paiement), historique des achats et des prix d'achat.

### B8 — Commandes et réceptions · S9–S10

Le cœur de la phase, décrit précisément dans le scénario validé :

- Commande fournisseur (manuelle ou suggérée depuis les alertes de stock).
- Réception, liée ou non à une commande, totale ou partielle : scan du **code du carton** → saisie
  « quantité reçue » dans le conditionnement reçu + prix d'achat de ce conditionnement → affichage
  en direct de la conversion (« = 72 boîtes à 250 F/boîte »).
- Produit suivi en péremption : **n° de lot et date obligatoires** avant d'accepter la ligne.
- Code inconnu → création du produit à la volée (B2.3), puis retour à la réception.
- Validation en **une transaction** : lignes de réception, lots, mouvements `reception` en unités de
  base, **recalcul du CUMP**, création de la dette fournisseur, numérotation `RC`.
- Formule du CUMP : `(stock × ancienCUMP + qteBase × coûtBase) / (stock + qteBase)`, coûtBase =
  prix du conditionnement / quantité de base. Cas limite à tester : stock nul ou négatif avant
  réception (le CUMP devient alors le coût de la réception).
- Tests : conversion, CUMP (exemple validé : 46 à 250 + 48 à 275 → 262,8), lot obligatoire,
  transaction annulée en cas d'erreur.

### B9 — Lots et péremptions · S10–S11

- `stock/allouerFefo(db, produitId, qteBase)` : renvoie la répartition par lots (les plus proches
  de leur date en premier) pour la vente. **Rendez-vous fin S10 avec Dev A.**
- Tableau des péremptions (maquette validée) : lots sous N jours, jours restants, valeur en jeu,
  actions « promotion » et « retirer » (mouvement `perte_peremption`).

### B10 — Règlements et dettes fournisseurs · S12

Règlements partiels ou totaux (espèces, mobile money, virement), solde dû par fournisseur,
échéancier, alerte d'échéance dépassée.

---

## Phase 3 — Inventaires, pertes, dépenses (S13 à S15)

### B11 — Sorties de stock et retours fournisseur · S13

Sortie pour défectueux, casse, vol constaté, don, avec motif obligatoire (maquette validée). Option
« retour fournisseur » : mouvement `retour_fournisseur`, **avoir attendu** au coût d'achat, déduit
de la dette à réception de l'avoir.

### B12 — Inventaires · S14

Inventaire total ou partiel (par rayon), comptage au scan, **saisie par conditionnements** convertie
en unités de base (maquette validée : 1 carton + 5 lots + 2 unités = 41), `detail_comptage`
conservé, motif obligatoire par écart, validation par le gérant, mouvements d'ajustement, rapport
de démarque chiffré. Un inventaire validé est figé.

### B13 — Dépenses · S15

Catégories de dépenses, justificatif photo, source « caisse » (utilise `sessionOuverte()` et
`enregistrerMouvementCaisse()` de Dev A) ou « fonds propres ». Numérotation `DEP`.

---

## Phase 4 — Pilotage et sauvegardes (S16 à S18)

### B14 — Rapports de gestion · S16–S17

Valeur du stock, pertes par cause (péremption, casse, vol, démarque), achats par fournisseur,
**résultat de la période** (marge de `caisse:ventesPeriode` − dépenses), écran du journal d'audit
(admin).

### B15 — Exports Excel · S17

Export de chaque liste et rapport vers un fichier Excel.

### B16 — Sauvegardes · S18

- Sauvegarde automatique à chaque clôture de caisse (API de sauvegarde SQLite, compatible WAL),
  horodatée, rotation (30 dernières + 1 par semaine).
- Copie vers un support externe (clé USB) quand elle est présente.
- Envoi distant chiffré quand Internet est disponible (hébergement à décider avec la cliente).
- **Restauration** documentée et **testée** avant la mise en service.

---

## Phase 5 — Mise en service (S19 à S20)

- Installateur Windows (`npm run dist`, electron-builder), icône, nom du produit.
- Mode kiosque : démarrage automatique avec Windows, plein écran, écran client au démarrage.
- Mises à jour de l'application sur site (procédure simple, sans perte de données).
- Guide du gérant et de l'administrateur.
- Import du catalogue réel et stock initial avec la cliente.
- Recette finale avec Dev A.

---

## Points de vigilance propres à ton périmètre

- **Gardien des migrations** : relis toute migration de Dev A. Une migration fusionnée est
  définitive. Jamais de `DROP` d'une colonne contenant de l'historique.
- **Unités de base partout** dans le stock, les seuils, le CUMP et les inventaires. La conversion
  se fait une seule fois, à la saisie.
- **Jamais de suppression** : désactivation (`actif = 0`) pour les produits, conditionnements,
  fournisseurs, comptes. Ils sont référencés par l'historique.
- **CUMP** : recalcul uniquement dans le service de réception, jamais à la main. Tests obligatoires.
- **Import** : le fichier de la cliente sera imparfait. Le rapport d'erreurs doit lui permettre de
  corriger seule.
- **Sauvegarde non testée = pas de sauvegarde.** La restauration fait partie de la recette.

## Ta première journée

1. `npm install`, `npm run dev`, connexion avec `1234` (admin), écran « Produits et stock ».
2. Lire `src/main/db/migrations/` (le schéma complet), `src/main/core/mouvements.ts` et les tests.
3. Lire `src/main/modules/catalogue/service.ts` : c'est ton module, déjà consommé par Dev A.
4. Créer ta branche `b/utilisateurs-roles` et démarrer B1.
