-- ============================================================================
-- Migration 10 — dépenses (tâche B13)
-- ============================================================================
-- Une dépense reçoit son numéro DEP à l'enregistrement. Saisie par erreur, elle ne s'efface pas :
-- elle est annulée avec un motif, reste visible et ne compte plus (REGLES_METIER § 10).
-- Les catégories se désactivent, jamais ne se suppriment.

-- Numéro DEP-AAAA-NNNNNN ; la table est vide jusqu'ici, d'où une colonne simple + index unique.
ALTER TABLE depenses ADD COLUMN numero TEXT;
CREATE UNIQUE INDEX idx_depenses_numero ON depenses(numero);
-- N° du reçu ou de la facture, en texte libre. `justificatif` reste réservé au chemin d'une photo.
ALTER TABLE depenses ADD COLUMN reference TEXT;
-- NULL = dépense valable ; sinon date et heure de l'annulation.
ALTER TABLE depenses ADD COLUMN annule_le TEXT;
ALTER TABLE depenses ADD COLUMN annule_par INTEGER REFERENCES utilisateurs(id);
ALTER TABLE depenses ADD COLUMN motif_annulation TEXT;

CREATE INDEX idx_depenses_date ON depenses(date_depense);

ALTER TABLE categories_depense ADD COLUMN actif INTEGER NOT NULL DEFAULT 1 CHECK (actif IN (0,1));
ALTER TABLE categories_depense ADD COLUMN desactive_le TEXT;

CREATE TRIGGER trg_depenses_no_delete
BEFORE DELETE ON depenses
BEGIN
    SELECT RAISE(ABORT, 'Une dépense ne se supprime pas : l''annuler.');
END;

-- Une dépense annulée est figée.
CREATE TRIGGER trg_depenses_annulee_figee
BEFORE UPDATE ON depenses
WHEN OLD.annule_le IS NOT NULL
BEGIN
    SELECT RAISE(ABORT, 'Dépense annulée : elle ne se modifie plus.');
END;

CREATE TRIGGER trg_categories_depense_no_delete
BEFORE DELETE ON categories_depense
BEGIN
    SELECT RAISE(ABORT, 'Une catégorie de dépense ne se supprime pas : la désactiver.');
END;

-- Catégories de départ, présentes aussi dans une base de production (validé par Dev B le 2026-10-08).
INSERT OR IGNORE INTO categories_depense (nom) VALUES
    ('Loyer'), ('Électricité'), ('Eau'), ('Salaires'), ('Transport'),
    ('Entretien et réparations'), ('Fournitures'), ('Impôts et taxes'), ('Autre');
