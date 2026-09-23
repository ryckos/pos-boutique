---
description: Démarrer une tâche du planning (ex. /tache A1.1)
argument-hint: <identifiant de tâche, ex. A2 ou B2.2>
---

Je démarre la tâche **$ARGUMENTS**.

1. Détermine si je suis Dev A ou Dev B (préfixe de la branche git courante, ou déduis-le de
   l'identifiant de tâche : A… = Dev A, B… = Dev B).
2. Lis dans l'ordre :
   - la section de la tâche $ARGUMENTS dans `docs/DEV_A_COMPTOIR.md` ou `docs/DEV_B_BACKOFFICE.md` ;
   - `docs/ETAT_AVANCEMENT.md` (ce qui existe déjà, ce qui bloque) ;
   - les sections concernées de `docs/REGLES_METIER.md` ;
   - l'écran concerné dans `docs/UI_UX.md` ;
   - les exemples chiffrés liés dans `docs/SCENARIO_REFERENCE.md` ;
   - le code existant que la tâche va toucher ou consommer.
3. Vérifie les dépendances : si la tâche consomme un contrat de l'autre développeur qui n'existe
   pas encore, dis-le et propose une valeur par défaut provisoire.
4. Si la branche courante n'est pas une branche de tâche (`a/…` ou `b/…`) correspondant à cette
   tâche, propose le nom et la commande de création **depuis `test` à jour** :
   `git switch test && git pull && git switch -c a/<sujet>`. Ne crée jamais une branche de tâche
   depuis `main` ni depuis une branche personnelle.
5. Présente un **plan court**, puis **attends mon accord avant d'écrire du code**. Le plan contient :
   - les canaux IPC à déclarer (requête et réponse) ;
   - la migration éventuelle ;
   - les fonctions de service ;
   - la liste des tests, avec leurs chiffres attendus ;
   - les écrans et composants ;
   - les fichiers de zone partagée touchés ;
   - un découpage en PR d'un jour au plus.

Signale toute décision en attente (`docs/DECISIONS.md`) ou toute règle absente que la tâche exige.
