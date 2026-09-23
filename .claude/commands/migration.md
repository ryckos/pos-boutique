---
description: Créer une nouvelle migration SQL conforme aux règles
argument-hint: <sujet de la migration>
---

Crée une migration pour : **$ARGUMENTS**.

1. Lis `src/main/CLAUDE.md` (section migrations), `docs/MODELE_DONNEES.md` et les migrations
   existantes, pour connaître l'état actuel du schéma.
2. Crée `src/main/db/migrations/AAAAMMJJ_HHMM_<sujet_en_snake_case>.sql`, avec la date et l'heure
   actuelles, **postérieures** à la dernière migration existante.
3. En tête, un commentaire explique le pourquoi et la tâche concernée. Pas de `PRAGMA`. Ne modifie
   aucun fichier existant.
4. Si la migration touche un `CHECK` existant, ou supprime ou renomme une colonne, **arrête-toi et
   explique-moi** les conséquences : cela impose de recréer la table et doit être validé par les deux
   développeurs.
5. Mets à jour `docs/MODELE_DONNEES.md` : tables concernées et tableau des migrations.
6. Lance `npm test` : `tests/migrations.test.ts` vérifie que tout s'applique sur une base vierge.
