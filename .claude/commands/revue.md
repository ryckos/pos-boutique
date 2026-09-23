---
description: Relire la PR ou la branche de l'autre développeur
argument-hint: <nom de la branche, ex. b/produits-conditionnements>
---

Relis la branche **$ARGUMENTS** comme le ferait l'autre développeur, avant fusion.

1. Récupère le diff : `git fetch` puis `git diff origin/test...origin/$ARGUMENTS`.
2. Vérifie les mêmes règles que la commande `/verifier`, point 2, et ajoute :
   - la conformité aux règles métier (`docs/REGLES_METIER.md`) et aux chiffres du scénario de
     référence ;
   - la conformité de l'écran à `docs/UI_UX.md` ;
   - les contrats IPC modifiés : impact sur **mon** code (le développeur courant) ; ce que je devrai
     adapter ;
   - la qualité des tests : cas nominaux **et** refus.
3. Rends la revue en trois parties :
   - **bloquant** : ce qui doit être corrigé avant fusion ;
   - **à améliorer** : ce qui peut attendre ;
   - **impact pour moi** : ce que cette fusion change dans mon travail.
