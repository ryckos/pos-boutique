# Dev A — Comptoir et matériel

> **Avec Claude Code** : démarrez chaque tâche par `/tache <id>` et terminez par `/verifier`.
> Contexte à connaître : `docs/PROJET.md` (périmètre, droits), `docs/REGLES_METIER.md`,
> `docs/UI_UX.md` (écrans validés), `docs/SCENARIO_REFERENCE.md` (chiffres attendus),
> `docs/DECISIONS.md` (décisions prises et en attente), `docs/ETAT_AVANCEMENT.md` (à tenir à jour).

## Ta mission

Tu construis tout ce qui se passe **devant le client** : l'écran de caisse, les encaissements,
le ticket, le tiroir, l'écran client, la clôture de caisse, puis les retours, les clients à crédit
et les rapports de ventes. Ton critère de réussite : une caissière sert un client en moins de
30 secondes, sans jamais être bloquée, et chaque franc encaissé est tracé.

Ton module le plus critique est la caisse : **elle doit toujours fonctionner dans `test`**.

---

## Ton périmètre

### Tu possèdes

| Côté principal                          | Côté interface                              |
|-----------------------------------------|---------------------------------------------|
| `src/main/modules/caisse/`              | `src/renderer/src/modules/caisse/`          |
| `src/main/modules/clients/` (Phase 3)   | `src/renderer/src/modules/clients/`         |
| `src/main/modules/promotions/` (Ph. 4)  | `src/renderer/src/modules/promotions/`      |
| `src/main/modules/rapports-ventes/`     | `src/renderer/src/modules/rapports-ventes/` |
| `src/main/materiel/`                    | `src/renderer/src/client.tsx`, `client.html`|
| `src/main/fenetres.ts`                  | `src/renderer/src/modules/reglages-materiel/` |
| `src/shared/ipc/caisse.ts`, `materiel.ts`, `clients.ts`… | `resources/`               |

### Zones partagées (petite PR dédiée, annoncée à Dev B)

`src/shared/types.ts`, `src/shared/ipc/index.ts`, `src/main/core/`, `src/main/db/`,
`src/main/ipc/index.ts`, `src/renderer/src/app/`, `lib/`, `ui/styles.css`, `package.json`.

### Tu ne modifies pas (propriété de Dev B)

Catalogue, stock, utilisateurs, paramètres, achats, inventaires, dépenses, sauvegardes.
Tu **consommes** leurs contrats. Si un contrat ne te convient pas, tu le dis à Dev B : c'est lui
qui le change.

---

## Contrats

### Ce que tu consommes (fournis par Dev B ou par le socle)

| Contrat                                   | Usage chez toi                         | Disponible |
|-------------------------------------------|----------------------------------------|------------|
| `catalogue:rechercherCode`                | Scan douchette et saisie PLU           | ✅ socle   |
| `catalogue:grille`                        | Boutons tactiles                       | ✅ socle   |
| `catalogue:rechercher`                    | Recherche F2                           | ✅ socle   |
| `core/mouvements`, `numerotation`, `audit`, `session` | Enregistrer une vente       | ✅ socle   |
| `catalogue:conditionnementsProduit`       | Changer le conditionnement d'une ligne | fin S4     |
| `parametres:lire`                         | En-tête et pied du ticket              | fin S5     |
| `stock/allouerFefo()` (fonction du main)  | Choix des lots à la vente              | fin S10    |

En attendant un contrat, **code contre une valeur par défaut** (ex. en-tête de ticket en dur)
et remplace-la le jour où le contrat arrive. Tu n'attends jamais.

### Ce que tu fournis

| Contrat                                           | Pour qui                  | Échéance |
|---------------------------------------------------|---------------------------|----------|
| `caisse:enregistrerVente` (modèle de transaction) | Dev B s'en inspire        | fin S5   |
| `caisse/sessionOuverte(db)` (fonction du main)    | Dev B (dépenses en caisse)| fin S10  |
| `caisse/enregistrerMouvementCaisse(db, …)`        | Dev B (dépenses en caisse)| fin S10  |
| `caisse:ventesPeriode`                            | Dev B (rapport de résultat) | fin S16 |

