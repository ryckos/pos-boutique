-- ============================================================================
-- Migration — clients et crédit (tâche A11)
-- ============================================================================
-- REGLES_METIER § 7. Les tables clients, creances et encaissements_creances existent depuis le
-- schéma initial ; on les complète sans les recréer (encaissements_creances et la vue
-- v_creances_clients dépendent de creances : la renommer réécrirait leurs références).
--
-- 1. `clients.nif` : recopié sur la facture comme le NIF saisi à la main (A10).
-- 2. Annulation d'une créance (ticket à crédit annulé, A6) : colonnes ajoutées plutôt qu'un nouveau
--    statut, SQLite ne sachant pas modifier un CHECK. Une créance annulée garde statut = 'ouverte' ;
--    la vue expose le statut 'annulee' et un restant dû de 0.
-- 3. Triggers : un client ne se supprime pas (désactivation) ; une créance ne se supprime pas, son
--    montant, sa vente et son client ne changent pas, et une annulation est définitive ; un
--    encaissement ne se modifie ni ne s'efface.

ALTER TABLE clients ADD COLUMN nif TEXT;

ALTER TABLE creances ADD COLUMN annulee_le TEXT;
ALTER TABLE creances ADD COLUMN annulee_par INTEGER REFERENCES utilisateurs(id);
ALTER TABLE creances ADD COLUMN motif_annulation TEXT;

DROP VIEW v_creances_clients;

CREATE VIEW v_creances_clients AS
SELECT
    c.id            AS creance_id,
    c.client_id,
    cl.nom          AS client,
    c.vente_id,
    c.montant_initial,
    COALESCE((SELECT SUM(e.montant) FROM encaissements_creances e
              WHERE e.creance_id = c.id), 0) AS total_encaisse,
    CASE WHEN c.annulee_le IS NOT NULL THEN 0 ELSE
    c.montant_initial
  - COALESCE((SELECT SUM(e.montant) FROM encaissements_creances e
              WHERE e.creance_id = c.id), 0) END AS restant_du,
    c.date_echeance,
    CASE WHEN c.annulee_le IS NOT NULL THEN 'annulee' ELSE c.statut END AS statut,
    c.cree_le
FROM creances c
JOIN clients cl ON cl.id = c.client_id;

CREATE TRIGGER trg_clients_no_delete
BEFORE DELETE ON clients
BEGIN
    SELECT RAISE(ABORT, 'Un client ne se supprime pas : le désactiver.');
END;

CREATE TRIGGER trg_creances_no_delete
BEFORE DELETE ON creances
BEGIN
    SELECT RAISE(ABORT, 'Une créance ne se supprime pas : l''annuler.');
END;

CREATE TRIGGER trg_creances_figees
BEFORE UPDATE OF vente_id, client_id, montant_initial, cree_le ON creances
BEGIN
    SELECT RAISE(ABORT, 'Le montant, la vente et le client d''une créance ne se modifient pas.');
END;

CREATE TRIGGER trg_creances_annulation_definitive
BEFORE UPDATE ON creances
WHEN OLD.annulee_le IS NOT NULL
BEGIN
    SELECT RAISE(ABORT, 'Une créance annulée ne se modifie plus.');
END;

CREATE TRIGGER trg_encaissements_creances_no_update
BEFORE UPDATE ON encaissements_creances
BEGIN
    SELECT RAISE(ABORT, 'Un encaissement de créance ne se modifie pas.');
END;

CREATE TRIGGER trg_encaissements_creances_no_delete
BEFORE DELETE ON encaissements_creances
BEGIN
    SELECT RAISE(ABORT, 'Un encaissement de créance ne se supprime pas.');
END;
