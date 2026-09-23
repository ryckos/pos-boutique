---
description: Quelle tâche est en cours, chez qui, et où elle en est
---

Dis **ce qui est en cours maintenant**, des deux côtés.

Sources : `docs/ETAT_AVANCEMENT.md` (lignes 🔄), la dernière entrée de chaque carnet
(`docs/claude/CARNET_DEV_A.md`, `CARNET_DEV_B.md`), `git branch -r`, `git log --oneline -10` de la
branche courante, et `git status` si on est sur une branche de tâche.

Pour **chaque tâche en cours** (une section par développeur) :

- l'identifiant et l'intitulé de la tâche, et le développeur ;
- la branche, et depuis combien de jours elle existe (⚠ au-delà de 2 jours) ;
- ce qui est déjà fait, ce qui reste — d'après le carnet, pas d'après une supposition ;
- la **prochaine étape précise** annoncée dans le carnet ;
- les blocages, questions ouvertes, contrats attendus ;
- si on est sur la branche de cette tâche : l'état du dossier de travail (fichiers modifiés,
  commits non poussés) et si `npm run verifier` a été passé lors de la dernière session.

Termine par **une phrase** : la toute prochaine action à faire.

Si aucune tâche n'est 🔄, dis-le et enchaîne sur ce que propose `/tache-suivante`.
N'écris aucun fichier.
