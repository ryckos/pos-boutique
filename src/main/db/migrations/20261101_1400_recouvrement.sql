-- ============================================================================
-- Migration — recouvrement des créances (tâche A12)
-- ============================================================================
-- REGLES_METIER § 7.3. Les tables creances et encaissements_creances existent depuis le schéma
-- initial ; on les complète sans les recréer.
--
-- 1. `encaissements_creances.numero_recu` : un paiement du client peut se répartir sur plusieurs
--    créances ; ses lignes partagent un numéro de reçu (EC-AAAA-NNNNNN). C'est le reçu qui s'annule.
-- 2. `annulations_encaissements` : l'annulation d'un reçu (encaissements immuables, jamais effacés).
-- 3. `reductions_creances` : un retour client sur un ticket à crédit réduit la créance (REGLES_METIER
--    § 6.8) sans la modifier : le montant initial reste figé.
-- 4. La vue `v_creances_clients` : restant dû = initial − encaissements non annulés − réductions ;
--    le statut est calculé (soldée à 0, ouverte sinon, annulée si le ticket l'est).
-- 5. Triggers : jamais plus que le restant dû, ni modification ni suppression de ces lignes.

ALTER TABLE encaissements_creances ADD COLUMN numero_recu TEXT;

CREATE INDEX idx_encaissements_recu ON encaissements_creances(numero_recu);

CREATE TABLE annulations_encaissements (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_recu       TEXT NOT NULL UNIQUE,
    motif             TEXT NOT NULL CHECK (length(trim(motif)) > 0),
    utilisateur_id    INTEGER NOT NULL REFERENCES utilisateurs(id),
    session_caisse_id INTEGER NOT NULL REFERENCES sessions_caisse(id),
    horodatage        TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE reductions_creances (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    creance_id INTEGER NOT NULL REFERENCES creances(id),
    retour_id  INTEGER NOT NULL UNIQUE REFERENCES ventes(id),
    montant    INTEGER NOT NULL CHECK (montant > 0),
    horodatage TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

DROP VIEW v_creances_clients;

CREATE VIEW v_creances_clients AS
SELECT
    c.id            AS creance_id,
    c.client_id,
    cl.nom          AS client,
    c.vente_id,
    c.montant_initial,
    COALESCE((SELECT SUM(e.montant) FROM encaissements_creances e
              WHERE e.creance_id = c.id
                AND (e.numero_recu IS NULL
                     OR NOT EXISTS (SELECT 1 FROM annulations_encaissements a
                                    WHERE a.numero_recu = e.numero_recu))), 0) AS total_encaisse,
    COALESCE((SELECT SUM(r.montant) FROM reductions_creances r
              WHERE r.creance_id = c.id), 0) AS total_reduit,
    CASE WHEN c.annulee_le IS NOT NULL THEN 0 ELSE
    c.montant_initial
  - COALESCE((SELECT SUM(e.montant) FROM encaissements_creances e
              WHERE e.creance_id = c.id
                AND (e.numero_recu IS NULL
                     OR NOT EXISTS (SELECT 1 FROM annulations_encaissements a
                                    WHERE a.numero_recu = e.numero_recu))), 0)
  - COALESCE((SELECT SUM(r.montant) FROM reductions_creances r
              WHERE r.creance_id = c.id), 0) END AS restant_du,
    c.date_echeance,
    CASE WHEN c.annulee_le IS NOT NULL THEN 'annulee'
         WHEN c.montant_initial
            - COALESCE((SELECT SUM(e.montant) FROM encaissements_creances e
                        WHERE e.creance_id = c.id
                          AND (e.numero_recu IS NULL
                               OR NOT EXISTS (SELECT 1 FROM annulations_encaissements a
                                              WHERE a.numero_recu = e.numero_recu))), 0)
            - COALESCE((SELECT SUM(r.montant) FROM reductions_creances r
                        WHERE r.creance_id = c.id), 0) <= 0 THEN 'soldee'
         ELSE 'ouverte' END AS statut,
    c.cree_le
FROM creances c
JOIN clients cl ON cl.id = c.client_id;

CREATE TRIGGER trg_encaissements_creances_plafond
BEFORE INSERT ON encaissements_creances
BEGIN
    SELECT RAISE(ABORT, 'Un encaissement ne dépasse pas le restant dû de la créance.')
    WHERE NEW.montant > COALESCE(
        (SELECT restant_du FROM v_creances_clients WHERE creance_id = NEW.creance_id), 0);
END;

CREATE TRIGGER trg_reductions_creances_plafond
BEFORE INSERT ON reductions_creances
BEGIN
    SELECT RAISE(ABORT, 'Une réduction ne dépasse pas le restant dû de la créance.')
    WHERE NEW.montant > COALESCE(
        (SELECT restant_du FROM v_creances_clients WHERE creance_id = NEW.creance_id), 0);
END;

CREATE TRIGGER trg_annulations_encaissements_no_update
BEFORE UPDATE ON annulations_encaissements
BEGIN
    SELECT RAISE(ABORT, 'Une annulation d''encaissement ne se modifie pas.');
END;

CREATE TRIGGER trg_annulations_encaissements_no_delete
BEFORE DELETE ON annulations_encaissements
BEGIN
    SELECT RAISE(ABORT, 'Une annulation d''encaissement ne se supprime pas.');
END;

CREATE TRIGGER trg_reductions_creances_no_update
BEFORE UPDATE ON reductions_creances
BEGIN
    SELECT RAISE(ABORT, 'Une réduction de créance ne se modifie pas.');
END;

CREATE TRIGGER trg_reductions_creances_no_delete
BEFORE DELETE ON reductions_creances
BEGIN
    SELECT RAISE(ABORT, 'Une réduction de créance ne se supprime pas.');
END;
