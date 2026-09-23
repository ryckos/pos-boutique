-- ============================================================================
-- Migration 2 — numérotation des documents + boutons tactiles de la caisse
-- ============================================================================

-- Compteurs séquentiels inviolables par préfixe et par année : T-2026, RC-2026…
CREATE TABLE sequences (
    prefixe TEXT PRIMARY KEY,          -- ex : 'T-2026'
    dernier INTEGER NOT NULL DEFAULT 0
);

-- Un conditionnement peut apparaître comme bouton sur l'écran de caisse
-- (produits sans code-barres, lots, cartons fréquents…).
ALTER TABLE conditionnements ADD COLUMN bouton_tactile INTEGER NOT NULL DEFAULT 0;
ALTER TABLE conditionnements ADD COLUMN ordre_bouton   INTEGER NOT NULL DEFAULT 0;