---

## Phase 1 — La caisse opérationnelle (S3 à S8)

Objectif de fin de phase : **la boutique peut vendre, encaisser, imprimer et clôturer sa caisse
avec l'application.** C'est le jalon le plus important du projet.

### A1.1 — Panier et logique de calcul · S3

Remplace la page de démonstration par le vrai écran (disposition de la maquette validée :
grille à gauche, ticket à droite, total en grand).

- Crée `src/renderer/src/modules/caisse/panier.ts` : état du panier en **fonctions pures**
  (ajouter, changer quantité, supprimer, total). Un `useReducer` dans la page les utilise.
- Scan → `catalogue:rechercherCode` → ajout. Même conditionnement scanné deux fois = quantité +1.
- Code inconnu : message clair, sans bloquer le scan suivant.
- Tests : `tests/panier.test.ts` (fusion des lignes, totaux, quantité à zéro supprime la ligne).

**Terminé quand** : on enchaîne 20 scans rapides sans perte ni doublon ; tests verts.

### A1.2 — Grille, recherche, conditionnement, attente · S4

- Grille tactile depuis `catalogue:grille`, organisée par catégorie si le nombre de boutons l'exige.
- Recherche **F2** : champ avec `data-scan` absent (la douchette ne doit pas y écrire), résultats
  cliquables, Échap pour fermer.
- Changement de conditionnement sur une ligne (unité ↔ lot ↔ carton), via
  `catalogue:conditionnementsProduit` (Dev B, fin S4). Parade au piège du code unité lu à travers
  le film d'un carton.
- Mise en attente d'un ticket et reprise (plusieurs tickets en attente possibles, en mémoire).
- Raccourcis clavier : F2 recherche, F4 encaisser, F8 mettre en attente, Suppr supprime la ligne.

**Terminé quand** : une vente mixte « 1 carton + 1 lot + 2 unités + 1 baguette » se saisit en
moins de 15 secondes.

### A2 — Encaissement et enregistrement de la vente · S5

- Fenêtre de paiement : espèces (montant reçu, **monnaie à rendre** en grand, boutons de billets
  rapides 1 000 / 2 000 / 5 000 / 10 000), TMoney et Flooz (référence de transaction obligatoire),
  **paiement mixte**.
- Service `src/main/modules/caisse/service-vente.ts` → `enregistrerVente(db, panier, paiements)` :
  - **une seule transaction** (`avecTransaction`) : vente + lignes + paiements + mouvements ;
  - numéro via `prochainNumero(db, 'T')` ;
  - lignes en **photocopie au moment T** : désignation, prix, TVA, coût, `quantite_base_totale` ;
  - un mouvement `vente` par ligne, en unités de base : `-(quantité × quantiteBase)` ;
  - **les prix viennent de la base, pas de l'interface** : le service relit chaque conditionnement.
    L'interface envoie des identifiants et des quantités, jamais des montants de référence ;
  - contrôle : somme des paiements = total, sinon `ErreurMetier`.
- Calcul de la TVA dans `calculs.ts` : prix TTC → HT = arrondi(TTC / (1 + taux/100)), TVA = TTC − HT,
  **ventilée par taux** (la baguette est à 0 %).
- Tests : vente simple, vente mixte, paiement insuffisant refusé, stock décrémenté du bon nombre de
  boîtes, rollback complet si une ligne échoue, TVA ventilée juste au franc.

**Terminé quand** : la vente de démo « tomate carton + 2 unités + baguette » produit exactement le
stock, la marge et la TVA attendus ; tests verts.

### A3 — Ticket, tiroir, réglages matériel · S6

