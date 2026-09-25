-- ============================================================================
-- Migration 4 — prix d'achat indicatif (tâche B3, import du catalogue)
-- ============================================================================
-- Le fichier Excel de la cliente donne un prix d'achat par produit. Il ne peut pas aller
-- dans le CUMP : celui-ci n'est modifié que par la réception et le stock initial, qui
-- s'appuient sur des quantités réelles. On le garde donc à part, comme simple proposition :
-- il pré-remplit le coût lors de la saisie du stock initial (B6). Aucun calcul de marge,
-- de valeur de stock ou de CUMP ne le lit.

-- FCFA par unité de base ; NULL = inconnu.
ALTER TABLE produits ADD COLUMN prix_achat_indicatif INTEGER CHECK (prix_achat_indicatif >= 0);
