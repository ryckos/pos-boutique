-- ============================================================================
-- Migration 5 — échéance de la dette fournisseur (tâche B8, réceptions)
-- ============================================================================
-- Chaque réception crée une dette égale à son total, payable sous le délai du fournisseur
-- (REGLES_METIER § 4.2). Le délai peut changer ensuite sur la fiche sans toucher aux dettes
-- passées (§ 4.6) : l'échéance est donc figée ici, à la validation, et non recalculée.

-- AAAA-MM-JJ ; NULL seulement pour les réceptions antérieures à cette migration.
ALTER TABLE receptions ADD COLUMN date_echeance TEXT;
