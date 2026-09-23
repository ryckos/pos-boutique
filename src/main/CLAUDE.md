# Processus principal (Node + SQLite)

Règles pour tout ce qui est sous `src/main/`. Règles métier : `docs/REGLES_METIER.md`.
Tables : `docs/MODELE_DONNEES.md`.

## Structure d'un module
```
modules/<module>/
  service.ts   logique métier : fonctions (db, ...) → valeur. N'importe JAMAIS 'electron'.
  ipc.ts       enregistrerIpc<Module>() : gerer(canal, req => { session.exiger(...); return service(base(), ...) })
```
Enregistrer le module : une ligne dans `ipc/index.ts`. Contrat : `src/shared/ipc/<module>.ts` +
une ligne dans `src/shared/ipc/index.ts`.

## Outils disponibles (ne pas réinventer)
| Besoin                          | Utiliser                                                   |
|---------------------------------|------------------------------------------------------------|
| Lire une ligne / des lignes     | `une<T>(db, sql, ...p)`, `toutes<T>(db, sql, ...p)` (`db/requetes.ts`) |
| Écrire                          | `executer(db, sql, ...p)` → `{ changements, id }`          |
| Tout ou rien                    | `avecTransaction(db, () => { ... })` — **synchrone**, imbricable |
| Variation de stock              | `enregistrerMouvement(db, {...})`, `contrePasser(db, id, motif, userId)` |
| Stock d'un produit              | `stockProduit(db, produitId)` ou les vues `v_stock_*`      |
| Numéro de document              | `prochainNumero(db, 'T')` (préfixes : `REGLES_METIER.md` §6.11) |
| Action sensible                 | `journaliser(db, { utilisateurId, action, entite, entiteId, avant, apres })` |
| Utilisateur et droits           | `session.exiger(['gerant'])` (admin toujours autorisé)     |
| Message pour l'utilisateur      | `throw new ErreurMetier('…')`                              |
| PIN                             | `hacherPin`, `verifierPin` (`core/securite.ts`)            |

## Règles SQL
- Toujours des paramètres `?`. Jamais de concaténation de valeurs dans une requête.
- Renommer en camelCase dans le SELECT : `quantite_base AS quantiteBase`.
- Les booléens SQLite sont 0/1 : convertir en `boolean` dans le service (voir `versArticle`).
- Lecture du stock et des soldes par les **vues** ; ne pas recopier leur logique.

## Migrations (`db/migrations/`)
- Nouveau fichier `AAAAMMJJ_HHMM_sujet.sql` (heure réelle de création). Commande : `/migration`.
- Ne JAMAIS modifier un fichier existant. Ne jamais supprimer une colonne portant de l'historique.
- Pas de `PRAGMA`. Commentaires en tête expliquant le pourquoi.
- Mettre à jour `docs/MODELE_DONNEES.md` et, si utile, `db/seed.ts`.
- Modifier un `CHECK` existant en SQLite impose de recréer la table : en parler aux deux développeurs.

## Transactions et effets de bord
Dans `avecTransaction` : uniquement des lectures et des écritures en base. L'impression, l'ouverture
du tiroir, l'accès aux fichiers et le réseau se font **après** le retour de la transaction.

## Données de démo (`db/seed.ts`)
Elles sont créées seulement en développement, sur une base vide. Ajouter des données utiles à un
écran est bienvenu : c'est une zone partagée, par petite PR.
