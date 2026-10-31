-- ============================================================================
-- Migration — avoirs en boutique (tâche A11, dernière partie)
-- ============================================================================
-- REGLES_METIER § 7.2. Un retour client peut être remboursé en avoir : un crédit nominatif que le
-- client dépense plus tard à la caisse, en une ou plusieurs fois.
--
-- 1. `paiements.mode` accepte `avoir` : SQLite ne sait pas modifier un CHECK, la table est recréée.
--    Rien ne dépend de `paiements` (ni clé étrangère, ni vue, ni trigger) ; les lignes sont recopiées.
-- 2. `avoirs` : un avoir par retour (`retour_id` unique), au nom d'un client. Jamais modifié ni effacé.
-- 3. `utilisations_avoir` : chaque dépense d'un avoir est une ligne positive ; son rétablissement
--    (annulation du ticket qui l'a dépensé) est une ligne négative qui pointe vers elle, une seule fois.
-- 4. Le solde n'est jamais stocké : la vue `v_avoirs_clients` le calcule (montant − utilisations).

ALTER TABLE paiements RENAME TO paiements_avant_avoirs;

CREATE TABLE paiements (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    vente_id   INTEGER NOT NULL REFERENCES ventes(id),
    mode       TEXT NOT NULL CHECK (mode IN ('especes','tmoney','flooz','carte','credit','avoir','autre')),
    montant    INTEGER NOT NULL,              -- négatif possible (remboursement d'un retour)
    reference  TEXT,                          -- n° de transaction Mobile Money
    horodatage TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

INSERT INTO paiements (id, vente_id, mode, montant, reference, horodatage)
SELECT id, vente_id, mode, montant, reference, horodatage FROM paiements_avant_avoirs;

DROP TABLE paiements_avant_avoirs;

CREATE INDEX idx_paiements_vente ON paiements(vente_id);

CREATE TABLE avoirs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    numero         TEXT NOT NULL UNIQUE,                       -- AV-AAAA-NNNNNN
    client_id      INTEGER NOT NULL REFERENCES clients(id),
    montant        INTEGER NOT NULL CHECK (montant > 0),       -- FCFA
    retour_id      INTEGER NOT NULL UNIQUE REFERENCES ventes(id),
    utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id),
    cree_le        TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX idx_avoirs_client ON avoirs(client_id);

CREATE TABLE utilisations_avoir (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    avoir_id              INTEGER NOT NULL REFERENCES avoirs(id),
    vente_id              INTEGER NOT NULL REFERENCES ventes(id),
    montant               INTEGER NOT NULL CHECK (montant <> 0),  -- > 0 dépensé, < 0 rétabli
    utilisation_origine_id INTEGER REFERENCES utilisations_avoir(id),
    utilisateur_id        INTEGER NOT NULL REFERENCES utilisateurs(id),
    horodatage            TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX idx_utilisations_avoir ON utilisations_avoir(avoir_id);
CREATE INDEX idx_utilisations_avoir_vente ON utilisations_avoir(vente_id);
-- Une dépense n'est rétablie qu'une fois.
CREATE UNIQUE INDEX idx_utilisations_avoir_origine ON utilisations_avoir(utilisation_origine_id)
    WHERE utilisation_origine_id IS NOT NULL;

CREATE TRIGGER trg_avoirs_no_update BEFORE UPDATE ON avoirs
BEGIN SELECT RAISE(ABORT, 'Un avoir ne se modifie pas.'); END;

CREATE TRIGGER trg_avoirs_no_delete BEFORE DELETE ON avoirs
BEGIN SELECT RAISE(ABORT, 'Un avoir ne se supprime pas.'); END;

CREATE TRIGGER trg_utilisations_avoir_no_update BEFORE UPDATE ON utilisations_avoir
BEGIN SELECT RAISE(ABORT, 'L''utilisation d''un avoir ne se modifie pas : la rétablir.'); END;

CREATE TRIGGER trg_utilisations_avoir_no_delete BEFORE DELETE ON utilisations_avoir
BEGIN SELECT RAISE(ABORT, 'L''utilisation d''un avoir ne se supprime pas : la rétablir.'); END;

-- Jamais plus dépensé que le solde de l'avoir : filet de sécurité sous le service.
CREATE TRIGGER trg_utilisations_avoir_solde BEFORE INSERT ON utilisations_avoir
WHEN (SELECT montant FROM avoirs WHERE id = NEW.avoir_id)
     < (SELECT COALESCE(SUM(montant), 0) FROM utilisations_avoir WHERE avoir_id = NEW.avoir_id) + NEW.montant
  OR (SELECT COALESCE(SUM(montant), 0) FROM utilisations_avoir WHERE avoir_id = NEW.avoir_id) + NEW.montant < 0
BEGIN SELECT RAISE(ABORT, 'Le solde de l''avoir ne permet pas cette opération.'); END;

CREATE VIEW v_avoirs_clients AS
SELECT
    a.id        AS avoir_id,
    a.numero,
    a.client_id,
    a.montant   AS montant_initial,
    a.retour_id,
    a.cree_le,
    COALESCE(SUM(u.montant), 0)             AS utilise,
    a.montant - COALESCE(SUM(u.montant), 0) AS solde
FROM avoirs a
LEFT JOIN utilisations_avoir u ON u.avoir_id = a.id
GROUP BY a.id;