- Mise en page du ticket réel dans `materiel/ticket.ts` (réutilise l'encodeur `escpos.ts`) :
  en-tête boutique (`parametres:lire`), n° de ticket, date, caissier, lignes, TVA ventilée,
  paiements, monnaie rendue, pied de ticket. 48 colonnes en police normale sur 80 mm.
- Page de code **gagnante de la Phase 0** codée par défaut.
- **L'impression se fait APRÈS la transaction.** Si l'imprimante est en panne, la vente est déjà
  enregistrée : afficher « Vente enregistrée, ticket non imprimé » + bouton de réimpression. Une
  panne d'imprimante ne bloque jamais une vente.
- Ouverture du tiroir à chaque encaissement espèces.
- Écran « Réglages matériel » (gérant) : choix de l'imprimante, méthode, page de codes, test
  d'impression, test du tiroir. Sauvegarde dans `parametres` via le contrat de Dev B
  (`parametres:ecrire`) ou, en attendant, dans un fichier de configuration local.
- Réimpression d'un ticket par son numéro (mention « DUPLICATA » sur le ticket).

**Terminé quand** : sur le terminal, ticket imprimé en moins de 3 s, accents corrects, coupe
automatique, tiroir ouvert ; imprimante débranchée = vente quand même enregistrée.

### A4 — Sessions de caisse, rapports X et Z · S7

- Ouverture obligatoire avant toute vente : fond de caisse déclaré. Pas de session = pas de vente.
- Une seule session ouverte par caissier. Déconnexion ≠ clôture (on peut se reconnecter).
- Rapport **X** (consultation en cours de journée, sans clôturer).
- Clôture : récapitulatif par mode de paiement, espèces théoriques (fond + espèces + entrées −
  sorties), saisie du compté, **écart enregistré** avec commentaire, impression du **Z**.
- Une session clôturée est figée : plus aucune vente ne peut y être rattachée.
- Tests : calcul des espèces théoriques, refus de vente sans session, refus de double ouverture.

**Terminé quand** : la clôture de la maquette validée (fond 10 000, espèces 46 200, créance
3 500, dépense 1 000 → théorique 58 700) se reproduit au franc près.

### A5 — Remises, droits, stabilisation · S8

- Remise sur ligne ou sur ticket, plafonnée selon le profil (plafond caissier en paramètre).
  Chaque remise est **journalisée** (`journaliser`, action `remise`).
- Annulation d'une ligne avant encaissement : journalisée si le ticket avait été affiché au client.
- Revue de performance : ajout au panier < 1 s après le scan, sur le terminal (Celeron, 4 Go).
- Recette de la Phase 1 avec Dev B : le scénario « lundi–vendredi » validé par la cliente, sur la
  partie caisse.

---

## Phase 2 — Retours et flux de caisse (S9 à S12)

### A6 — Annulation de ticket · S9

Annulation d'un ticket terminé (gérant, motif obligatoire) : statut `annulee`, **contre-passation**
de chaque mouvement (`contrePasser`), paiement inverse, journal d'audit. Le ticket reste visible.

### A7 — Retour client et remboursement · S9–S10

À partir du ticket d'origine (recherche par numéro ou scan du code imprimé sur le ticket) :
sélection des lignes, motif, **sort du produit** (remise en stock → mouvement `retour_client` ;
destruction → `retour_client` puis `casse`), remboursement espèces / mobile money / avoir.
Crée une vente de type `retour` liée à l'originale, avec paiement négatif. Écran de la maquette
validée. Tests : on ne peut pas retourner plus que ce qui a été vendu.

### A8 — Mouvements de caisse · S10

Apports et retraits d'espèces hors vente (motif obligatoire, gérant). Expose pour Dev B :
`sessionOuverte(db)` et `enregistrerMouvementCaisse(db, …)` (dépenses payées depuis le tiroir).
**Rendez-vous fin S10.**

### A9 — FEFO à la vente · S11

Intègre `allouerFefo()` de Dev B dans `enregistrerVente` : pour un produit suivi en péremption, les
unités sortent des lots les plus proches de leur date, une ligne pouvant se répartir sur plusieurs
lots (un mouvement par lot). Tests avec le lait de démo.

### A10 — Facture détaillée et proforma · S12

Facture A4 avec coordonnées du client et TVA détaillée (numérotation `F`), proforma sans effet sur
le stock. Génération PDF via `webContents.printToPDF` d'une page HTML dédiée, impression ou
enregistrement.

---

## Phase 3 — Clients, crédit, écran client (S13 à S15)

### A11 — Clients et vente à crédit · S13

Fiche client, plafond de crédit. À l'encaissement, mode « Crédit » : choix du client, **blocage si
le plafond est dépassé**, création de la créance avec échéance. Paiement partiel + crédit possible.

### A12 — Recouvrement · S14

Encaissement d'une créance (passe par la session de caisse en cours), paiements partiels, balance
âgée (0–30 / 31–60 / +60 jours), liste de relance imprimable, historique complet par client.

### A13 — Écran client définitif · S15

Ouverture automatique au démarrage sur le 11,6″, panier en temps réel, total, monnaie rendue en fin
de vente, écran d'accueil au repos. Le mécanisme (`envoyerPanierClient`) est déjà en place.

---

## Phase 4 — Rapports de ventes et promotions (S16 à S18)

### A14 — Rapports ventes et caisse · S16

CA par période, **marge réelle** (depuis les coûts photocopiés dans `lignes_vente`), ventes par
heure, par caissier, top et flop produits (agrégés par produit, tous conditionnements confondus),
historique des sessions et écarts. Expose `caisse:ventesPeriode` pour le rapport de résultat de
Dev B. **Rendez-vous fin S16.**

### A15 — Tableau de bord d'accueil · S17

Écran d'accueil du gérant : CA du jour, nombre de tickets, panier moyen, alertes (reçues de Dev B :
ruptures, péremptions).

