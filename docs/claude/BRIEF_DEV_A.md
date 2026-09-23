# Brief de passation — Claude Code de Dev A (comptoir et matériel)

Tu es la Claude Code qui accompagne **Dev A** sur le projet « Ma Boutique ». Ce brief est ta mémoire :
il résume toute la phase de conception, menée avec le chef de projet dans une conversation que tu
n'as pas vue, et te dit exactement où reprendre. Une autre Claude Code accompagne **Dev B** sur une
autre machine, avec son propre brief (`docs/claude/BRIEF_DEV_B.md`). Vous devez rester alignées :
**la seule mémoire commune entre vous est le dépôt git.**

---

## 1. Ta routine de session (obligatoire)

**Au début de chaque session** (ou via `/reprendre`) :
1. `git status` et `git log --oneline -15` : sur quelle branche, qu'est-ce qui a été fusionné
   récemment (y compris par Dev B).
2. Lis `docs/claude/CARNET_DEV_A.md` (ton carnet : où tu t'es arrêtée, la prochaine étape, les
   questions ouvertes) et la dernière entrée de `docs/claude/CARNET_DEV_B.md` (ce que fait l'autre).
3. Lis `docs/ETAT_AVANCEMENT.md` et `docs/DECISIONS.md` (section « en attente »).
4. Annonce à Dev A en 5 lignes : où on en est, ce qui a changé chez Dev B qui le concerne, la
   prochaine étape proposée.

**À la fin de chaque session** (ou via `/cloturer`) :
1. Ajoute une entrée datée **en haut** de `docs/claude/CARNET_DEV_A.md` : fait, en cours, prochaine
   étape précise, questions ouvertes, contrats attendus de Dev B.
2. Mets à jour `docs/ETAT_AVANCEMENT.md`.
3. Si une règle ou une décision a été tranchée pendant la session, écris-la dans
   `docs/REGLES_METIER.md` ou `docs/DECISIONS.md`.
4. Propose le commit. **Le carnet voyage avec le code** : sans commit, l'autre machine ne le voit pas.

**Commandes de pilotage** (le chef de projet peut les taper à tout moment ; elles rendent compte et
n'écrivent aucun fichier) : `/plan`, `/tache-en-cours`, `/taches-terminees`, `/tache-suivante`.
Elles lisent `docs/ETAT_AVANCEMENT.md` : tiens-le exact, sinon elles répondent faux.

**Pendant la session**, tu ne réponds pas « de mémoire » sur une règle métier : tu vérifies dans
`docs/REGLES_METIER.md`. Si la règle n'y est pas, tu demandes à Dev A, tu ne l'inventes pas.

---

## 2. Le projet (ce qu'il faut avoir en tête en permanence)

Application de caisse et de gestion pour un **mini-supermarché à Lomé (Togo)**, installée sur le
terminal de la boutique, **entièrement hors ligne**. Cliente : la propriétaire de la boutique.

Vision : **chaque franc et chaque boîte sont tracés**. La caissière sert un client en moins de 30 s
sans jamais être bloquée ; le patron explique à tout instant son stock, ses marges et sa caisse.

Matériel (testé et validé sur site) :

| Élément     | Détail                                                                             |
|-------------|------------------------------------------------------------------------------------|
| Terminal    | **OMA POS M120w** — Windows 10, Intel Celeron, **4 Go RAM**, 128 Go                |
| Écrans      | **15,6″ tactile** (caissier, principal) + **11,6″ client** (secondaire, mode étendu) |
| Imprimante  | **Xprinter M804** — thermique 80 mm, USB, ESC/POS, coupe auto, **port tiroir 24 V (RJ11)** |
| Douchette   | Laser USB, émulation clavier, suffixe Entrée                                       |

Contraintes : Internet non garanti, coupures de courant fréquentes (aucune donnée perdue, même en
pleine vente), 4 Go de RAM (application légère), **FCFA sans décimales**, TVA 18 % (le pain est à
0 %), paiements **mobile money** (TMoney, Flooz) avec référence saisie à la main.

Stack : **Electron 37 · React 18 · TypeScript strict · SQLite (`node:sqlite`) · Vitest**.

---

## 3. Ce qui s'est passé avant toi (historique de conception)

1. **Analyse du matériel** à partir de photos : douchette en émulation clavier (aucun pilote), imprimante
   ESC/POS avec port tiroir, terminal double écran → principe d'un écran client.
2. **Choix d'architecture** : application de bureau hors ligne, base locale, le cloud uniquement pour
   la sauvegarde (Internet non garanti).
3. **Phase 0 — deux prototypes jetables testés sur le terminal** (Electron et Laravel), mêmes 5 tests :
   T1 douchette, T2 impression + accents, T3 tiroir, T4 double écran, T5 SQLite + coupure.
   - T4 a réussi avec Electron (fenêtre client plein écran sur le 11,6″ sans manipulation).
   - T2 : liste d'imprimantes vide sur le terminal (`Get-Printer` trop lent ou absent) → corrigé en
     passant par `webContents.getPrintersAsync()` puis PowerShell en repli (30 s).
   - T2 : ticket sorti coupé mais blanc → **rouleau thermique à l'envers** (test de l'ongle). Pas un
     bug logiciel.
   - Tous les tests validés → **Electron retenu** (décision D-02).
4. **Modèle de données v1** puis **v2** : la cliente vend un même produit à l'unité, en lot et en
   carton à des **prix dégressifs libres** → table `conditionnements` ; le stock reste en unité de base.
5. **Scénario d'une semaine** joué avec maquettes d'écrans (réception, nouveau produit, caisse,
   péremptions, sortie de stock, retour client, clôture, inventaire) → `docs/SCENARIO_REFERENCE.md`.
6. **Cahier des charges** rédigé et soumis à la cliente (périmètre, droits, exigences) → synthèse
   dans `docs/PROJET.md`.
7. **Initialisation du dépôt** (le « socle ») et découpage du travail entre Dev A et Dev B.

---

## 4. Principes non négociables (valables pour tout le projet)

1. **Rien n'est jamais effacé.** Correction = contre-passation liée, changement de statut, ou
   désactivation. Des triggers interdisent `UPDATE`/`DELETE` sur `mouvements_stock` et
   `journal_audit`, et `DELETE` sur `ventes` et `lignes_vente`.
2. **Le stock n'est jamais stocké** : c'est la somme de `mouvements_stock`, en **unités de base**.
3. **Conditionnements** : un produit (unité de base) a plusieurs conditionnements (Unité ×1,
   Lot de 3 ×3, Carton de 24 ×24), chacun avec **son prix libre** et son code-barres. Un carton
   vendu = mouvement de **−24**.
4. **Photocopie au moment T** : une ligne de vente copie désignation, prix, TVA, coût et quantité de
   base. L'historique ne bouge jamais quand le catalogue change.
5. **Argent en entiers FCFA**, prix stockés **TTC**.
6. **Identité par la session** côté principal (`session.exiger`), jamais transmise par l'interface.
7. **Tout ce qui doit être cohérent se fait dans `avecTransaction()`** (synchrone). L'impression et le
   tiroir viennent **après**.

---

## 5. Ton périmètre (Dev A — comptoir et matériel)

Tu construis tout ce qui se passe **devant le client**. Ton module critique est la caisse : **elle doit
toujours fonctionner dans `test`**.

**Tu possèdes** : `src/main/modules/caisse/`, `clients/`, `promotions/`, `rapports-ventes/`,
`src/main/materiel/`, `src/main/fenetres.ts`, `src/shared/ipc/caisse.ts`, `materiel.ts` (et
`clients.ts`… quand tu les crées), `src/renderer/src/modules/caisse/`, `clients/`, `promotions/`,
`rapports-ventes/`, `reglages-materiel/`, `src/renderer/src/client.tsx`, `client.html`, `resources/`.

**Zones partagées** (petite PR dédiée, à annoncer à Dev B) : `src/shared/types.ts`,
`src/shared/ipc/index.ts`, `src/main/core/`, `src/main/db/` (dont migrations et seed),
`src/main/ipc/index.ts`, `src/renderer/src/app/`, `lib/`, `ui/styles.css`, `package.json`, `docs/`.

**Tu ne modifies pas** (propriété de Dev B) : auth, utilisateurs, catalogue, stock, paramètres, achats,
inventaires, dépenses, sauvegardes. Si un de leurs contrats ne convient pas, tu rédiges la demande
pour Dev B (canal, requête, réponse souhaités) et tu codes contre une valeur provisoire.

---

## 6. Ce qui existe déjà (le socle) et que tu utilises

| Élément                      | Où                                   | Usage pour toi                                 |
|------------------------------|--------------------------------------|------------------------------------------------|
| Scan → article               | `catalogue:rechercherCode` (Dev B)   | Renvoie un `ArticleCatalogue` ou `null`        |
| Boutons tactiles             | `catalogue:grille`                   | Conditionnements marqués `bouton_tactile`      |
| Recherche par nom            | `catalogue:rechercher`               | Touche F2                                      |
| Mouvements de stock          | `core/mouvements.ts`                 | `enregistrerMouvement`, `contrePasser`         |
| Numéros                      | `core/numerotation.ts`               | `prochainNumero(db, 'T')` → `T-2026-000001`    |
| Audit                        | `core/audit.ts`                      | `journaliser(db, {...})`                       |
| Session et droits            | `core/session.ts`                    | `session.exiger(['gerant'])`                   |
| Transactions, requêtes       | `db/requetes.ts`                     | `avecTransaction`, `une`, `toutes`, `executer` |
| Appel typé depuis l'écran    | `renderer/src/lib/api.ts`            | `appel('canal', requete)`                      |
| Douchette                    | `renderer/src/lib/useScanner.ts`     | Écoute globale, ignorée dans les champs sauf `data-scan` |
| Impression brute             | `materiel/imprimante.ts`, `escpos.ts`| `envoyerBrut(methode, cible, octets)`, ticket test, impulsion tiroir |
| Écran client                 | `fenetres.ts` + preload              | `window.pos.envoyerPanierClient(panier)`       |
| Page caisse de **démonstration** | `modules/caisse/PageCaisse.tsx`  | À **remplacer** par le vrai écran (A1.1)       |

`ArticleCatalogue` : `conditionnementId, produitId, designation, conditionnement, quantiteBase,
prixVente (TTC, entier), tauxTva, suiviPeremption, coutConditionnement (CUMP × quantiteBase),
codeBarres, codePlu`.

Données de démo (base de développement) : Afi caissière `0000`, Kossi gérant `5678`, Patron admin
`1234`. Tomate : unité `6181000000042` 350 F, lot de 3 `2000000000015` 1 000 F, carton de 24
`16181000000049` 7 500 F (CUMP 250, 72 boîtes). Baguette PLU `101` 300 F TVA 0. Jus d'ananas
`6034000012345` 600 F, pack de 6 à 3 300 F. Lait (périssable).

---

## 7. Tes tâches, dans l'ordre

Détail complet et critères de fin : `docs/DEV_A_COMPTOIR.md`. Statut réel : `docs/ETAT_AVANCEMENT.md`.
**Point de départ : A1.1.** Démarre chaque tâche par `/tache <id>` (plan puis accord de Dev A).

### Phase 1 — La caisse opérationnelle (S3–S8) — le jalon le plus important du projet
- **A1.1 (S3)** Panier en fonctions pures (`modules/caisse/panier.ts`) + vrai écran de caisse. Même
  conditionnement scanné deux fois = quantité +1. Code inconnu = message, le scan suivant marche.
- **A1.2 (S4)** Grille tactile par catégorie, recherche F2, **changement de conditionnement** d'une
  ligne (attend `catalogue:conditionnementsProduit` de Dev B fin S4), tickets en attente,
  raccourcis F2 / F4 / F8 / Suppr / Échap / + −.
- **A2 (S5)** Fenêtre de paiement + service `enregistrerVente` (transaction unique, prix relus en base,
  TVA ventilée, paiements = total). Voir § 8.
- **A3 (S6)** Ticket réel ESC/POS (48 colonnes), tiroir à chaque encaissement espèces, réglages
  matériel, réimpression « DUPLICATA ». En-tête via `parametres:lire` (Dev B fin S5 ; en attendant,
  valeur par défaut).
- **A4 (S7)** Sessions de caisse, rapports X et Z. Pas de session = pas de vente.
- **A5 (S8)** Remises plafonnées et journalisées, performance, recette de phase avec Dev B.

### Phase 2 (S9–S12)
A6 annulation de ticket · A7 retour client et remboursement · A8 mouvements de caisse + fonctions
`sessionOuverte()` et `enregistrerMouvementCaisse()` **pour Dev B (fin S10)** · A9 FEFO à la vente
(consomme `allouerFefo()` de Dev B, fin S10) · A10 facture A4 et proforma.

### Phase 3 (S13–S15)
A11 clients et vente à crédit (plafond bloquant) · A12 recouvrement (balance âgée) · A13 écran client
définitif.

### Phase 4 (S16–S18)
A14 rapports ventes et caisse + `caisse:ventesPeriode` **pour Dev B (fin S16)** · A15 tableau de bord
d'accueil · A16 promotions programmées.

### Phase 5 (S19–S20)
Tests terrain (coupure en pleine vente, bourrage, 200 ventes d'affilée), guide du caissier, formation.

---

## 8. Règles métier de ton périmètre (résumé — la référence reste `docs/REGLES_METIER.md` § 6–7)

**Enregistrer une vente** — une seule transaction :
1. l'interface n'envoie que `conditionnementId`, quantités, remises et paiements ; **le service relit
   prix et coûts en base** ;
2. numéro `prochainNumero(db, 'T')` ;
3. une `lignes_vente` par ligne : `quantite` (nb de conditionnements), `prix_unitaire` (du
   conditionnement), `cout_unitaire` = CUMP × `quantite_base`, `quantite_base_totale` =
   quantite × quantite_base, `taux_tva`, désignation copiée ;
4. un mouvement `vente` de −`quantite_base_totale` par ligne (par lot si FEFO, Phase 2) ;
5. paiements ; **somme des paiements = total TTC** sinon `ErreurMetier` ;
6. partie à crédit → créance (Phase 3).
Puis, **hors transaction** : impression, tiroir. Imprimante en panne → « Vente enregistrée, ticket
non imprimé » + Réimprimer. **Jamais de vente bloquée par l'imprimante.**

**TVA** (prix TTC), par taux : `HT = arrondi(TTC / (1 + taux/100))`, `TVA = TTC − HT`, puis on somme.
Exemple de test : 12 700 F à 18 % + 600 F à 0 % → HT 10 763 + 600 = **11 363**, TVA **1 937**,
TTC **13 300**.

**Espèces théoriques** = fond + ventes espèces (tickets terminés) + entrées de caisse − sorties.
Écart = compté − théorique. Test de référence : 10 000 + 46 200 + 3 500 − 1 000 = **58 700** ;
compté 58 200 → écart **−500**.

**Session** : une seule ouverte par caissier ; déconnexion ≠ clôture ; clôturée = figée.

**Remises** : sur ligne ou ticket, en FCFA, plafonnées pour le caissier (paramètre, valeur en attente
D-A3), **toujours journalisées**.

**Annulation** (gérant, motif) : statut `annulee`, contre-passation de chaque mouvement, paiement
inverse. **Retour client** : depuis le ticket d'origine, pas plus que vendu (retours précédents
inclus), motif, sort (remise en stock : `retour_client` + ; destruction : `retour_client` + puis
`casse` −), remboursement ; vente `type = 'retour'`, `vente_origine_id`, paiement négatif.

**Crédit** : blocage si l'encours après vente dépasse le plafond ; créance avec échéance ; chaque
encaissement de créance passe par la session de caisse ; balance âgée 0–30 / 31–60 / +60 jours.

**Stock insuffisant** : **décision en attente (D-A1)** — ne bloque jamais la vente, affiche une alerte.

---

## 9. Matériel — ce qu'il faut savoir

- Encodeur `materiel/escpos.ts` (validé) : `ESC @` init, `ESC t n` page de codes, `ESC a` alignement,
  `ESC E` gras, `GS !` taille, `GS V 66 3` coupe, **`ESC p 0 25 250` impulsion tiroir**.
- **Page de codes gagnante du test T2 : à reporter (D-A2)**. Demande-la à Dev A au début de A3 et
  code-la par défaut.
- Ticket 80 mm : **48 colonnes** en police normale (l'encodeur de test utilise 32 par prudence).
- Deux méthodes d'envoi : `spooler` (script `resources/raw-print.ps1`, nom exact de l'imprimante
  Windows) et `share` (`copy /b` vers `\\localhost\<partage>`).
- Réglages à conserver dans les paramètres : `imprimante_methode`, `imprimante_cible`,
  `imprimante_page_codes` (écriture via `parametres:ecrire` de Dev B).
- Dépannage connu : liste vide → saisie manuelle du nom ; papier blanc → rouleau à l'envers.

---

## 10. Tes écrans (spécifications complètes : `docs/UI_UX.md` § 5.2 à 5.5 et 5.10)

- **Caisse** : grille de boutons à gauche (onglets de catégories), ticket à droite, **total en très
  grand (≥ 40 px) — l'élément fort**, boutons Espèces (principal) / TMoney / Flooz / Crédit. Pastille
  verte du conditionnement sur la ligne quand ce n'est pas l'unité. Sans session : seulement
  « Ouvrir la caisse ».
- **Paiement** : billets rapides 1 000 / 2 000 / 5 000 / 10 000 + Montant exact, **monnaie à rendre
  en très grand**, référence obligatoire en mobile money, paiement mixte avec « Reste à payer »,
  bouton **« Encaisser »**.
- **Clôture** : 4 totaux par mode, calcul des espèces théoriques ligne à ligne, saisie du compté, écart
  coloré, commentaire, « Rapport X (aperçu) », **« Clôturer et imprimer le Z »**.
- **Retour client** : ticket d'origine, lignes à cocher, motif, sort du produit, remboursement,
  **« Valider le retour »**.
- **Écran client** : fond sombre, lignes en 24 px, total en 56 px, « Bienvenue » au repos.

Design : jetons de `ui/styles.css` uniquement (vert `#0f6e56`, encre `#1f2d33`…), Segoe UI, chiffres
tabulaires (`.montant`), cibles ≥ 48 px, textes en français, boutons avec verbe, erreurs qui disent
quoi faire.

---

## 11. Rendez-vous avec Dev B

| Tu attends de Dev B                          | Pour     | Échéance | En attendant              |
|----------------------------------------------|----------|----------|---------------------------|
| Contrôle des rôles sur tous les canaux       | —        | fin S3   | —                         |
| `catalogue:conditionnementsProduit`          | A1.2     | fin S4   | Bouton masqué             |
| `parametres:lire` (et `ecrire`)              | A3       | fin S5   | En-tête en dur, config locale |
| `stock/allouerFefo(db, produitId, qteBase)`  | A9       | fin S10  | `lot_id` null             |

| Tu livres à Dev B                                      | Échéance |
|--------------------------------------------------------|----------|
| `caisse:enregistrerVente` (modèle de transaction)      | fin S5   |
| `sessionOuverte(db)`, `enregistrerMouvementCaisse(db…)` | fin S10  |
| `caisse:ventesPeriode`                                 | fin S16  |

Si tu constates en début de session qu'un contrat attendu est arrivé dans `test`, dis-le à Dev A et
propose de remplacer la valeur provisoire.

---

## 12. Ne jamais faire

`INSERT INTO mouvements_stock` hors de `core/mouvements.ts` · modifier une migration existante ·
un montant flottant · faire confiance à l'interface pour un prix ou un utilisateur · imprimer dans une
transaction · bloquer une vente à cause de l'imprimante · une couleur en dur · un texte en anglais ·
ajouter une dépendance sans accord · modifier un fichier de Dev B · trancher une décision en attente ·
inventer une règle métier · développer une fonction du **périmètre exclu** (comptabilité, boutique en
ligne, multi-boutiques, appli mobile, intégration automatique mobile money, balance connectée).

## 13. Git

Trois branches : `main` (version validée, installée chez la cliente) ← `test` (intégration
quotidienne) ← `a/<sujet>` (une tâche, 2 jours maximum).

- **Matin** : `git switch test && git pull`, puis `git switch a/<sujet>` et `git rebase test`.
  Une nouvelle branche de tâche se crée **depuis `test` à jour**.
- **Soir, tous les soirs** : `/verifier`, `/cloturer`, commit, `git push` — même tâche non finie.
- **Tâche finie** : PR vers **`test`** (jamais vers `main`), relue par Dev B le jour même, CI verte,
  fusion en squash, branche supprimée. Au moins une PR fusionnée par jour.
- **Vendredi** : test commun de `test`, puis PR `test` → `main` et tag.
- Commits `feat(caisse): …`. Un écran inachevé peut être fusionné sans sa ligne dans `app/routes.tsx`.
