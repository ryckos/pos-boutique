-- ============================================================================
-- Migration 11 — mouvements de caisse (tâche A8)
-- ============================================================================
-- Apports, retraits et dépenses payées au tiroir (REGLES_METIER § 6.10). Trois changements, qui
-- imposent de recréer la table (SQLite ne sait pas modifier un CHECK) ; aucune table ni vue ne
-- dépend de mouvements_caisse, et ses lignes sont recopiées telles quelles.
--
-- 1. Motif `reglement_fournisseur` : payer un fournisseur depuis le tiroir (demande de Dev B, B10).
-- 2. `mouvement_origine_id` : un mouvement saisi par erreur ne s'efface pas, il est annulé par un
--    contre-mouvement de sens inverse qui pointe vers lui. Une seule annulation par mouvement.
-- 3. Triggers : l'historique ne se modifie ni ne s'efface, et une session clôturée est figée
--    (rien ne s'y rattache après la clôture, sinon le Z ne serait plus juste).

ALTER TABLE mouvements_caisse RENAME TO mouvements_caisse_avant_a8;

CREATE TABLE mouvements_caisse (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    session_caisse_id    INTEGER NOT NULL REFERENCES sessions_caisse(id),
    sens                 TEXT NOT NULL CHECK (sens IN ('entree','sortie')),
    motif                TEXT NOT NULL CHECK (motif IN
                         ('apport','retrait','depense','encaissement_creance','remboursement',
                          'reglement_fournisseur','autre')),
    montant              INTEGER NOT NULL CHECK (montant > 0),
    document_type        TEXT,                   -- 'depense', 'encaissement', 'reglement_fournisseur'…
    document_id          INTEGER,
    commentaire          TEXT,
    utilisateur_id       INTEGER NOT NULL REFERENCES utilisateurs(id),
    horodatage           TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    -- Renseigné sur un contre-mouvement : le mouvement qu'il annule.
    mouvement_origine_id INTEGER REFERENCES mouvements_caisse(id)
);

INSERT INTO mouvements_caisse (id, session_caisse_id, sens, motif, montant, document_type, document_id,
                               commentaire, utilisateur_id, horodatage)
SELECT id, session_caisse_id, sens, motif, montant, document_type, document_id,
       commentaire, utilisateur_id, horodatage
FROM mouvements_caisse_avant_a8;

DROP TABLE mouvements_caisse_avant_a8;

CREATE INDEX idx_mvt_caisse_session ON mouvements_caisse(session_caisse_id);
CREATE UNIQUE INDEX idx_mvt_caisse_origine ON mouvements_caisse(mouvement_origine_id)
    WHERE mouvement_origine_id IS NOT NULL;

CREATE TRIGGER trg_mouvements_caisse_no_update
BEFORE UPDATE ON mouvements_caisse
BEGIN
    SELECT RAISE(ABORT, 'Un mouvement de caisse ne se modifie pas : l''annuler.');
END;

CREATE TRIGGER trg_mouvements_caisse_no_delete
BEFORE DELETE ON mouvements_caisse
BEGIN
    SELECT RAISE(ABORT, 'Un mouvement de caisse ne se supprime pas : l''annuler.');
END;

CREATE TRIGGER trg_mouvements_caisse_session_figee
BEFORE INSERT ON mouvements_caisse
WHEN (SELECT statut FROM sessions_caisse WHERE id = NEW.session_caisse_id) IS NOT 'ouverte'
BEGIN
    SELECT RAISE(ABORT, 'Cette caisse est clôturée : ouvrez une nouvelle session.');
END;
