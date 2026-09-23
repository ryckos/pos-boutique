# Carnet de bord — Claude Code de Dev B

Mémoire de session à session. **Nouvelle entrée en haut** à chaque fin de session (commande
`/cloturer`), lue à chaque début de session (commande `/reprendre`). L'autre Claude Code lit la
dernière entrée de ce carnet pour savoir ce que fait Dev B : écrire clairement, sans jargon interne
à la session.

Format d'une entrée :

```
## AAAA-MM-JJ — <branche> — <tâche>
**Fait** : …
**En cours** : … (fichiers, état exact)
**Prochaine étape** : … (assez précise pour reprendre sans rien relire d'autre)
**Questions ouvertes** : … (pour Dev B, pour l'autre développeur, pour la cliente)
**Contrats** : livrés / attendus / modifiés (impact pour l'autre développeur)
```

---

## 2026-09-23 (suite) — b/categories — B2.1 Catégories
**Fait** :
- B1 fusionnée (PR #4), passée à ✅ ; branche supprimée.
- Règles validées par Dev B et écrites (`REGLES_METIER.md` § 2.5) : rayons et sous-rayons, **un seul
  niveau** ; nom unique parmi les actives du même niveau (casse et espaces ignorés) ; désactivation
  seulement d'une catégorie vide (ni produit ni sous-rayon actif) ; gérant ; pas de journal.
- `catalogue/categories.ts` + canaux `catalogue:categories` (tous), `creerCategorie`,
  `renommerCategorie`, `desactiverCategorie` (gérant). Aucune migration.
- Écran « Catégories » (gérant). Composant commun `ui/Panneau.tsx` (sorti de l'écran des comptes).
- 111 tests verts (15 nouveaux), build OK, testé à la main par Dev B.

**En cours** : PR B2.1 vers `test`, en relecture par Dev A.

**Prochaine étape** : après fusion, B2.1 ✅ et contrat « catégorie » ✅ ; puis **B2.2 Produits et
conditionnements** (`/tache B2.2`, branche `b/produits`) — livrer **`catalogue:conditionnementsProduit`
tôt** (fin S4, attendu par A1.2 sous la forme `{ requete: { produitId }; reponse: ArticleCatalogue[] }`,
unité en premier). La fiche produit permettra aussi de déplacer un produit d'une catégorie à l'autre
(aujourd'hui impossible dans l'application).

**Questions ouvertes** : `xlsx` (B3) toujours à valider ; réactivation (comptes, catégories) non prévue.

**Contrats** : **livré pour Dev A** — `ArticleCatalogue.categorie` = nom du **rayon** (catégorie de
premier niveau, même si le produit est dans un sous-rayon), `null` si non classé ; renseigné par
`rechercherCode`, `rechercher` et `grille`. Déclaré **optionnel** (`categorie?: string | null`) pour ne
pas casser les objets `ArticleCatalogue` écrits en dur dans `panier.test.ts` et `attente.test.ts` ; le
service le remplit toujours. Onglets par ordre alphabétique ; pas de champ d'ordre (pas demandé
fermement, demanderait une migration). Nouveau canal `catalogue:categories` si besoin de la liste.

---

## 2026-09-23 — b/utilisateurs-roles — B1 Utilisateurs, rôles et sécurité
**Fait** :
- **Décision D-17, validée par le chef de projet** : connexion en deux gestes (toucher son nom,
  puis taper son code). Les codes ne sont plus uniques ; le verrouillage (5 codes faux → 30 s,
  1, 2, 5, puis 15 min) se fait **compte par compte** ; tout code donné par l'admin est
  **provisoire** et la personne choisit le sien avant d'ouvrir une session. Raison : l'admin
  connaissait les codes de tous, et « code déjà utilisé » révélait qu'un code ouvrait un compte.
- Migration `20260923_1157_securite_connexion.sql` : colonnes `pin_provisoire`,
  `echecs_consecutifs`, `verrouillages`, `verrouille_jusqu_a` sur `utilisateurs`.
- Module `utilisateurs` (admin) : lister, créer, réinitialiser le code, changer le rôle,
  désactiver avec motif ; garde-fous (dernier admin, pas soi-même) ; tout est journalisé.
- Écrans : connexion par nom + pavé (compte à rebours si verrouillé, choix du code si provisoire),
  « Comptes utilisateurs » (admin), « Mon code » (tout le monde), assistant de premier démarrage.
- `POS_SIMULER_PROD=1` (avec `POS_DB`) : se comporter comme l'application installée, pour tester
  l'assistant en développement.
- 64 tests verts, build OK, scénario complet testé à la main par Dev B.

**Revue des droits (rendez-vous fin S3)** :
- Canaux de Dev B conformes à la matrice. Corrigé : `catalogue:produitsStock` (valeur du stock au
  CUMP) est désormais réservé au gérant, comme son écran.
- **Pour Dev A** : `materiel:imprimantes` et `materiel:ouvrirEcranClient` n'appellent pas
  `session.exiger()` — à ajouter (au moins `exiger()`, gérant pour la liste des imprimantes si elle
  ne sert qu'aux réglages). `systeme:infos` sans session est normal (utilisé avant connexion).

**En cours** : PR B1 vers `test`, en attente de relecture par Dev A.

**Prochaine étape** : après fusion, passer B1 à ✅ et le contrat « contrôle des rôles » à ✅ dans
`ETAT_AVANCEMENT.md` ; puis **B2.1 Catégories** (`/tache B2.1`, branche `b/categories`) et, sans
tarder, **B2.2** pour livrer `catalogue:conditionnementsProduit` à Dev A (fin S4).

**Questions ouvertes** :
- Réactivation d'un compte désactivé : non prévue pour l'instant (à confirmer avec la cliente).
- `xlsx` pour l'import (B3) : toujours à valider.
- Pour Dev A : A1.1 est fusionnée mais encore 🔄 dans `ETAT_AVANCEMENT.md`.

**Contrats** : modifiés — `auth:connexion` prend désormais `{ utilisateurId, pin }` et renvoie
`{ utilisateur } | { codeProvisoire: true }` (utilisé seulement par l'écran de connexion de Dev B).
Ajoutés — `auth:comptesConnexion`, `auth:definirCodePersonnel`, `auth:changerMonCode`,
`auth:etatVerrouillage`, `auth:etatDemarrage`, `auth:creerPremierAdmin`, `utilisateurs:*` (admin).
**Aucun impact sur le code de Dev A** ; seule la connexion de la caissière change (deux gestes).

---

## 2026-09-22 — main — Passation initiale
**Fait** : conception complète (voir `docs/claude/BRIEF_DEV_B.md` § 3), socle initialisé et
vérifié (typecheck, 17 tests, build), documentation et briefs en place.
**En cours** : rien.
**Prochaine étape** : Démarrer **B1 — Utilisateurs, rôles et sécurité** (`/tache B1`). Branche proposée : `b/utilisateurs-roles`.
**Questions ouvertes** :
- Ajout de la dépendance `xlsx` pour l'import (B3) : à faire valider par l'équipe.
- Rendez-vous serrés : `catalogue:conditionnementsProduit` fin S4, `parametres:lire` fin S5.
- Politique de stock négatif (D-A1) : en attente de la cliente, ne jamais bloquer une vente d'ici là.
**Contrats** : attendus — `sessionOuverte()` et `enregistrerMouvementCaisse()` (Dev A, fin S10).
