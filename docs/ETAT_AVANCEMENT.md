# État d'avancement

**SOURCE UNIQUE de l'avancement du projet.** À mettre à jour à chaque fin de session (`/cloturer`)
et à chaque PR. Les commandes `/plan`, `/tache-en-cours`, `/taches-terminees` et `/tache-suivante`
lisent ce fichier : s'il est faux, elles répondent faux.

Légende : ✅ terminé · 🔄 en cours · ⏳ à faire · ⛔ bloqué (préciser par quoi dans « Notes »)

Une tâche ne passe à ✅ que lorsque sa PR est **fusionnée dans `test`**. Tant qu'elle est en cours,
elle reste 🔄 avec le nom de sa branche dans « Notes ».

## Rendez-vous entre développeurs (contrats)

Un contrat livré débloque l'autre développeur. Statut : ✅ livré · 🔄 en cours · ⏳ à faire.

| Contrat                                                   | Livré par | Attendu par | Échéance | Statut | Bloque |
|-----------------------------------------------------------|-----------|-------------|----------|--------|--------|
| `catalogue:rechercherCode`, `catalogue:grille`, `catalogue:rechercher` | socle | A | — | ✅ | — |
| `core/mouvements`, `numerotation`, `audit`, `session`     | socle     | A et B      | —        | ✅     | — |
| Contrôle des rôles sur tous les canaux                    | B         | A           | fin S3   | ✅     | revue faite (PR #4 B1) ; 2 canaux `materiel:*` corrigés par A (PR #5) |
| `catalogue:conditionnementsProduit`                       | B         | A           | fin S4   | ⏳     | A1.2 |
| Catégorie dans `ArticleCatalogue` (`categorie`) — demandé le 2026-09-23 | B | A     | avec B2.1 | 🔄    | livré sur `b/categories` (PR B2.1) : nom du rayon, champ optionnel toujours renseigné |
| `parametres:lire` (puis `ecrire`)                         | B         | A           | fin S5   | ⏳     | A3 |
| `caisse:enregistrerVente` (modèle de transaction)         | A         | B (lecture) | fin S5   | 🔄     | code et tests sur `a/caisse-encaissement` (PR A2 partie 1) — lisible par B dès maintenant |
| Stock initial de démarrage                                | B         | A (recette) | fin S7   | ⏳     | recette Phase 1 |
| `stock/allouerFefo(db, produitId, qteBase)`               | B         | A           | fin S10  | ⏳     | A9 |
| `caisse/sessionOuverte()`, `enregistrerMouvementCaisse()` | A         | B           | fin S10  | ⏳     | B13 |
| `caisse:ventesPeriode`                                    | A         | B           | fin S16  | ⏳     | B14 |
| Alertes rupture et péremption (lecture)                   | B         | A           | fin S17  | ⏳     | A15 |

## Phase 0 — Validation matérielle ✅
| Test | Objet                              | Résultat                                                |
|------|------------------------------------|---------------------------------------------------------|
| T1   | Douchette (émulation clavier)      | ✅                                                      |
| T2   | Impression ESC/POS + accents       | ✅ — page de codes à reporter (DECISIONS D-A2)          |
| T3   | Impulsion tiroir-caisse            | ✅                                                      |
| T4   | Double écran                       | ✅                                                      |
| T5   | SQLite + coupure                   | ✅                                                      |

## Socle (initialisation) ✅
Le socle comprend :
- les migrations : schéma v2 et séquences ;
- le noyau : mouvements, contre-passation, audit, numérotation, session, PIN ;
- l'IPC typé et le preload générique ;
- la connexion par PIN ;
- le menu par rôle ;
- les contrats `catalogue:*` ;
- l'impression et le tiroir, avec le correctif D-05 ;
- le relais vers l'écran client ;
- les données de démo ;
- 17 tests ;
- la CI.

## Phase 1 — Caisse et ventes (S3–S8)
| Tâche | Intitulé                                        | Dev | Statut | Notes |
|-------|-------------------------------------------------|-----|--------|-------|
| A1.1  | Panier et logique de calcul                     | A   | ✅     | PR #3 — essai à la vraie douchette sur le terminal encore à faire (validé en simulation) |
| A1.2  | Grille, recherche F2, conditionnement, attente  | A   | 🔄     | `a/caisse-grille` — changement de conditionnement masqué en attendant B2.2 (conditionnementsProduit) |
| A2    | Encaissement et enregistrement de la vente      | A   | ⏳     |       |
| A3    | Ticket, tiroir, réglages matériel               | A   | ⏳     | attend B5 (parametres:lire) |
| A4    | Sessions de caisse, X et Z                      | A   | ⏳     | ouverture de session déjà livrée avec A2 ; reste clôture, X, Z |
| A5    | Remises, droits, stabilisation                  | A   | ⏳     |       |
| B1    | Utilisateurs, rôles, verrouillage, 1er démarrage| B   | ✅     | PR #4 — connexion par nom et code (D-17), verrouillage par compte, code provisoire, écrans Comptes / Mon code / premier démarrage |
| B2.1  | Catégories                                      | B   | 🔄     | `b/categories` — rayons et sous-rayons, écran Catégories, `categorie` dans `ArticleCatalogue` ; PR vers `test` |
| B2.2  | Produits et conditionnements, codes internes    | B   | ⏳     | rendez-vous fin S4 |
| B2.3  | Recherche sans accents, création depuis scan    | B   | ⏳     |       |
| B3    | Import Excel du catalogue                       | B   | ⏳     |       |
| B4    | Écran stock et historique produit               | B   | ⏳     |       |
| B5    | Paramètres de la boutique                       | B   | ⏳     | rendez-vous fin S5 (lecture) |
| B6    | Stock initial de démarrage                      | B   | ⏳     |       |

## Phase 2 — Achats, lots, retours (S9–S12)
| Tâche | Intitulé                                  | Dev | Statut | Notes (branche, blocage) |
|-------|-------------------------------------------|-----|--------|--------------------------|
| A6    | Annulation de ticket                      | A   | ⏳     |   |
| A7    | Retour client et remboursement            | A   | ⏳     |   |
| A8    | Mouvements de caisse (+ API pour B)       | A   | ⏳     |   |
| A9    | FEFO à la vente                           | A   | ⏳     |   |
| A10   | Facture et proforma                       | A   | ⏳     |   |
| B7    | Fournisseurs                              | B   | ⏳     |   |
| B8    | Commandes et réceptions (CUMP)            | B   | ⏳     |   |
| B9    | Lots, FEFO, tableau des péremptions       | B   | ⏳     |   |
| B10   | Règlements et dettes fournisseurs         | B   | ⏳     |   |

## Phase 3 — Suivi financier (S13–S15)
| Tâche | Intitulé                                  | Dev | Statut | Notes (branche, blocage) |
|-------|-------------------------------------------|-----|--------|--------------------------|
| A11   | Clients et vente à crédit                 | A   | ⏳     |   |
| A12   | Recouvrement                              | A   | ⏳     |   |
| A13   | Écran client définitif                    | A   | ⏳     |   |
| B11   | Sorties de stock, retours fournisseur     | B   | ⏳     |   |
| B12   | Inventaires                               | B   | ⏳     |   |
| B13   | Dépenses                                  | B   | ⏳     |   |

## Phase 4 — Pilotage (S16–S18)
| Tâche | Intitulé                                  | Dev | Statut | Notes (branche, blocage) |
|-------|-------------------------------------------|-----|--------|--------------------------|
| A14   | Rapports ventes et caisse                 | A   | ⏳     |   |
| A15   | Tableau de bord d'accueil                 | A   | ⏳     |   |
| A16   | Promotions programmées                    | A   | ⏳     |   |
| B14   | Rapports de gestion, journal d'audit      | B   | ⏳     |   |
| B15   | Exports Excel                             | B   | ⏳     |   |
| B16   | Sauvegardes et restauration               | B   | ⏳     |   |

## Phase 5 — Mise en service (S19–S20)
| Tâche | Intitulé                                            | Dev | Statut | Notes (branche, blocage) |
|-------|-----------------------------------------------------|-----|--------|--------------------------|
| A-P5  | Tests terrain caisse, guide caissier, formation     | A   | ⏳     |   |
| B-P5  | Installateur, kiosque, mises à jour, guide gérant   | B   | ⏳     |   |

## Journal des fusions notables
<!-- Une ligne par PR importante : date · tâche · résumé · contrat ajouté/modifié -->
| Date       | Tâche | Résumé                                        |
|------------|-------|-----------------------------------------------|
| 2026-09-22 | —     | Initialisation du socle                       |
| 2026-09-22 | —     | Contexte complet pour Claude Code (CLAUDE.md, docs) |
| 2026-09-22 | —     | Briefs de passation et carnets de bord par développeur |
| 2026-09-23 | A1.1  | Panier en fonctions pures et vrai écran de caisse (PR #3) |
| 2026-09-23 | B1    | Connexion par nom et code (D-17), verrouillage par compte, comptes utilisateurs (PR #4) |
