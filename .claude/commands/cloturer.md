---
description: Fin de session — écrire le carnet de bord pour la prochaine session et pour l'autre développeur
---

Fin de session. Applique la routine « fin de session » de ton brief de passation.

1. Fais le point de ce qui a été fait pendant cette session : fichiers touchés (`git status`,
   `git diff --stat`), tests ajoutés, résultat de `npm run verifier`.
2. Ajoute une entrée **en haut** de `docs/claude/CARNET_DEV_<X>.md`, au format du carnet :
   - **Fait**, **En cours**, **Questions ouvertes**, **Contrats** (livrés, attendus, modifiés, et
     leur impact pour l'autre développeur) ;
   - **Prochaine étape** : assez précise pour que la prochaine session, éventuellement sur une autre
     machine, reprenne sans rien deviner.

   Rédige pour un lecteur qui n'a pas vu cette session.
3. Si le carnet dépasse 10 entrées, déplace les plus anciennes dans
   `docs/claude/archives/CARNET_DEV_<X>_archives.md`.
4. Mets à jour `docs/ETAT_AVANCEMENT.md`. Si une règle ou une décision a été tranchée, mets à jour
   `docs/REGLES_METIER.md` ou `docs/DECISIONS.md`. Si le schéma a changé, mets à jour
   `docs/MODELE_DONNEES.md`.
5. Propose le commit (`docs(carnet): …` ou inclus dans le commit de la tâche) et rappelle de le
   **pousser** : sans push, l'autre machine ne verra pas ce carnet.
