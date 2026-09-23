# Interface (React)

Règles pour tout ce qui est sous `src/renderer/`. **Lire `docs/UI_UX.md` avant de créer ou modifier
un écran** : il décrit les maquettes validées écran par écran.

## Structure
```
src/renderer/src/
  app/       coque, menu (routes.tsx : une ligne par module), contexte utilisateur
  lib/       api.ts (appel typé), useScanner.ts (douchette)
  ui/        styles.css — jetons et classes, SEULE source de styles
  modules/<module>/  routes.tsx + Page<Nom>.tsx + logique pure testable (ex. panier.ts)
```

## Appeler le processus principal
```ts
import { appel } from '@renderer/lib/api'
const article = await appel('catalogue:rechercherCode', { code })   // typé par le contrat
```
- Un échec lève une `Error` dont le message est déjà rédigé pour l'utilisateur : on l'affiche tel
  quel, dans un `.alerte` avec `role="alert"`.
- Ne jamais envoyer de prix de référence, de coût ou d'identifiant d'utilisateur : le principal
  relit tout.

## Douchette
`useScanner(code => …)` écoute toute la fenêtre. Elle est ignorée dans les champs de saisie, sauf
dans un champ qui porte `data-scan`. Sur l'écran de caisse, elle doit rester active en permanence.

## Styles
- Classes de `ui/styles.css` uniquement. **Aucune couleur en dur**, aucun style en ligne sauf une
  dimension ponctuelle. Pour un nouveau besoin, ajouter un jeton ou une classe par une PR de zone
  partagée.
- Montants : `formaterFCFA(n)` dans un élément `.montant`. Quantités : `formaterQuantite(q)`.
- Cibles tactiles de 48 px ou plus, focus visible, pas d'animation décorative.

## Textes
En français, en minuscules de phrase. Les boutons portent un verbe qui dit l'action (« Valider la
réception »). Les erreurs disent quoi et comment corriger. Les états vides invitent à agir. Voir
`docs/UI_UX.md` § 4.

## Nouvel écran
1. `modules/<module>/Page<Nom>.tsx`
2. `modules/<module>/routes.tsx` avec les rôles autorisés (matrice : `docs/PROJET.md`)
3. Une ligne dans `app/routes.tsx`. Un écran inachevé peut être fusionné **sans** cette ligne.
4. Logique non triviale (calculs de panier, conversions) : dans un fichier `.ts` pur, testé.
