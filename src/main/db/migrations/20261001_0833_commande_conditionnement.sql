-- ============================================================================
-- Migration 6 — commandes fournisseur dans le conditionnement (tâche B8, partie 3)
-- ============================================================================
-- Le gérant commande comme il reçoit : « 3 cartons de 24 à 6 000 F », sans convertir de tête
-- (REGLES_METIER § 4.7). La ligne de commande dit donc dans quel conditionnement on commande.
-- Avec ce conditionnement renseigné :
--   quantite_commandee = nombre de conditionnements (3 cartons) ;
--   prix_achat_prevu   = prix prévu d'UN conditionnement (0 = non indiqué).
-- La comparaison avec ce qui est reçu se fait en unités de base (× quantite_base).

ALTER TABLE lignes_commande_achat ADD COLUMN conditionnement_id INTEGER REFERENCES conditionnements(id);
