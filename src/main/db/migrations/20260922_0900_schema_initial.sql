-- ============================================================================
-- SCHEMA DE BASE DE DONNEES — GESTION DE BOUTIQUE (MINI-SUPERMARCHE)
-- Dialecte : SQLite 3.31+ (compatible node:sqlite / better-sqlite3 / PDO)
-- ============================================================================
--
-- CONVENTIONS
--   * Montants en INTEGER (FCFA, sans décimales) — jamais de flottant pour
--     l'argent. Seules exceptions : cout_moyen_pondere et cout_unitaire (REAL,
--     résultats de divisions) et les quantités (REAL, produits pesés futurs).
--   * Dates/horodatages en TEXT ISO-8601 : '2026-08-03T14:35:00' — triables,
--     lisibles, compatibles avec les fonctions date() de SQLite.
--   * Suppression logique via la colonne actif (0/1). Jamais de DELETE sur
--     les données de gestion.
--   * SOURCE DE VERITE UNIQUE : le stock n'est stocké nulle part. Il est
--     calculé par les vues (SUM des mouvements). Voir section VUES.
--   * CONDITIONNEMENTS : le stock est compté dans UNE unité de base par
--     produit (la boîte, le kg…). Les déclinaisons vendables (unité, lot
--     de 3, carton de 24) sont dans la table conditionnements, chacune avec
--     son prix libre et son code-barres. Toute vente/réception est convertie
--     en unités de base dans mouvements_stock.
--   * IMPORTANT — à exécuter à CHAQUE ouverture de connexion par l'application
--     (ce sont des réglages par connexion, pas par base) :
--         PRAGMA foreign_keys = ON;
--         PRAGMA journal_mode = WAL;
-- ============================================================================


-- ============================================================================
-- 1. PARAMETRES & UTILISATEURS
-- ============================================================================

-- Paramètres de la boutique en clé/valeur : nom, adresse, NIF, en-tête et
-- pied du ticket, taux de TVA par défaut, seuils d'alerte péremption, etc.
CREATE TABLE parametres (
    cle    TEXT PRIMARY KEY,
    valeur TEXT
);

CREATE TABLE utilisateurs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    nom           TEXT NOT NULL,
    pin_hash      TEXT NOT NULL,              -- hash du code PIN (jamais en clair)
    role          TEXT NOT NULL CHECK (role IN ('caissier','gerant','admin')),
    actif         INTEGER NOT NULL DEFAULT 1,
    cree_le       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Journal d'audit des actions sensibles : modification de prix, remise,
