---
description: Créer le squelette d'un nouveau module (principal + contrat + écran + test)
argument-hint: <nom du module, ex. achats>
---

Crée le squelette du module **$ARGUMENTS** en suivant la recette du README (section 3).

1. Vérifie dans `.github/CODEOWNERS` et dans les fiches développeurs à qui appartient ce module. Si
   ce n'est pas le développeur courant, arrête-toi et signale-le.
2. Crée :
   - `src/shared/ipc/$ARGUMENTS.ts` : interface `Contrat…`, vide ou avec les premiers canaux ;
   - la ligne d'assemblage dans `src/shared/ipc/index.ts` ;
   - `src/main/modules/$ARGUMENTS/service.ts`, sans import d'electron ;
   - `src/main/modules/$ARGUMENTS/ipc.ts`, avec `enregistrerIpc…()` ;
   - la ligne dans `src/main/ipc/index.ts`, dans la section du bon développeur ;
   - `src/renderer/src/modules/$ARGUMENTS/routes.tsx` et une première page. **N'ajoute pas** la
     ligne dans `app/routes.tsx` : l'écran reste caché tant qu'il n'est pas terminé ;
   - `tests/$ARGUMENTS.test.ts`, avec un premier test.
3. Lance `npm run verifier`.
4. Résume les fichiers de zone partagée touchés (une ligne chacun), à annoncer à l'autre
   développeur.
