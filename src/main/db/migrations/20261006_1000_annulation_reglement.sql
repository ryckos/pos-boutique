-- ============================================================================
-- Migration 7 — annulation d'un règlement fournisseur (tâche B10)
-- ============================================================================
-- Un règlement saisi par erreur ne s'efface pas : il est annulé avec un motif (REGLES_METIER § 4.5).
-- Il reste visible, mais ne compte plus dans la dette. Pas de montant négatif possible
-- (CHECK montant > 0), d'où un changement d'état plutôt qu'une contre-passation.

-- NULL = règlement valable ; sinon date et heure de l'annulation.
ALTER TABLE reglements_fournisseurs ADD COLUMN annule_le TEXT;
ALTER TABLE reglements_fournisseurs ADD COLUMN annule_par INTEGER REFERENCES utilisateurs(id);
ALTER TABLE reglements_fournisseurs ADD COLUMN motif_annulation TEXT;

-- La vue de référence des dettes ignore désormais les règlements annulés.
DROP VIEW v_dettes_fournisseurs;
CREATE VIEW v_dettes_fournisseurs AS
SELECT
    f.id,
    f.nom,
    COALESCE((SELECT SUM(r.total)   FROM receptions r              WHERE r.fournisseur_id = f.id), 0) AS total_achats,
    COALESCE((SELECT SUM(g.montant) FROM reglements_fournisseurs g
              WHERE g.fournisseur_id = f.id AND g.annule_le IS NULL), 0) AS total_regle,
    COALESCE((SELECT SUM(r.total)   FROM receptions r              WHERE r.fournisseur_id = f.id), 0)
  - COALESCE((SELECT SUM(g.montant) FROM reglements_fournisseurs g
              WHERE g.fournisseur_id = f.id AND g.annule_le IS NULL), 0) AS solde_du
FROM fournisseurs f
WHERE f.actif = 1;