-- annulation, ouverture du tiroir hors vente, etc. IMMUABLE (triggers).
CREATE TABLE journal_audit (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    utilisateur_id   INTEGER NOT NULL REFERENCES utilisateurs(id),
    action           TEXT NOT NULL,           -- ex : 'modification_prix', 'remise', 'ouverture_tiroir'
    entite           TEXT,                    -- table concernée (ex : 'produits')
    entite_id        INTEGER,                 -- id de la ligne concernée
    ancienne_valeur  TEXT,                    -- JSON de l'état avant
    nouvelle_valeur  TEXT,                    -- JSON de l'état après
    horodatage       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ============================================================================
-- 2. PRODUITS & CATEGORIES
-- ============================================================================

CREATE TABLE categories (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    nom       TEXT NOT NULL,
    parent_id INTEGER REFERENCES categories(id),   -- sous-catégories possibles
    actif     INTEGER NOT NULL DEFAULT 1
);

-- Le produit = CE QU'ON STOCKE, dans son unité de base (la boîte, le kg…).
-- Les prix et les codes-barres vivent dans conditionnements : CE QU'ON VEND.
-- Le stock, le CUMP et le seuil d'alerte sont TOUJOURS en unités de base.
CREATE TABLE produits (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    nom                 TEXT NOT NULL,
    categorie_id        INTEGER REFERENCES categories(id),
    unite               TEXT NOT NULL DEFAULT 'piece'
                        CHECK (unite IN ('piece','kg','g','litre','ml','paquet')),
    taux_tva            REAL NOT NULL DEFAULT 18,                   -- % (0 si exonéré)
    cout_moyen_pondere  REAL NOT NULL DEFAULT 0,  -- CUMP PAR UNITE DE BASE, recalculé par l'app
                                                  -- à chaque réception : nouveau =
                                                  -- (stock*ancien + qte_base*prix_base) / (stock+qte_base)
    suivi_peremption    INTEGER NOT NULL DEFAULT 0,  -- 1 = géré par lots avec date de péremption
    seuil_alerte        REAL NOT NULL DEFAULT 0,     -- stock mini EN UNITES DE BASE
    photo               TEXT,                        -- chemin de l'image (boutons tactiles)
    actif               INTEGER NOT NULL DEFAULT 1,
    cree_le             TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    modifie_le          TEXT
);

CREATE INDEX idx_produits_categorie   ON produits(categorie_id);

-- CONDITIONNEMENTS : les déclinaisons vendables d'un produit.
-- Ex. tomate concentrée : Unité ×1 à 350 F, Lot de 3 ×3 à 1 000 F,
-- Carton de 24 ×24 à 7 500 F. Le prix de chaque conditionnement est LIBRE
-- (dégressif si on veut) — jamais calculé par multiplication.
-- Tout produit possède au moins un conditionnement « Unité » (×1, est_defaut=1).
CREATE TABLE conditionnements (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    produit_id    INTEGER NOT NULL REFERENCES produits(id),
    nom           TEXT NOT NULL,               -- 'Unité', 'Lot de 3', 'Carton de 24'…
    quantite_base REAL NOT NULL CHECK (quantite_base > 0),  -- combien d'unités de base il contient
    prix_vente    INTEGER NOT NULL CHECK (prix_vente >= 0), -- FCFA TTC, saisi librement
    code_barres   TEXT UNIQUE,                 -- EAN-13 unité, ITF-14 carton, code interne 20-29…
    code_plu      TEXT UNIQUE,                 -- code court tapable (ex : '101')
    est_defaut    INTEGER NOT NULL DEFAULT 0,  -- conditionnement proposé par défaut (l'unité)
    actif         INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_cond_produit ON conditionnements(produit_id);

-- ============================================================================
-- 3. LOTS (péremption) & MOUVEMENTS DE STOCK (cœur de la traçabilité)
-- ============================================================================

-- Un lot = un arrivage d'un produit, avec sa date de péremption et son coût.
-- La quantité restante d'un lot n'est PAS stockée : voir v_stock_lots.
CREATE TABLE lots (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    produit_id          INTEGER NOT NULL REFERENCES produits(id),
    numero_lot          TEXT,
    date_peremption     TEXT,                  -- NULL si non périssable
    prix_achat_unitaire INTEGER NOT NULL DEFAULT 0,
    reception_id        INTEGER REFERENCES receptions(id),
    cree_le             TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX idx_lots_produit    ON lots(produit_id, date_peremption);

-- LE JOURNAL. Chaque variation de stock, sans exception, passe par ici.
-- quantite : positive = entrée, négative = sortie.
-- document_type/document_id : le document source (vente, réception, inventaire…)
-- IMMUABLE : les triggers plus bas interdisent UPDATE et DELETE.
-- Pour corriger une erreur : insérer un mouvement inverse (contre-passation).
CREATE TABLE mouvements_stock (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    produit_id     INTEGER NOT NULL REFERENCES produits(id),
    lot_id         INTEGER REFERENCES lots(id),   -- NULL si produit sans suivi de lot
    type           TEXT NOT NULL CHECK (type IN (
                       'reception',            -- entrée fournisseur (+)
                       'vente',                -- sortie caisse (−)
                       'retour_client',        -- retour en stock (+)
                       'retour_fournisseur',   -- renvoi au fournisseur (−)
                       'ajustement_inventaire',-- écart d'inventaire (±)
                       'perte_peremption',     -- produit périmé jeté (−)
                       'casse',                -- produit cassé/abîmé (−)
                       'vol',                  -- démarque inconnue (−)
                       'contre_passation'      -- annulation d'un mouvement (±)
                   )),
    quantite       REAL NOT NULL CHECK (quantite <> 0),
    cout_unitaire  REAL NOT NULL DEFAULT 0,    -- CUMP au moment du mouvement
    document_type  TEXT,                       -- 'vente', 'reception', 'inventaire', 'manuel'…
    document_id    INTEGER,
    mouvement_origine_id INTEGER REFERENCES mouvements_stock(id), -- si contre-passation
    motif          TEXT,
    utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id),
    horodatage     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX idx_mouvements_produit  ON mouvements_stock(produit_id);
CREATE INDEX idx_mouvements_lot      ON mouvements_stock(lot_id);
CREATE INDEX idx_mouvements_date     ON mouvements_stock(horodatage);
CREATE INDEX idx_mouvements_document ON mouvements_stock(document_type, document_id);

-- IMMUTABILITE : la base elle-même refuse toute réécriture de l'historique.
CREATE TRIGGER trg_mouvements_no_update
BEFORE UPDATE ON mouvements_stock
BEGIN
    SELECT RAISE(ABORT, 'mouvements_stock est immuable : créer une contre-passation.');
END;

CREATE TRIGGER trg_mouvements_no_delete
BEFORE DELETE ON mouvements_stock
BEGIN
    SELECT RAISE(ABORT, 'mouvements_stock est immuable : créer une contre-passation.');
END;

CREATE TRIGGER trg_audit_no_update
BEFORE UPDATE ON journal_audit
BEGIN
    SELECT RAISE(ABORT, 'journal_audit est immuable.');
END;

CREATE TRIGGER trg_audit_no_delete
BEFORE DELETE ON journal_audit
BEGIN
    SELECT RAISE(ABORT, 'journal_audit est immuable.');
END;

-- ============================================================================
-- 4. CAISSE : SESSIONS, VENTES, PAIEMENTS, MOUVEMENTS DE CAISSE
-- ============================================================================

CREATE TABLE sessions_caisse (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    utilisateur_id     INTEGER NOT NULL REFERENCES utilisateurs(id),
    fond_ouverture     INTEGER NOT NULL DEFAULT 0,   -- espèces au départ
    date_ouverture     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    date_fermeture     TEXT,
    -- Photographies prises à la clôture (faits historiques, donc stockés) :
    montant_theorique  INTEGER,   -- espèces attendues (fond + ventes espèces ± mouvements)
    montant_compte     INTEGER,   -- espèces réellement comptées dans le tiroir
    ecart              INTEGER,   -- compte − théorique (négatif = manque)
    statut             TEXT NOT NULL DEFAULT 'ouverte' CHECK (statut IN ('ouverte','fermee')),
    commentaire        TEXT
);

CREATE TABLE ventes (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_ticket      TEXT NOT NULL UNIQUE,      -- séquentiel généré par l'app (ex : T-2026-000123)
    session_caisse_id  INTEGER NOT NULL REFERENCES sessions_caisse(id),
    utilisateur_id     INTEGER NOT NULL REFERENCES utilisateurs(id),
    client_id          INTEGER REFERENCES clients(id),   -- NULL = client de passage
    type               TEXT NOT NULL DEFAULT 'ticket'
                       CHECK (type IN ('ticket','facture','proforma','retour')),
    vente_origine_id   INTEGER REFERENCES ventes(id),    -- pour type='retour' ou annulation
    statut             TEXT NOT NULL DEFAULT 'terminee'
                       CHECK (statut IN ('en_attente','terminee','annulee')),
    motif_annulation   TEXT,
    total_ht           INTEGER NOT NULL DEFAULT 0,
    total_tva          INTEGER NOT NULL DEFAULT 0,
    total_ttc          INTEGER NOT NULL DEFAULT 0,
    remise_globale     INTEGER NOT NULL DEFAULT 0,
    montant_recu       INTEGER NOT NULL DEFAULT 0,  -- espèces données par le client
    monnaie_rendue     INTEGER NOT NULL DEFAULT 0,
    est_credit         INTEGER NOT NULL DEFAULT 0,  -- 1 = vente à crédit (voir creances)
    horodatage         TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX idx_ventes_session ON ventes(session_caisse_id);
CREATE INDEX idx_ventes_date    ON ventes(horodatage);
CREATE INDEX idx_ventes_client  ON ventes(client_id);

-- Interdiction de supprimer une vente : on l'annule (statut) + contre-passation.
CREATE TRIGGER trg_ventes_no_delete
BEFORE DELETE ON ventes
BEGIN
    SELECT RAISE(ABORT, 'Une vente ne se supprime pas : statut=annulee + contre-passation.');
END;

-- Lignes du ticket. PHOTOCOPIE AU MOMENT T : designation, prix_unitaire,
-- taux_tva et cout_unitaire sont copiés au moment de la vente.
-- Les tickets historiques restent exacts même si le produit change ensuite,
-- et la marge (prix − coût) est la vraie marge historique.
-- Une ligne = un CONDITIONNEMENT : quantite = nombre de conditionnements
-- (ex : 2 cartons), quantite_base_totale = équivalent en unités de base
-- (ex : 48 boîtes) — c'est cette valeur que le mouvement de stock décrémente.
CREATE TABLE lignes_vente (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    vente_id             INTEGER NOT NULL REFERENCES ventes(id),
    produit_id           INTEGER NOT NULL REFERENCES produits(id),
    conditionnement_id   INTEGER NOT NULL REFERENCES conditionnements(id),
    lot_id               INTEGER REFERENCES lots(id),
    designation          TEXT NOT NULL,        -- ex : 'Tomate concentrée — Carton de 24'
    quantite             REAL NOT NULL CHECK (quantite > 0),  -- nb de conditionnements
    prix_unitaire        INTEGER NOT NULL,     -- prix TTC DU CONDITIONNEMENT au moment de la vente
    remise_ligne         INTEGER NOT NULL DEFAULT 0,
    taux_tva             REAL NOT NULL DEFAULT 18,
    cout_unitaire        REAL NOT NULL DEFAULT 0,  -- coût D'UN CONDITIONNEMENT (CUMP × quantite_base)
    quantite_base_totale REAL NOT NULL,        -- quantite × quantite_base (copié au moment T)
    total_ligne          INTEGER NOT NULL      -- quantite*prix_unitaire − remise_ligne
);

CREATE INDEX idx_lignes_vente_vente   ON lignes_vente(vente_id);
CREATE INDEX idx_lignes_vente_produit ON lignes_vente(produit_id);

CREATE TRIGGER trg_lignes_vente_no_delete
BEFORE DELETE ON lignes_vente
BEGIN
    SELECT RAISE(ABORT, 'Les lignes de vente ne se suppriment pas.');
END;

-- Paiements d'une vente. Une vente peut en avoir plusieurs (paiement mixte).
-- Le mode 'credit' matérialise la partie non payée (voir creances).
CREATE TABLE paiements (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    vente_id   INTEGER NOT NULL REFERENCES ventes(id),
    mode       TEXT NOT NULL CHECK (mode IN ('especes','tmoney','flooz','carte','credit','autre')),
    montant    INTEGER NOT NULL,              -- négatif possible (remboursement d'un retour)
    reference  TEXT,                          -- n° de transaction Mobile Money
    horodatage TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX idx_paiements_vente ON paiements(vente_id);

-- Entrées/sorties d'espèces hors vente : apport, retrait du propriétaire,
-- dépense payée depuis le tiroir, encaissement de créance, remboursement.
CREATE TABLE mouvements_caisse (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    session_caisse_id INTEGER NOT NULL REFERENCES sessions_caisse(id),
    sens              TEXT NOT NULL CHECK (sens IN ('entree','sortie')),
    motif             TEXT NOT NULL CHECK (motif IN
                      ('apport','retrait','depense','encaissement_creance','remboursement','autre')),
    montant           INTEGER NOT NULL CHECK (montant > 0),
    document_type     TEXT,                   -- 'depense', 'encaissement'…
    document_id       INTEGER,
    commentaire       TEXT,
    utilisateur_id    INTEGER NOT NULL REFERENCES utilisateurs(id),
    horodatage        TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX idx_mvt_caisse_session ON mouvements_caisse(session_caisse_id);

-- ============================================================================
-- 5. FOURNISSEURS & APPROVISIONNEMENTS
-- ============================================================================

CREATE TABLE fournisseurs (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    nom                 TEXT NOT NULL,
    contact             TEXT,
    telephone           TEXT,
    adresse             TEXT,
    delai_paiement_jours INTEGER NOT NULL DEFAULT 0,   -- 0 = comptant
    actif               INTEGER NOT NULL DEFAULT 1,
    cree_le             TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE commandes_achat (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    numero         TEXT NOT NULL UNIQUE,      -- ex : CA-2026-0001
    fournisseur_id INTEGER NOT NULL REFERENCES fournisseurs(id),
    statut         TEXT NOT NULL DEFAULT 'brouillon'
                   CHECK (statut IN ('brouillon','envoyee','recue_partiel','recue','annulee')),
    date_commande  TEXT NOT NULL DEFAULT (date('now','localtime')),
    utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id),
    commentaire    TEXT
);

CREATE TABLE lignes_commande_achat (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    commande_id        INTEGER NOT NULL REFERENCES commandes_achat(id),
    produit_id         INTEGER NOT NULL REFERENCES produits(id),
    quantite_commandee REAL NOT NULL CHECK (quantite_commandee > 0),
    prix_achat_prevu   INTEGER NOT NULL DEFAULT 0
);

-- Réception = arrivage physique. Peut être liée à une commande (livraison)
-- ou directe (achat au marché sans commande préalable).
-- C'est la réception qui crée la dette fournisseur (voir v_dettes_fournisseurs).
CREATE TABLE receptions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    numero         TEXT NOT NULL UNIQUE,      -- ex : RC-2026-0001
    commande_id    INTEGER REFERENCES commandes_achat(id),
    fournisseur_id INTEGER NOT NULL REFERENCES fournisseurs(id),
    date_reception TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    total          INTEGER NOT NULL DEFAULT 0,   -- somme des lignes (dette créée)
    utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id),
    commentaire    TEXT
);

-- Chaque ligne de réception crée : 1 lot (si suivi_peremption) + 1 mouvement
-- de stock 'reception' EN UNITES DE BASE + met à jour le CUMP (côté application).
-- On achète souvent en gros : quantite_recue = nb de conditionnements reçus
-- (ex : 3 cartons), prix_achat_unitaire = prix D'UN conditionnement (ex : 6 000 F
-- le carton), quantite_base_totale = équivalent en unités de base (ex : 72).
-- Coût par unité de base pour le CUMP = prix_achat_unitaire / quantite_base.
CREATE TABLE lignes_reception (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    reception_id         INTEGER NOT NULL REFERENCES receptions(id),
    produit_id           INTEGER NOT NULL REFERENCES produits(id),
    conditionnement_id   INTEGER REFERENCES conditionnements(id),  -- NULL = saisi en unités de base
    quantite_recue       REAL NOT NULL CHECK (quantite_recue > 0), -- nb de conditionnements
    prix_achat_unitaire  INTEGER NOT NULL,     -- prix d'achat d'UN conditionnement
    quantite_base_totale REAL NOT NULL CHECK (quantite_base_totale > 0),
    numero_lot           TEXT,
    date_peremption      TEXT
);

CREATE INDEX idx_lignes_reception_rec ON lignes_reception(reception_id);

-- Règlements versés aux fournisseurs (dette − règlements = solde dû).
CREATE TABLE reglements_fournisseurs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    fournisseur_id INTEGER NOT NULL REFERENCES fournisseurs(id),
    reception_id   INTEGER REFERENCES receptions(id),   -- NULL = règlement global
    montant        INTEGER NOT NULL CHECK (montant > 0),
    mode           TEXT NOT NULL CHECK (mode IN ('especes','tmoney','flooz','virement','autre')),
    reference      TEXT,
    date_reglement TEXT NOT NULL DEFAULT (date('now','localtime')),
    utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id)
);

-- ============================================================================
-- 6. CLIENTS, CREANCES & RECOUVREMENT
-- ============================================================================

CREATE TABLE clients (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    nom            TEXT NOT NULL,
    telephone      TEXT,
    adresse        TEXT,
    plafond_credit INTEGER NOT NULL DEFAULT 0,   -- 0 = pas de crédit autorisé
    actif          INTEGER NOT NULL DEFAULT 1,
    cree_le        TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Une créance naît d'une vente à crédit (ventes.est_credit = 1).
-- Le restant dû n'est PAS stocké : voir v_creances_clients.
CREATE TABLE creances (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    vente_id        INTEGER NOT NULL UNIQUE REFERENCES ventes(id),
    client_id       INTEGER NOT NULL REFERENCES clients(id),
    montant_initial INTEGER NOT NULL CHECK (montant_initial > 0),
    date_echeance   TEXT,
    statut          TEXT NOT NULL DEFAULT 'ouverte' CHECK (statut IN ('ouverte','soldee')),
    cree_le         TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX idx_creances_client ON creances(client_id, statut);

-- Chaque encaissement passe par une session de caisse (traçabilité trésorerie).
CREATE TABLE encaissements_creances (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    creance_id        INTEGER NOT NULL REFERENCES creances(id),
    montant           INTEGER NOT NULL CHECK (montant > 0),
    mode              TEXT NOT NULL CHECK (mode IN ('especes','tmoney','flooz','carte','autre')),
    reference         TEXT,
    session_caisse_id INTEGER NOT NULL REFERENCES sessions_caisse(id),
    utilisateur_id    INTEGER NOT NULL REFERENCES utilisateurs(id),
    horodatage        TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ============================================================================
-- 7. DEPENSES
-- ============================================================================

CREATE TABLE categories_depense (
    id  INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL UNIQUE                  -- loyer, électricité, salaires, transport…
);

CREATE TABLE depenses (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    categorie_id      INTEGER NOT NULL REFERENCES categories_depense(id),
    libelle           TEXT NOT NULL,
    montant           INTEGER NOT NULL CHECK (montant > 0),
    source            TEXT NOT NULL CHECK (source IN ('caisse','fonds_propres')),
    session_caisse_id INTEGER REFERENCES sessions_caisse(id),  -- obligatoire si source='caisse'
    justificatif      TEXT,                   -- chemin du scan/photo du reçu
    utilisateur_id    INTEGER NOT NULL REFERENCES utilisateurs(id),
    date_depense      TEXT NOT NULL DEFAULT (date('now','localtime')),
    cree_le           TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ============================================================================
-- 8. INVENTAIRES (régularisation du stock)
-- ============================================================================

CREATE TABLE inventaires (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    numero          TEXT NOT NULL UNIQUE,     -- ex : INV-2026-0001
    type            TEXT NOT NULL DEFAULT 'partiel' CHECK (type IN ('total','partiel')),
    statut          TEXT NOT NULL DEFAULT 'en_cours'
                    CHECK (statut IN ('en_cours','valide','annule')),
    date_debut      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    date_validation TEXT,
    utilisateur_id  INTEGER NOT NULL REFERENCES utilisateurs(id),  -- qui compte
    valide_par_id   INTEGER REFERENCES utilisateurs(id),           -- qui valide (gérant)
    commentaire     TEXT
);

-- L'écart est une colonne GENEREE : impossible qu'il soit incohérent.
-- A la validation, l'application crée un mouvement 'ajustement_inventaire'
-- par ligne dont l'écart est non nul, avec le motif saisi.
CREATE TABLE lignes_inventaire (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    inventaire_id      INTEGER NOT NULL REFERENCES inventaires(id),
    produit_id         INTEGER NOT NULL REFERENCES produits(id),
    lot_id             INTEGER REFERENCES lots(id),
    quantite_theorique REAL NOT NULL,         -- stock calculé au moment du comptage (unités de base)
    quantite_comptee   REAL NOT NULL,         -- total compté converti en unités de base
    detail_comptage    TEXT,                  -- JSON du comptage physique, ex :
                                              -- [{"conditionnement":"Carton de 24","nb":1},
                                              --  {"conditionnement":"Lot de 3","nb":7},
                                              --  {"conditionnement":"Unité","nb":1}]
    ecart              REAL GENERATED ALWAYS AS (quantite_comptee - quantite_theorique) STORED,
    motif_ecart        TEXT CHECK (motif_ecart IN
                       ('casse','vol','erreur_saisie','peremption','don','autre') OR motif_ecart IS NULL)
);

CREATE INDEX idx_lignes_inv ON lignes_inventaire(inventaire_id);

-- ============================================================================
-- 9. PROMOTIONS (phase 4 — la table est prête, l'écran viendra plus tard)
-- ============================================================================

CREATE TABLE promotions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    nom          TEXT NOT NULL,
    type         TEXT NOT NULL CHECK (type IN ('remise_pourcent','remise_montant','prix_fixe')),
    valeur       INTEGER NOT NULL,            -- % ou FCFA selon le type
    produit_id   INTEGER REFERENCES produits(id),     -- cible : un produit…
    categorie_id INTEGER REFERENCES categories(id),   -- …ou toute une catégorie
    date_debut   TEXT NOT NULL,
    date_fin     TEXT NOT NULL,
    actif        INTEGER NOT NULL DEFAULT 1
);

-- ============================================================================
-- 10. VUES — le stock et les soldes, toujours calculés, jamais saisis
-- ============================================================================

-- LE CATALOGUE DE VENTE : la table de correspondance de l'écran de caisse.
-- Un scan (code_barres) ou une frappe (code_plu) → une ligne de cette vue →
-- désignation, prix, quantité de base à décrémenter, coût pour la marge.
CREATE VIEW v_catalogue_vente AS
SELECT
    c.id            AS conditionnement_id,
    c.code_barres,
    c.code_plu,
    p.id            AS produit_id,
    p.nom || CASE WHEN c.quantite_base > 1 THEN ' — ' || c.nom ELSE '' END AS designation,
    c.nom           AS conditionnement,
    c.quantite_base,
    c.prix_vente,
    p.taux_tva,
    p.suivi_peremption,
    p.cout_moyen_pondere * c.quantite_base AS cout_conditionnement
FROM conditionnements c
JOIN produits p ON p.id = c.produit_id
WHERE c.actif = 1 AND p.actif = 1;

-- Stock actuel et valorisation par produit (toujours en unités de base).
CREATE VIEW v_stock_produits AS
SELECT
    p.id,
    p.nom,
    p.unite,
    p.seuil_alerte,
    COALESCE(SUM(m.quantite), 0)                                    AS stock_actuel,
    p.cout_moyen_pondere,
    CAST(ROUND(COALESCE(SUM(m.quantite), 0) * p.cout_moyen_pondere) AS INTEGER) AS valeur_stock
FROM produits p
LEFT JOIN mouvements_stock m ON m.produit_id = p.id
WHERE p.actif = 1
GROUP BY p.id;

-- Produits en alerte (rupture ou sous le seuil).
CREATE VIEW v_alertes_stock AS
SELECT *,
       CASE WHEN stock_actuel <= 0 THEN 'rupture' ELSE 'stock_bas' END AS niveau
FROM v_stock_produits
WHERE stock_actuel <= seuil_alerte;

-- Quantité restante par lot (pour le FEFO et les péremptions).
CREATE VIEW v_stock_lots AS
SELECT
    l.id,
    l.produit_id,
    p.nom AS produit,
    l.numero_lot,
    l.date_peremption,
    l.prix_achat_unitaire,
    COALESCE(SUM(m.quantite), 0) AS quantite_restante
FROM lots l
JOIN produits p ON p.id = l.produit_id
LEFT JOIN mouvements_stock m ON m.lot_id = l.id
GROUP BY l.id;

-- Lots encore en stock avec jours restants avant péremption (négatif = périmé).
CREATE VIEW v_peremptions AS
SELECT *,
       CAST(julianday(date_peremption) - julianday(date('now','localtime')) AS INTEGER) AS jours_restants,
       CAST(ROUND(quantite_restante * prix_achat_unitaire) AS INTEGER) AS valeur_en_jeu
FROM v_stock_lots
WHERE date_peremption IS NOT NULL
  AND quantite_restante > 0;

-- Solde dû par fournisseur = réceptions − règlements.
CREATE VIEW v_dettes_fournisseurs AS
SELECT
    f.id,
    f.nom,
    COALESCE((SELECT SUM(r.total)   FROM receptions r              WHERE r.fournisseur_id = f.id), 0) AS total_achats,
    COALESCE((SELECT SUM(g.montant) FROM reglements_fournisseurs g WHERE g.fournisseur_id = f.id), 0) AS total_regle,
    COALESCE((SELECT SUM(r.total)   FROM receptions r              WHERE r.fournisseur_id = f.id), 0)
  - COALESCE((SELECT SUM(g.montant) FROM reglements_fournisseurs g WHERE g.fournisseur_id = f.id), 0) AS solde_du
FROM fournisseurs f
WHERE f.actif = 1;

-- Restant dû par créance = montant initial − encaissements.
CREATE VIEW v_creances_clients AS
SELECT
    c.id            AS creance_id,
    c.client_id,
    cl.nom          AS client,
    c.vente_id,
    c.montant_initial,
    COALESCE((SELECT SUM(e.montant) FROM encaissements_creances e
              WHERE e.creance_id = c.id), 0) AS total_encaisse,
    c.montant_initial
  - COALESCE((SELECT SUM(e.montant) FROM encaissements_creances e
              WHERE e.creance_id = c.id), 0) AS restant_du,
    c.date_echeance,
    c.statut,
    c.cree_le
FROM creances c
JOIN clients cl ON cl.id = c.client_id;

-- ============================================================================
-- FIN DU SCHEMA
-- ============================================================================
