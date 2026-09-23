-- ============================================================================
-- Migration 3 — sécurité de la connexion (tâche B1, décision D-17)
-- ============================================================================
-- Connexion en deux gestes : toucher son nom, puis taper son code. Les codes ne sont
-- donc plus uniques, et le verrouillage après 5 codes faux se fait compte par compte.
-- Ces colonnes décrivent l'état courant du compte (comme `actif`), pas de l'historique :
-- les changements de code et les verrouillages sont tracés dans journal_audit.

-- 1 = code fixé par l'administrateur (création ou réinitialisation) : la personne doit
-- choisir son propre code à sa prochaine connexion, avant tout accès.
ALTER TABLE utilisateurs ADD COLUMN pin_provisoire     INTEGER NOT NULL DEFAULT 0;
-- Codes faux depuis le dernier succès ou le dernier verrouillage.
ALTER TABLE utilisateurs ADD COLUMN echecs_consecutifs INTEGER NOT NULL DEFAULT 0;
-- Verrouillages depuis le dernier succès : sert au délai croissant.
ALTER TABLE utilisateurs ADD COLUMN verrouillages      INTEGER NOT NULL DEFAULT 0;
-- Fin du verrouillage en millisecondes depuis 1970 (0 = pas verrouillé).
ALTER TABLE utilisateurs ADD COLUMN verrouille_jusqu_a INTEGER NOT NULL DEFAULT 0;
