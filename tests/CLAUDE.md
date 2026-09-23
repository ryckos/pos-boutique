# Tests

- Vitest, en environnement Node. Commande : `npm test`, ou `npm run verifier` avant tout commit.
- Chaque test crée **sa propre** base en mémoire : `baseDeTest()` pour une base vierge migrée,
  `baseAvecDemo()` pour une base avec comptes, catalogue et stock (voir `aide.ts`).
- On teste les **services** (`src/main/modules/*/service.ts`) et le **noyau** (`src/main/core/`),
  ainsi que la logique pure de l'interface (ex. `modules/caisse/panier.ts`). On ne teste pas
  directement l'IPC ni Electron.
- Utiliser en priorité les chiffres de `docs/SCENARIO_REFERENCE.md` : ce sont les résultats
  attendus par la cliente (ex. CUMP 262,8 ; Z à 58 700 ; carton = −24 boîtes).
- Tester aussi les refus : les droits, les montants incohérents, les sens de mouvement, le rollback
  d'une transaction.
- Un fichier par module : `tests/<module>.test.ts`. Les noms de tests sont en français et
  décrivent la règle.

Données de démo utiles :

| Donnée     | Détail                                                        |
|------------|---------------------------------------------------------------|
| Tomate     | produit 3, 72 boîtes, CUMP 250                                 |
| Codes      | unité `6181000000042`, lot `2000000000015`, carton `16181000000049` |
| Baguette   | PLU `101`, TVA 0                                               |
| Lait       | périssable, lot DEMO-01                                        |
| Comptes    | 1 Patron (admin), 2 Afi (caissière), 3 Kossi (gérant)          |
