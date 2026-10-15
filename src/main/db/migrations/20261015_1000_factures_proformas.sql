-- ============================================================================
-- Migration 13 — factures et proformas (tâche A10)
-- ============================================================================
-- Facture : document A4 fait à partir d'un ticket DÉJÀ encaissé (une par ticket). Elle ne crée ni
-- vente, ni mouvement de stock, ni paiement : la vente est le ticket. Les coordonnées du client sont
-- recopiées au moment T (la fiche client arrive en A11 : client_id restera NULL d'ici là).
-- Proforma : devis fait depuis le panier de la caisse, sans effet sur le stock ni sur la caisse,
-- sans session ; prix, TVA et désignations relus en base et recopiés.
-- Rien ne se modifie ni ne s'efface (REGLES_METIER § 6.12 et § 6.13). Le type 'facture' / 'proforma'
-- de la table ventes n'est pas utilisé.

CREATE TABLE factures (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    numero           TEXT NOT NULL UNIQUE,                         -- F-AAAA-NNNNNN
    vente_id         INTEGER NOT NULL UNIQUE REFERENCES ventes(id), -- une facture par ticket
    client_id        INTEGER REFERENCES clients(id),
    client_nom       TEXT NOT NULL,
    client_telephone TEXT,
    client_adresse   TEXT,
    client_nif       TEXT,
    utilisateur_id   INTEGER NOT NULL REFERENCES utilisateurs(id),
    horodatage       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE proformas (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    numero           TEXT NOT NULL UNIQUE,                         -- PF-AAAA-NNNNNN
    client_id        INTEGER REFERENCES clients(id),
    client_nom       TEXT,                                         -- facultatif
    client_telephone TEXT,
    client_adresse   TEXT,
    client_nif       TEXT,
    total_ht         INTEGER NOT NULL,
    total_tva        INTEGER NOT NULL,
    total_ttc        INTEGER NOT NULL,
    remise_globale   INTEGER NOT NULL DEFAULT 0,
    valide_jusqu_au  TEXT NOT NULL,                                -- AAAA-MM-JJ
    utilisateur_id   INTEGER NOT NULL REFERENCES utilisateurs(id),
    horodatage       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE lignes_proforma (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    proforma_id        INTEGER NOT NULL REFERENCES proformas(id),
    produit_id         INTEGER NOT NULL REFERENCES produits(id),
    conditionnement_id INTEGER NOT NULL REFERENCES conditionnements(id),
    designation        TEXT NOT NULL,
    quantite           INTEGER NOT NULL CHECK (quantite > 0),
    prix_unitaire      INTEGER NOT NULL,
    remise_ligne       INTEGER NOT NULL DEFAULT 0,
    taux_tva           REAL NOT NULL,
    total_ligne        INTEGER NOT NULL
);

CREATE INDEX idx_lignes_proforma ON lignes_proforma(proforma_id);

CREATE TRIGGER trg_factures_no_update BEFORE UPDATE ON factures
BEGIN
    SELECT RAISE(ABORT, 'Une facture ne se modifie pas.');
END;
CREATE TRIGGER trg_factures_no_delete BEFORE DELETE ON factures
BEGIN
    SELECT RAISE(ABORT, 'Une facture ne se supprime pas.');
END;
CREATE TRIGGER trg_proformas_no_update BEFORE UPDATE ON proformas
BEGIN
    SELECT RAISE(ABORT, 'Une proforma ne se modifie pas : faites-en une nouvelle.');
END;
CREATE TRIGGER trg_proformas_no_delete BEFORE DELETE ON proformas
BEGIN
    SELECT RAISE(ABORT, 'Une proforma ne se supprime pas.');
END;
CREATE TRIGGER trg_lignes_proforma_no_update BEFORE UPDATE ON lignes_proforma
BEGIN
    SELECT RAISE(ABORT, 'Une proforma ne se modifie pas : faites-en une nouvelle.');
END;
CREATE TRIGGER trg_lignes_proforma_no_delete BEFORE DELETE ON lignes_proforma
BEGIN
    SELECT RAISE(ABORT, 'Une proforma ne se supprime pas.');
END;
