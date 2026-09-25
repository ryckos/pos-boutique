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

## 2026-09-25 — b/parametres-ecran — B2.3 (fusionnée) et B5 Paramètres
**Fait** :
- **B2.3 fusionnée** (PR #16) : recherche sans accents ni casse (fonction SQL `sans_accents`
  enregistrée sur la connexion ; F2 de la caisse en profite sans changement de contrat), création
  d'un produit depuis un code scanné sur l'écran Produits. Le fichier temporaire
  `electron.vite.config.<nombre>.mjs` signalé par Dev A est retiré et ignoré (`.gitignore`).
- **B5 partie 1 fusionnée** (PR #17) : `parametres:lire` livré à Dev A (rendez-vous fin S5 tenu).
- **Règle validée par Dev B** (écrite dans `REGLES_METIER.md` § 13) : lecture des paramètres par
  tous les rôles ; écriture par l'admin, **le gérant pouvant aussi modifier les trois clés
  `imprimante_*`** (écran « Réglages matériel » d'A3) ; chaque clé réellement changée est
  journalisée (`modification_parametre`, avant/après).
- **B5 partie 2** terminée, testée à la main par Dev B, poussée sur `b/parametres-ecran` (rebasée
  sur `test` après #17) : `parametres:ecrire` (tout ou rien, valeurs revérifiées, `null` = retour au
  défaut), écran « Paramètres » admin (blocs Boutique et ticket / Stock / Caisse, fenêtres
  modales, `UI_UX.md` § 5.13), TVA par défaut proposée dans la fiche d'un nouveau produit.
- 194 tests verts (25 nouveaux sur B5), build OK. Aucune migration.
- Les PR #16 et #17 ont été fusionnées par commit de fusion (pas en squash) : sans conséquence,
  mais une branche empilée se rebase alors par un simple `git rebase test`.

**En cours** : PR B5 partie 2 (`b/parametres-ecran` → `test`) à ouvrir ou en relecture par Dev A.

**Prochaine étape** :
1. Après fusion de la partie 2 : B5 → ✅ dans `ETAT_AVANCEMENT.md` (ligne B5 et journal des
   fusions), supprimer `b/parametres-ecran` ; supprimer aussi sur GitHub les branches déjà
   fusionnées `b/recherche-scan` et `b/parametres` si ce n'est pas fait.
2. Tâche suivante dans l'ordre du brief : **B3 Import Excel**, toujours bloquée par l'accord sur la
   dépendance `xlsx` → la demander d'abord à Dev B. Sinon enchaîner **B4 Écran stock et
   historique produit** (`/tache B4`, branche `b/stock` depuis `test` à jour), puis **B6 Stock
   initial** (rendez-vous fin S7 pour la recette de Dev A).

**Questions ouvertes** :
- `xlsx` pour B3 : toujours à valider (bloque B3).
- Plafond de remise caissier (D-A3) : toujours en attente de la cliente ; `plafondRemiseCaissier`
  vaut `null` et l'admin pourra le saisir dans « Paramètres » dès la décision prise.
- Réactivation (produit, compte, catégorie) : non prévue (cliente). Photo des produits : reportée.

**Contrats** :
- **Livré à Dev A** (PR #17) : `parametres:lire`, sans requête → `ParametresBoutique` : objet typé,
  défauts appliqués (`ticketPied` « Merci de votre visite ! », `tvaDefaut` 18,
  `peremptionSeuilJours` 15, `dormantJours` 60, `imprimanteMethode` 'spooler'), `null` si non
  renseigné (`boutiqueNom`, `boutiqueAdresse`, `boutiqueNif`, `imprimanteCible`,
  `plafondRemiseCaissier`, `imprimantePageCodes`). Tous les rôles connectés. **Pour le ticket
  imprimé dans le principal, appeler directement `lireParametres(db)`** de
  `modules/parametres/service.ts`, sans IPC. Débloque l'en-tête et le pied du ticket d'A3.
- **En relecture** : `parametres:ecrire`, `Partial<ParametresBoutique>` → `ParametresBoutique`.
  **Pour Dev A** : le gérant peut enregistrer `imprimanteMethode`, `imprimanteCible`,
  `imprimantePageCodes` par ce canal → les réglages matériel d'A3 peuvent aller en base au lieu
  d'un fichier local ; la page de codes gagnante (D-A2) aussi. Tout autre champ envoyé par un
  gérant fait refuser l'ensemble.
- Attendus inchangés : `sessionOuverte()` / `enregistrerMouvementCaisse()` (Dev A, fin S10).

---

## 2026-09-24 — b/produits (fusionnée) — B2.2 Produits et conditionnements
**Fait** :
- **B2.2 terminée et fusionnée** (PR #10 partie 1, PR #12 le reste) ; branche supprimée.
- **Règles validées par Dev B** et écrites dans `REGLES_METIER.md` § 1.4, 2.2, 2.3 : conditionnement de
  base toujours nommé « Unité » ; quantité d'un conditionnement existant **non modifiable** (on le
  désactive et on en crée un autre) ; codes-barres 8 à 14 chiffres, PLU 1 à 5 chiffres, uniques
  **toutes colonnes confondues** (désactivés compris) ; codes internes à la suite (`2000000000015`,
  `…022`…) en sautant les pris ; désactivation d'un produit avec motif, journalisée
  (`desactivation_produit`, motif + stock restant), autorisée même avec du stock ; **photo reportée**.
- **Décision d'interface de Dev B, pour tout le projet** (`UI_UX.md` § 3 et 5.12) : toute création,
  modification ou désactivation s'ouvre dans une **fenêtre modale** (`ui/FenetreFormulaire.tsx`, qui
  remplace `ui/Panneau.tsx` ; PR #11). Le refus s'affiche dans la fenêtre, la saisie est gardée ;
  Échap ferme, un toucher à côté non. Écrans Comptes et Catégories convertis.
- Service `catalogue/produits.ts` (créer, modifier, désactiver, générer un code, liste, fiche) ;
  règles pures partagées `src/shared/catalogue.ts` (clé EAN-13, garde-fou prix) ; logique d'écran
  pure `modules/catalogue/saisieProduit.ts`.
- Écrans : « Produits » (recherche sans accents, filtre par rayon) et fiche produit en fenêtre large ;
  l'ancienne page « Produits et stock » s'appelle « Stock » (`/stock`, à compléter en B4).
- 140 tests verts (29 nouveaux), build OK, scénario complet testé à la main par Dev B.
- Leçon : la case « Bouton caisse », d'abord une case seule de 24 px, ratait les touchers ; remplacée
  par une étiquette « En bouton » de 48 px (`.case-cellule`). **Toute case à cocher dans un tableau
  doit être une étiquette de 48 px.**

**En cours** : rien. Branche `b/recherche-scan` créée depuis `test` à jour, avec ce carnet seulement.

**Prochaine étape** : **B2.3** (`/tache B2.3`) sur `b/recherche-scan` :
1. Recherche insensible aux accents et à la casse côté principal (`rechercherTexte` dans
   `catalogue/service.ts`, TODO en place ; utilisé par la F2 de Dev A). Piste : colonne normalisée
   remplie par le service (demande une migration) ou fonction SQL enregistrée sur la connexion.
   L'écran Produits filtre déjà sans accents, mais en local (`normaliser` dans `PageProduits.tsx`).
2. Création d'un produit pré-remplie depuis un code inconnu scanné : `FenetreProduit` accepte déjà
   la création ; ajouter une prop « code scanné » (pastille « Code scanné : … », UI_UX § 5.7), qui
   servira à la réception (B8). Le bouton « Enregistrer et ajouter à la réception » viendra avec B8.
Puis **B5 : livrer `parametres:lire` à Dev A avant la fin de S5** (le glisser tôt, comme
`conditionnementsProduit`).

**Questions ouvertes** :
- `xlsx` pour l'import (B3) : toujours à valider.
- Réactivation d'un produit, d'un compte ou d'une catégorie désactivés : non prévue (cliente).
- Photo des produits : reportée ; à rouvrir si la cliente veut des images sur les boutons.
- « Mon code » et l'assistant de premier démarrage restent des pages entières (pas des fenêtres) :
  Dev B n'a pas demandé de les convertir.

**Contrats** :
- **Livré à Dev A** : `catalogue:conditionnementsProduit` `{ produitId }` → `ArticleCatalogue[]`
  (Unité d'abord, puis par quantité croissante, actifs seulement ; vide si produit inconnu ou
  désactivé). Débloque le bouton « Changer le conditionnement » d'A1.2.
- **Ajoutés (gérant, sans impact pour Dev A)** : `catalogue:listeProduits`, `ficheProduit`,
  `creerProduit`, `modifierProduit`, `desactiverProduit`, `genererCodeInterne`. `ArticleCatalogue`
  inchangé.
- **Pour Dev A** : la règle des fenêtres modales vaut aussi pour ses futurs formulaires (ouverture de
  caisse, clients, mouvements de caisse…) : utiliser `ui/FenetreFormulaire.tsx`. Ses fenêtres de
  caisse (F2, paiement) gardent `.voile` / `.fenetre`. Nouvelles classes communes listées dans
  `UI_UX.md` § 2.
- Attendus inchangés : `sessionOuverte()` / `enregistrerMouvementCaisse()` (fin S10) — sa version
  actuelle prend un `utilisateurId`, à discuter en A8.


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
