## Ce que fait cette PR

<!-- Une ou deux phrases. Référence de la tâche : ex. A1.2, B2.1 -->

Tâche : 

## Vérifications

- [ ] `npm run verifier` passe en local (typecheck + tests)
- [ ] Testé à la main dans l'application (`npm run dev`)
- [ ] Toute logique métier nouvelle a un test dans `tests/`
- [ ] Aucune écriture directe dans `mouvements_stock` (passer par `core/mouvements.ts`)

## Zones partagées touchées

<!-- Cochez et expliquez. Ces changements doivent être relus avec une attention particulière. -->

- [ ] Nouvelle migration SQL (nom : `...`)
- [ ] Contrat IPC modifié (`src/shared/ipc/...`) — l'autre développeur est-il impacté ?
- [ ] `src/main/core/`, `src/shared/types.ts`, `package.json` ou styles communs
- [ ] Aucune zone partagée touchée

## Captures d'écran (si changement visible)
