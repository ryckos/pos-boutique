-- ============================================================================
-- Migration 8 — retours fournisseur et avoirs (tâche B11)
-- ============================================================================
-- Un retour fournisseur sort la marchandise du stock (mouvement `retour_fournisseur`, document
-- `retour_fournisseur` = id de cette table) et attend un avoir du fournisseur (REGLES_METIER § 8).
-- L'avoir suit un état : attendu → reçu (montant reçu, peut différer de l'attendu) ou refusé ;
-- annulé si la sortie elle-même est annulée. Seul l'avoir reçu se déduit de la dette (§ 4.5).

CREATE TABLE retours_fournisseur (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    fournisseur_id  INTEGER NOT NULL REFERENCES fournisseurs(id),
    produit_id      INTEGER NOT NULL REFERENCES produits(id),
    lot_id          INTEGER REFERENCES lots(id),
    quantite        REAL NOT NULL CHECK (quantite > 0),       -- en unités de base
    cout_unitaire   REAL NOT NULL CHECK (cout_unitaire >= 0), -- prix payé à ce fournisseur, par unité de base
    montant_attendu INTEGER NOT NULL CHECK (montant_attendu > 0),
    statut          TEXT NOT NULL DEFAULT 'attendu'
                    CHECK (statut IN ('attendu', 'recu', 'refuse', 'annule')),
    montant_recu    INTEGER CHECK (montant_recu IS NULL OR montant_recu > 0),
    date_avoir      TEXT,                                     -- AAAA-MM-JJ de l'avoir reçu
    reference       TEXT,                                     -- n° de l'avoir du fournisseur
    motif_cloture   TEXT,                                     -- motif du refus ou de l'annulation
    cree_par        INTEGER NOT NULL REFERENCES utilisateurs(id),
    cree_le         TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    clos_par        INTEGER REFERENCES utilisateurs(id),
    clos_le         TEXT,
    CHECK (statut <> 'recu' OR montant_recu IS NOT NULL)
);

CREATE INDEX idx_retours_fournisseur ON retours_fournisseur(fournisseur_id, statut);

-- Rien n'est effacé : un retour se clôt par son statut.
CREATE TRIGGER trg_retours_fournisseur_no_delete
BEFORE DELETE ON retours_fournisseur
BEGIN
    SELECT RAISE(ABORT, 'Un retour fournisseur ne se supprime pas : changer son statut.');
END;

-- La vue de référence des dettes déduit désormais les avoirs reçus. Le solde peut devenir négatif :
-- c'est un avoir à valoir sur les prochains achats.
DROP VIEW v_dettes_fournisseurs;
CREATE VIEW v_dettes_fournisseurs AS
SELECT
    f.id,
    f.nom,
    COALESCE((SELECT SUM(r.total)   FROM receptions r              WHERE r.fournisseur_id = f.id), 0) AS total_achats,
    COALESCE((SELECT SUM(g.montant) FROM reglements_fournisseurs g
              WHERE g.fournisseur_id = f.id AND g.annule_le IS NULL), 0) AS total_regle,
    COALESCE((SELECT SUM(a.montant_recu) FROM retours_fournisseur a
              WHERE a.fournisseur_id = f.id AND a.statut = 'recu'), 0) AS total_avoirs,
    COALESCE((SELECT SUM(r.total)   FROM receptions r              WHERE r.fournisseur_id = f.id), 0)
  - COALESCE((SELECT SUM(g.montant) FROM reglements_fournisseurs g
              WHERE g.fournisseur_id = f.id AND g.annule_le IS NULL), 0)
  - COALESCE((SELECT SUM(a.montant_recu) FROM retours_fournisseur a
              WHERE a.fournisseur_id = f.id AND a.statut = 'recu'), 0) AS solde_du
FROM fournisseurs f
WHERE f.actif = 1;
