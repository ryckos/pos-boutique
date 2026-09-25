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
| `catalogue:conditionnementsProduit`                       | B         | A           | fin S4   | ✅     | PR #10 — `{ produitId }` → `ArticleCatalogue[]`, Unité d'abord ; débloque le bouton de conditionnement d'A1.2 |
| Catégorie dans `ArticleCatalogue` (`categorie`) — demandé le 2026-09-23 | B | A     | avec B2.1 | ✅    | PR #8 : nom du rayon, champ optionnel toujours renseigné — débloque les onglets de A1.2 |
| `parametres:lire` (puis `ecrire`)                         | B         | A           | fin S5   | ✅     | PR #17 (lecture) — sans requête → `ParametresBoutique` (objet typé, défauts appliqués) ; `lireParametres(db)` appelable directement dans le principal pour le ticket ; `ecrire` (gérant pour `imprimante*`) livré PR #19 |
| `caisse:enregistrerVente` (modèle de transaction)         | A         | B (lecture) | fin S5   | ✅     | PR #7 — `service-vente.ts`, modèle de transaction à lire |
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
| A1.2  | Grille, recherche F2, conditionnement, attente  | A   | ✅     | PR #6 (attente, F2, raccourcis) et #15 (onglets de rayons, changer le conditionnement) |
| A2    | Encaissement et enregistrement de la vente      | A   | ✅     | PR #7 (serveur) et #14 (ouverture de caisse, fenêtre de paiement) — impression et tiroir en A3 |
| A3    | Ticket, tiroir, réglages matériel               | A   | 🔄     | code terminé sur `a/caisse-ticket` (ticket, tiroir, réimpression, Réglages matériel), testé sans imprimante — PR en cours ; **reste l'essai sur le terminal avec la Xprinter** (critère de fin, et page de codes D-A2) ; en-tête et réglages de l'imprimante branchés sur les paramètres de B5 (PR #17, #19) |
| A4    | Sessions de caisse, X et Z                      | A   | ⏳     | ouverture de session déjà livrée avec A2 ; reste clôture, X, Z |
| A5    | Remises, droits, stabilisation                  | A   | ⏳     |       |
| B1    | Utilisateurs, rôles, verrouillage, 1er démarrage| B   | ✅     | PR #4 — connexion par nom et code (D-17), verrouillage par compte, code provisoire, écrans Comptes / Mon code / premier démarrage |
| B2.1  | Catégories                                      | B   | ✅     | PR #8 — rayons et sous-rayons, écran Catégories, `categorie` dans `ArticleCatalogue` |
| B2.2  | Produits et conditionnements, codes internes    | B   | ✅     | PR #10 et #12 — écrans Produits et fiche produit, garde-fou prix, codes internes EAN-13, `conditionnementsProduit` |
| B2.3  | Recherche sans accents, création depuis scan    | B   | ✅     | PR #16 — recherche F2 de la caisse sans accents sans changement de contrat |
| B3    | Import Excel du catalogue                       | B   | ✅     | PR #20 — vérifier puis importer tout ou rien, modèle, rayons créés, prix d'achat indicatif (migration), `xlsx` 0.20.3 (D-18) |
| B4    | Écran stock et historique produit               | B   | ⏳     |       |
| B5    | Paramètres de la boutique                       | B   | ✅     | PR #17 (`parametres:lire`) et #19 (`parametres:ecrire` admin, gérant pour l’imprimante, journalisé ; écran Paramètres ; TVA par défaut dans la fiche produit) |
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
| 2026-09-23 | A1.2  | Partie 1 : tickets en attente, recherche F2 (nom ou PLU), raccourcis clavier (PR #6) |
| 2026-09-23 | A2    | Partie 1 : TVA ventilée, ouverture de session, `caisse:enregistrerVente` — contrat livré à B (PR #7) |
| 2026-09-24 | A2    | Partie 2 : ouverture de caisse et fenêtre de paiement — on vend depuis l'écran (PR #14) |
| 2026-09-24 | A1.2  | Partie 2 : onglets de rayons, changer le conditionnement d'une ligne (PR #15) |
| 2026-09-23 | B2.1  | Catégories : rayons et sous-rayons, écran Catégories, rayon dans `ArticleCatalogue` — contrat livré à A (PR #8) |
| 2026-09-24 | B2.2  | Partie 1 : `catalogue:conditionnementsProduit` — contrat livré à A (PR #10) |
| 2026-09-24 | UI    | Formulaires en fenêtre modale dans tout le projet, `ui/FenetreFormulaire.tsx` (PR #11) |
| 2026-09-24 | B2.2  | Fiche produit et conditionnements, garde-fou prix, codes internes EAN-13 préfixe 20, écrans Produits (PR #12) |
| 2026-09-25 | B2.3  | Recherche sans accents ni casse (F2 de la caisse comprise, sans changement de contrat), création d'un produit depuis un code scanné (PR #16) |
| 2026-09-25 | B5    | Partie 1 : `parametres:lire` — objet typé, défauts appliqués, `lireParametres(db)` pour le ticket — contrat livré à A (PR #17) |
| 2026-09-25 | B5    | Partie 2 : `parametres:ecrire` et écran Paramètres ; réglages de l'imprimante d'A3 en base (PR #19) |
| 2026-09-25 | B3    | Import du catalogue depuis Excel, `produits.prix_achat_indicatif`, dépendance `xlsx` 0.20.3 depuis SheetJS — Dev A : `npm install` (PR #20) |
