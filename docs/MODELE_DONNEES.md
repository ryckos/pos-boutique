# Modèle de données

La source de vérité est dans `src/main/db/migrations/`, lue dans l'ordre. Ce document explique le
**rôle** de chaque table et **qui a le droit d'y écrire**. Toute nouvelle migration doit mettre ce
document à jour.

## Conventions
- Montants en `INTEGER` (FCFA). CUMP, coûts unitaires et quantités en `REAL`.
- Dates en `TEXT` ISO-8601, heure locale (`datetime('now','localtime')`).
- `actif` vaut 0 ou 1 pour la désactivation. On ne supprime jamais.
- Clés étrangères activées à chaque connexion (`PRAGMA foreign_keys = ON`).
- En TypeScript, les colonnes `snake_case` sont renommées en `camelCase` dans le `SELECT`.

## Tables

### Socle et sécurité — Dev B (sauf mention)
| Table               | Rôle                                                                |
|---------------------|---------------------------------------------------------------------|
| `schema_migrations` | Migrations appliquées. Gérée par `db/migrations.ts`                 |
| `sequences`         | Compteurs de numérotation par préfixe et par année. Gérée par `core/numerotation.ts` |
| `parametres`        | Clé/valeur de la boutique (liste dans `REGLES_METIER.md` § 13)      |
| `utilisateurs`      | Comptes, `pin_hash` (scrypt, **non unique** : D-17), `role`, `actif`, `pin_provisoire` (code donné par l'admin, à remplacer), état du verrouillage : `echecs_consecutifs`, `verrouillages`, `verrouille_jusqu_a` (ms) |
| `journal_audit`     | Actions sensibles. **Immuable.** Écriture par `core/audit.ts` seulement |

### Catalogue et stock — Dev B
| Table              | Rôle                                                                  |
|--------------------|-----------------------------------------------------------------------|
| `categories`       | Rayons, sous-catégories via `parent_id`                               |
| `produits`         | Ce qu'on stocke : unité de base, TVA, `cout_moyen_pondere`, `suivi_peremption`, `seuil_alerte` |
| `conditionnements` | Ce qu'on vend : `quantite_base`, `prix_vente`, `code_barres` (UNIQUE), `code_plu` (UNIQUE), `est_defaut`, `bouton_tactile`, `ordre_bouton` |
| `lots`             | Lots d'arrivage : `numero_lot`, `date_peremption`, `prix_achat_unitaire`, `reception_id` |
| `mouvements_stock` | **Le journal du stock. Immuable.** Écriture par `core/mouvements.ts` seulement, en unités de base |

### Caisse et ventes — Dev A
| Table               | Rôle                                                                 |
|---------------------|----------------------------------------------------------------------|
| `sessions_caisse`   | Session d'un caissier : fond, ouverture et clôture, théorique, compté, `ecart`, `statut` |
| `ventes`            | Ticket, facture, proforma ou retour : `numero_ticket`, totaux HT/TVA/TTC, `statut`, `vente_origine_id`, `est_credit`. **Suppression interdite** |
| `lignes_vente`      | Photocopie au moment T : `conditionnement_id`, `designation`, `quantite`, `prix_unitaire`, `cout_unitaire` (d'un conditionnement), `quantite_base_totale`, `taux_tva`, `lot_id`. **Suppression interdite** |
| `paiements`         | Un ou plusieurs par vente : `mode`, `montant` (négatif pour un remboursement), `reference` |
| `mouvements_caisse` | Entrées et sorties d'espèces hors vente, rattachées à une session    |
| `promotions`        | Remises programmées (Phase 4)                                        |

### Achats — Dev B
| Table                     | Rôle                                                            |
|---------------------------|-----------------------------------------------------------------|
| `fournisseurs`            | Fiche, `delai_paiement_jours`                                   |
| `commandes_achat`         | Commande et son statut                                          |
| `lignes_commande_achat`   | Lignes de commande                                              |
| `receptions`              | Arrivage, `total` (qui crée la dette)                           |
| `lignes_reception`        | Saisie telle quelle : `conditionnement_id`, `quantite_recue`, `prix_achat_unitaire` (d'un conditionnement), `quantite_base_totale`, lot, péremption |
| `reglements_fournisseurs` | Paiements aux fournisseurs                                      |

### Clients — Dev A
| Table                    | Rôle                                                             |
|--------------------------|------------------------------------------------------------------|
| `clients`                | Fiche, `plafond_credit`                                          |
| `creances`               | Née d'une vente à crédit, `montant_initial`, `date_echeance`, `statut` |
| `encaissements_creances` | Paiements de créances, rattachés à une session de caisse         |

### Dépenses et inventaires — Dev B
| Table                | Rôle                                                                  |
|----------------------|-----------------------------------------------------------------------|
| `categories_depense` | Loyer, électricité…                                                   |
| `depenses`           | `source` (`caisse` ou `fonds_propres`), `session_caisse_id` si caisse |
| `inventaires`        | En-tête, `statut`, `valide_par_id`                                    |
| `lignes_inventaire`  | `quantite_theorique`, `quantite_comptee`, `ecart` (**colonne générée**), `detail_comptage` (JSON), `motif_ecart` |

## Vues (lecture seule, jamais d'écriture)
| Vue                    | Contenu                                                       | Utilisée par |
|------------------------|---------------------------------------------------------------|--------------|
| `v_catalogue_vente`    | Un conditionnement actif = une ligne vendable, avec sa désignation, son prix, sa quantité de base et son coût | A (scan), B |
| `v_stock_produits`     | Stock, valeur et seuil par produit                            | B            |
| `v_alertes_stock`      | Produits en rupture ou sous le seuil                          | A, B         |
| `v_stock_lots`         | Quantité restante par lot                                     | B (FEFO)     |
| `v_peremptions`        | Lots en stock, avec jours restants et valeur en jeu           | B            |
| `v_dettes_fournisseurs`| Achats, règlements et solde dû par fournisseur                | B            |
| `v_creances_clients`   | Encaissé et restant dû par créance                            | A            |

## Triggers de protection
| Trigger                     | Effet                                    |
|-----------------------------|------------------------------------------|
| `trg_mouvements_no_update`  | Interdit tout `UPDATE` sur `mouvements_stock` |
| `trg_mouvements_no_delete`  | Interdit tout `DELETE` sur `mouvements_stock` |
| `trg_audit_no_update`       | Interdit tout `UPDATE` sur `journal_audit`    |
| `trg_audit_no_delete`       | Interdit tout `DELETE` sur `journal_audit`    |
| `trg_ventes_no_delete`      | Interdit tout `DELETE` sur `ventes`           |
| `trg_lignes_vente_no_delete`| Interdit tout `DELETE` sur `lignes_vente`     |

## Migrations appliquées
| Fichier                                  | Contenu                                              |
|------------------------------------------|------------------------------------------------------|
| `20260922_0900_schema_initial.sql`       | Schéma v2 complet : tables, index, vues, triggers    |
| `20260922_0910_sequences_et_boutons.sql` | Table `sequences`, boutons tactiles sur `conditionnements` |
| `20260923_1157_securite_connexion.sql`   | `utilisateurs` : code provisoire et verrouillage par compte |

Ajouter ici chaque nouvelle migration (nom et contenu en une ligne).

## Requêtes de référence
Les requêtes types validées en conception : scan, prix dégressifs, garde-fou prix, FEFO,
péremptions, Z, balance âgée, dettes, top produits, marge, ventes par heure, traçabilité d'un
produit, résultat. Elles sont reproduites dans les règles métier et doivent guider les services.
Exemple, la traçabilité d'un produit :

```sql
SELECT m.horodatage, m.type, m.quantite, m.motif, m.document_type, m.document_id, u.nom AS par
FROM mouvements_stock m JOIN utilisateurs u ON u.id = m.utilisateur_id
WHERE m.produit_id = ? ORDER BY m.id;
```