### A16 — Promotions programmées · S18

Remise en pourcentage, en montant ou prix fixe, sur un produit ou une catégorie, entre deux dates
(table `promotions` déjà prévue). Application automatique à la caisse, visible sur le ticket.

---

## Phase 5 — Mise en service (S19 à S20)

- Tests terrain sur le terminal : coupure de courant **en pleine vente** (rien de partiel ne doit
  subsister), bourrage papier, douchette débranchée, 200 ventes d'affilée.
- Guide du caissier (illustré, en français simple).
- Formation des caissiers.
- Recette finale avec Dev B.

---

## Points de vigilance propres à ton périmètre

- **Montants** : entiers FCFA partout. Le seul arrondi autorisé est celui de la TVA, fait une fois,
  dans `calculs.ts`, et testé.
- **Jamais de confiance dans l'interface** pour les prix, les coûts ou l'utilisateur : le service
  relit tout en base.
- **L'impression ne fait jamais partie de la transaction.**
- **Performance** : l'écran de caisse est le plus sollicité. Pas de requête lourde à chaque frappe ;
  la grille est chargée une fois à l'ouverture.
- **Douchette dans les champs** : un champ de saisie masque la douchette (voir `useScanner`).
  Pour un champ qui doit recevoir un scan, ajoute l'attribut `data-scan`.
- **Stock négatif** : décision de la cliente à confirmer (recommandation : autoriser avec alerte).
  Ne bloque pas la vente avant cette décision.

## Ta première journée

1. `npm install`, `npm run dev`, connexion avec `0000` (caissière), essai des codes de démo.
2. Lire `src/main/core/mouvements.ts`, `src/main/db/requetes.ts` et `tests/mouvements.test.ts`.
3. Lire `src/main/modules/catalogue/service.ts` : c'est ce que ton écran consomme.
4. Créer ta branche `a/caisse-panier` et démarrer A1.1.
