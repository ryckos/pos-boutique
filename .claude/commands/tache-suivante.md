---
description: Quelle est la prochaine tâche à démarrer, et est-elle démarrable ?
---

Détermine la **prochaine tâche à démarrer** pour le développeur courant (brief chargé, sinon
préfixe de branche `a/…` ou `b/…`, sinon demande).

1. Vérifie d'abord qu'aucune tâche n'est déjà 🔄 pour ce développeur dans
   `docs/ETAT_AVANCEMENT.md`. Si c'est le cas, dis-le : on termine avant d'ouvrir autre chose.
2. Sinon, prends la première tâche ⏳ de ce développeur dans l'ordre de sa fiche
   (`docs/DEV_A_COMPTOIR.md` ou `docs/DEV_B_BACKOFFICE.md`).
3. Contrôle qu'elle est **démarrable** :
   - ses dépendances (tableau des rendez-vous de l'état d'avancement) sont-elles livrées ?
   - si non, dit clairement ce qui manque, qui doit le livrer, et **propose soit une valeur
     provisoire** pour avancer quand même, **soit la tâche suivante** qui, elle, est démarrable ;
   - une décision en attente (`docs/DECISIONS.md`) bloque-t-elle cette tâche ?
4. Si ce développeur doit un contrat à l'autre dont l'échéance approche ou est dépassée, **cette
   livraison passe avant** : dis-le et propose-la en priorité.

Rends une réponse courte :

- la tâche proposée, son intitulé, l'objectif en une phrase ;
- pourquoi elle vient maintenant ;
- ce qu'elle exige et ce qui manque éventuellement ;
- la commande de création de branche depuis `test` à jour ;
- la commande à taper ensuite : `/tache <id>`.

N'écris aucun fichier et ne commence pas à coder.
