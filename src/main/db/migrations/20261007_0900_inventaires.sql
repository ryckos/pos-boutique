-- ============================================================================
-- Migration 9 — inventaires (tâche B12)
-- ============================================================================
-- Un inventaire est total (categorie_id NULL) ou partiel par rayon (le rayon et ses sous-rayons).
-- Chaque comptage est enregistré aussitôt ; un recomptage remplace la ligne tant que l'inventaire
-- est en cours. Validé ou annulé, il est figé : les triggers ci-dessous le garantissent
-- (REGLES_METIER § 9).

ALTER TABLE inventaires ADD COLUMN categorie_id INTEGER REFERENCES categories(id);
ALTER TABLE inventaires ADD COLUMN motif_annulation TEXT;

-- Heure du comptage : le théorique est photographié à ce moment-là.
ALTER TABLE lignes_inventaire ADD COLUMN compte_le TEXT;
-- Précision libre sur l'écart (« vol présumé »), en plus du motif de la liste.
ALTER TABLE lignes_inventaire ADD COLUMN commentaire TEXT;

-- Une ligne par produit et par inventaire : un recomptage remplace la ligne.
CREATE UNIQUE INDEX idx_lignes_inv_produit ON lignes_inventaire(inventaire_id, produit_id);

-- Rien n'est effacé : un inventaire s'annule par son statut.
CREATE TRIGGER trg_inventaires_no_delete
BEFORE DELETE ON inventaires
BEGIN
    SELECT RAISE(ABORT, 'Un inventaire ne se supprime pas : l''annuler.');
END;

CREATE TRIGGER trg_lignes_inventaire_no_delete
BEFORE DELETE ON lignes_inventaire
BEGIN
    SELECT RAISE(ABORT, 'Un comptage d''inventaire ne se supprime pas.');
END;

-- Un inventaire validé ou annulé est figé : ses comptages ne bougent plus.
CREATE TRIGGER trg_lignes_inventaire_figees
BEFORE UPDATE ON lignes_inventaire
WHEN (SELECT statut FROM inventaires WHERE id = OLD.inventaire_id) <> 'en_cours'
BEGIN
    SELECT RAISE(ABORT, 'Inventaire figé : ses comptages ne se modifient plus.');
END;

CREATE TRIGGER trg_lignes_inventaire_ajout_fige
BEFORE INSERT ON lignes_inventaire
WHEN (SELECT statut FROM inventaires WHERE id = NEW.inventaire_id) <> 'en_cours'
BEGIN
    SELECT RAISE(ABORT, 'Inventaire figé : il ne reçoit plus de comptage.');
END;

CREATE TRIGGER trg_inventaires_fige
BEFORE UPDATE ON inventaires
WHEN OLD.statut <> 'en_cours'
BEGIN
    SELECT RAISE(ABORT, 'Inventaire figé : il ne se modifie plus.');
END;
