---
description: Plan complet du projet — fait, en cours, à faire, par développeur, avec les blocages
---

Dresse le **plan complet du projet**, pour un lecteur qui pilote sans coder.

Sources, dans cet ordre : `docs/ETAT_AVANCEMENT.md` (source unique), les carnets
`docs/claude/CARNET_DEV_A.md` et `CARNET_DEV_B.md` (3 dernières entrées de chacun),
`git log --oneline origin/test -20` et `git branch -r`, et `docs/DECISIONS.md` pour les décisions
en attente. Si l'état d'avancement contredit l'historique git (tâche marquée ⏳ alors qu'elle est
fusionnée dans `test`, ou l'inverse), **signale-le explicitement** plutôt que de choisir.

Présente, dans cet ordre :

1. **Où en est le projet** — phase en cours, semaine du planning, nombre de tâches terminées sur le
   total, en une ou deux phrases.
2. **Terminé** ✅ — tableau : tâche · intitulé · dev · date de fusion dans `test` si connue.
   Regroupe par phase. Si la liste dépasse 15 lignes, ne détaille que la phase en cours et résume
   les précédentes en une ligne chacune.
3. **En cours** 🔄 — tableau : tâche · intitulé · dev · branche · depuis quand · prochaine étape
   (issue du carnet). Signale toute branche de plus de 2 jours.
4. **À faire** ⏳ — par phase et par développeur, dans l'ordre prévu. Marque d'un ⛔ toute tâche
   bloquée et indique par quel contrat.
5. **Rendez-vous entre développeurs** — reprends le tableau des contrats de l'état d'avancement :
   qui livre quoi, à qui, pour quand, statut. Mets en évidence :
   - les contrats **en retard** (échéance dépassée au vu de la semaine en cours) ;
   - les tâches **bloquées en attente** d'un contrat, avec le nom du développeur à relancer.
6. **Décisions en attente** — celles de `docs/DECISIONS.md` qui bloquent ou vont bloquer une tâche,
   avec qui doit trancher (la cliente, ou les développeurs).
7. **Ce qui mérite votre attention** — 3 points maximum : retards, blocages, risques de la semaine.

Réponds en français, en tableaux lisibles, sans jargon technique inutile. N'écris aucun fichier :
cette commande ne fait que rendre compte.
