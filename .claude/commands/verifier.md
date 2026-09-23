---
description: Contrôle complet avant de proposer une PR
---

Prépare ma branche pour une Pull Request.

1. Lance `npm run verifier` et corrige les erreurs jusqu'au vert, en m'expliquant chaque correction.
2. Examine `git diff origin/test...HEAD` (après `git fetch`) et vérifie ces règles, en listant chaque manquement trouvé :
   - aucun `INSERT INTO mouvements_stock` hors de `src/main/core/mouvements.ts` ;
   - aucune migration existante modifiée ; une nouvelle migration est nommée
     `AAAAMMJJ_HHMM_…` et `docs/MODELE_DONNEES.md` est à jour ;
   - aucun montant flottant, et aucun prix ou identifiant d'utilisateur venant de l'interface ;
   - aucune impression ni aucun `await` dans une transaction ;
   - chaque canal nouveau appelle `session.exiger()` avec les rôles de la matrice
     (`docs/PROJET.md`) ;
   - chaque action sensible est journalisée ;
   - aucun service n'importe `electron` ;
   - aucune couleur en dur, et tous les textes sont en français selon `docs/UI_UX.md` ;
   - la logique métier nouvelle a ses tests ;
   - aucun fichier du périmètre de l'autre développeur n'est touché, sinon le signaler ;
   - aucune dépendance npm ajoutée sans accord.
3. Mets à jour `docs/ETAT_AVANCEMENT.md` : statut de la tâche, et une ligne au journal des fusions
   si c'est notable.
4. Rédige :
   - le message de commit conventionnel ;
   - le texte de la PR **vers `test`** selon `.github/pull_request_template.md`, en cochant
     honnêtement les cases et en signalant les zones partagées touchées et l'impact pour l'autre
     développeur.
5. Rappelle la suite : commit, `git push`, puis — **si et seulement si la tâche est terminée** —
   ouverture de la PR vers `test`. Si la tâche continue demain, pas de PR : on pousse seulement.
