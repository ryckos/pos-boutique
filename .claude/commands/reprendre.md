---
description: Début de session — reprendre exactement là où on s'est arrêté
---

Début de session. Applique la routine « début de session » de ton brief de passation.

1. Identifie le développeur : brief chargé par `CLAUDE.local.md`, sinon préfixe de la branche
   (`a/` → Dev A, `b/` → Dev B), sinon demande. Si ton brief n'est pas déjà chargé, lis
   **entièrement** `docs/claude/BRIEF_DEV_<X>.md`.
2. `git status`, `git branch --show-current`, `git log --oneline -15`. Si la branche a plus de
   2 jours ou est en retard sur `test`, propose `git fetch` puis `git rebase origin/test`.
   Si la branche courante est `test`, `main` ou ne suit pas la convention (`a/…`, `b/…`), signale-le
   et propose de créer la bonne branche **depuis `test` à jour**.
3. Lis les **3 dernières entrées** de ton carnet `docs/claude/CARNET_DEV_<X>.md` et la **dernière
   entrée** du carnet de l'autre développeur.
4. Lis `docs/ETAT_AVANCEMENT.md` et la section « en attente » de `docs/DECISIONS.md`.
5. Vérifie si un contrat attendu de l'autre développeur est arrivé dans `test` depuis la dernière
   session (tableau des rendez-vous de ton brief).
6. Présente en **5 lignes maximum** :
   - où on en est ;
   - ce qui a changé chez l'autre et qui nous concerne ;
   - les rendez-vous proches (à livrer ou à recevoir) ;
   - les décisions en attente qui bloquent ;
   - **la prochaine étape proposée**.

   Puis attends la réponse du développeur.
