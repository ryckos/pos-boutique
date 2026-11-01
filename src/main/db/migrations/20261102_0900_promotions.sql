-- ============================================================================
-- Migration — promotions programmées (tâche A16)
-- ============================================================================
-- REGLES_METIER § 5.2. La table `promotions` existe depuis le schéma initial : on la complète sans la
-- recréer.
--
-- 1. Une promotion est un PRIX DE VENTE TEMPORAIRE. La ligne de vente garde, comme toujours, le prix
--    réellement payé dans `prix_unitaire` (donc tickets, retours, TVA et marges restent justes sans
--    rien changer à leurs calculs) ; on y ajoute le prix normal et le nom de la promotion, copiés au
--    moment de la vente.
-- 2. Garde-fous sur `promotions` : une promotion vise un produit OU une catégorie (jamais les deux ni
--    aucun) ; elle ne se supprime pas (on l'arrête : actif = 0) ; son historique est celui du journal.

ALTER TABLE lignes_vente ADD COLUMN prix_normal   INTEGER;               -- NULL = aucune promotion
ALTER TABLE lignes_vente ADD COLUMN promotion_id  INTEGER REFERENCES promotions(id);
ALTER TABLE lignes_vente ADD COLUMN promotion_nom TEXT;

CREATE TRIGGER trg_promotions_cible_insert
BEFORE INSERT ON promotions
WHEN (NEW.produit_id IS NULL) = (NEW.categorie_id IS NULL)
BEGIN
    SELECT RAISE(ABORT, 'Une promotion vise un produit ou une catégorie, pas les deux.');
END;

CREATE TRIGGER trg_promotions_cible_update
BEFORE UPDATE ON promotions
WHEN (NEW.produit_id IS NULL) = (NEW.categorie_id IS NULL)
BEGIN
    SELECT RAISE(ABORT, 'Une promotion vise un produit ou une catégorie, pas les deux.');
END;

CREATE TRIGGER trg_promotions_no_delete
BEFORE DELETE ON promotions
BEGIN
    SELECT RAISE(ABORT, 'Une promotion ne se supprime pas : arrêtez-la.');
END;
