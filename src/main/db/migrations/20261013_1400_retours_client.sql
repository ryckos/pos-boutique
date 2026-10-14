-- ============================================================================
-- Migration 12 — retours client (tâche A7)
-- ============================================================================
-- Un retour client est une vente de type 'retour' (numéro R-AAAA-NNNNNN), liée au ticket d'origine
-- par vente_origine_id, en montants négatifs (REGLES_METIER § 6.8). Le ticket d'origine n'est jamais
-- modifié. On garde sur le retour ce que le ticket imprimé et les rapports doivent pouvoir relire :
-- le motif en clair et le sort du produit.

--
-- Une ligne de retour pointe vers la ligne vendue qu'elle rend (ligne_origine_id) : c'est ce qui
-- permet de refuser de rendre plus que vendu, retours précédents compris, ligne par ligne.
-- Sur une ligne de retour : quantite, prix_unitaire, cout_unitaire et quantite_base_totale restent
-- positifs (copiés de la ligne vendue) ; total_ligne est NÉGATIF (le montant rendu) et remise_ligne
-- porte la part des remises d'origine que le client ne récupère pas (quantite × prix − rendu).

ALTER TABLE ventes ADD COLUMN motif_retour TEXT;
ALTER TABLE ventes ADD COLUMN sort_retour TEXT CHECK (sort_retour IN ('remettre_en_stock','detruire'));
ALTER TABLE lignes_vente ADD COLUMN ligne_origine_id INTEGER REFERENCES lignes_vente(id);

-- Les retours d'un ticket se relisent à chaque nouveau retour.
CREATE INDEX idx_ventes_origine ON ventes(vente_origine_id) WHERE vente_origine_id IS NOT NULL;
CREATE INDEX idx_lignes_vente_origine ON lignes_vente(ligne_origine_id) WHERE ligne_origine_id IS NOT NULL;
