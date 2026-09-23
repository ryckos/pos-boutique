---
description: Ce qui est terminé sur le projet, et ce qui est donc testable
---

Liste ce qui est **terminé**, c'est-à-dire fusionné dans `test`.

Sources : `docs/ETAT_AVANCEMENT.md` (lignes ✅ et le journal des fusions),
`git log --oneline origin/test -30`, et `git log --oneline origin/main -10` pour distinguer ce qui
est déjà passé en version validée.

Présente :

1. **Terminé et fusionné dans `test`** — tableau par phase : tâche · intitulé · dev · date.
2. **Déjà dans `main`** (version validée, installable chez la cliente) — même tableau, plus le tag
   de version s'il existe.
3. **Ce que vous pouvez tester dès maintenant** — pour les fonctionnalités terminées, dis en une
   ligne chacune **ce qui est visible dans l'application** et **comment y accéder** (écran, menu,
   compte de démo, code-barres à scanner). C'est la partie la plus utile : elle doit permettre de
   lancer `npm run dev` et d'essayer sans rien chercher.
4. **Attention** — les tâches marquées ✅ dont la PR n'apparaît pas dans l'historique de `test`, ou
   l'inverse : signale l'incohérence.

Ne compte jamais comme terminée une tâche simplement parce que du code existe sur une branche :
seule la fusion dans `test` compte. N'écris aucun fichier.
