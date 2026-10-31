# Carnet de bord — Claude Code de Dev A

Mémoire de session à session. **Nouvelle entrée en haut** à chaque fin de session (commande
`/cloturer`), lue à chaque début de session (commande `/reprendre`). L'autre Claude Code lit la
dernière entrée de ce carnet pour savoir ce que fait Dev A : écrire clairement, sans jargon interne
à la session.

Format d'une entrée :

```
## AAAA-MM-JJ — <branche> — <tâche>
**Fait** : …
**En cours** : … (fichiers, état exact)
**Prochaine étape** : … (assez précise pour reprendre sans rien relire d'autre)
**Questions ouvertes** : … (pour Dev A, pour l'autre développeur, pour la cliente)
**Contrats** : livrés / attendus / modifiés (impact pour l'autre développeur)
```

---

## 2026-11-01 — a/clients-ecran, a/clients-credit-caisse, a/clients-avoir-facture — A11 terminée (parties 3 à 6)
**Fait** (toutes ces PR sont fusionnées dans `test`, dernière : #84) :
- **Début de session** : PR #79 (parties 1 et 2) fusionnée par Dev B ; journal des fusions mis à jour (A14 partie 1, A11).
  Dev B a ajouté les libellés du journal des clients (#83).
- **A11 partie 3, écran Clients** (#81) : page `/clients` (caissière et gérant), `modules/clients/PageClients.tsx` +
  `clients.ts` (logique pure). Recherche nom ou téléphone, fiche (coordonnées, plafond grisé pour la caissière, encours,
  reste disponible, créances avec « en retard » en rouge), « Nouveau client », « Désactiver » (gérant, motif).
  `UI_UX` § 5.24. Règle confirmée par Dev A : **un téléphone ne sert pas à deux clients actifs** (déjà dans § 7.1).
- **Partie 4, crédit à la caisse** (#82) : bouton « Crédit » actif → `FenetreChoixClient.tsx` (clients à plafond > 0
  seulement, pastilles « Plafond atteint » / « En retard ») → ligne « À crédit » dans `FenetrePaiement` (reste disponible,
  échéance J+30, bandeau si retard, vente possible). Le crédit commence par tout le ticket ; ajouter espèces / TMoney / Flooz
  le limite au reste disponible. `paiement.ts` : `ouvrirPaiement(total, mode, credit?, clientAvoir?)`, `changerCredit`,
  `changerEcheance`, `retirerMode(…, 'credit')`. Message « … F à crédit pour <nom>, à régler avant le … » ; annulation :
  « Le crédit de … est effacé ». Pas de création rapide de client à la caisse (une caissière ne crée qu'un client à
  plafond 0, inutile pour le crédit : le gérant fixe le plafond dans la page Clients).
- **Partie 5, facture / proforma** (#84, commit 1) : « Choisir un client enregistré » dans `ChampsClient` (recopie
  nom, téléphone, adresse, NIF ; pas de lien avec la fiche). `FenetreChoixClient` a un paramètre `usage`
  (`credit` | `avoir` | `recopie`) ; Échap ne ferme que la fenêtre de recherche.
- **Partie 6, avoir en boutique** (#84, commits 2 à 5). Modèle validé par Dev A le 01/11, **`REGLES_METIER` § 7.2** :
  - migration `20261101_0900_avoirs_boutique.sql` : `paiements` recréée (mode `avoir` ajouté au CHECK), tables
    `avoirs` (numéro `AV-AAAA-NNNNNN`, un par retour, au nom d'un client) et `utilisations_avoir` (dépense > 0,
    rétablissement < 0 lié, une seule fois), triggers (ni UPDATE ni DELETE, jamais plus que le solde), vue
    `v_avoirs_clients`. `MODELE_DONNEES` mis à jour.
  - `modules/clients/service-avoir.ts` : `creerAvoir`, `depenserAvoirs` (les plus anciens d'abord), `retablirAvoirs`,
    `soldeAvoirs`, `avoirsDuClient` ; `Client.soldeAvoir`, `FicheClient.avoirs`.
  - **Retour client en avoir** : `ModeRemboursement` + `'avoir'`, `RequeteRetour.clientId`, `RetourEnregistre.avoir`,
    `TicketRetour.clientAvoir`. **Un ticket payé en partie par avoir ne se rembourse qu'en avoir, au même client**
    (choix de Claude : pas de répartition au prorata entre modes). Rien ne sort du tiroir.
  - **Vente** : mode `avoir` (`ModePaiementVente`), `clientId` obligatoire, une seule part, solde relu dans la
    transaction, journal `utilisation_avoir` ; `VenteEnregistree.avoir`. Bouton « Avoir » à la caisse : les espèces
    prennent le reste.
  - **Annulation** : avoir rétabli (`ResultatAnnulation.avoirRetabli`), jamais compté comme « à rendre ».
  - **X / Z et clôture** : `totauxParMode.avoir`, `remboursements.avoir` ; lignes « Avoirs utilisés » (si > 0) et
    « Rendu en avoir » ; carte sur l'écran de clôture. L'avoir n'entre jamais dans les espèces théoriques.
  - Ticket de retour : bloc « AVOIR EN BOUTIQUE AV-… », montant, solde du client. Facture : mode « Avoir en boutique ».
  - Un client qui a un solde d'avoir **ne se désactive pas**. Fiche client : solde et tableau des avoirs.
- **CI** : le test de Dev B « toutes les actions du code ont un libellé » refusait `utilisation_avoir` ; libellés
  (`utilisation_avoir`, clés `avoir`, `avoirs`) ajoutés dans `src/shared/audit.ts` (fichier de Dev B, à sa demande
  implicite par la CI). La poussée forcée a été refusée : correctif poussé par fusion de `test`, sans réécrire.
- `npm run verifier` sur `test` à `d7db583` : **785 tests verts**, typecheck OK.

**En cours** : rien de non fusionné. Cette entrée et l'état sont sur `a/docs-carnet-a11` (PR à ouvrir).

**Prochaine étape** :
1. `git switch test && git pull`, puis supprimer les branches fusionnées : locales (`a/clients-avoir-facture`,
   `a/docs-a6-a9-fusion`, anciennes `a/caisse-*`, tag/branche `sauvegarde-rebase-avoir`) et distantes
   (`a/clients-fiche`, `a/clients-credit-vente`, `a/clients-ecran`, `a/clients-credit-caisse`,
   `a/clients-avoir-facture`).
2. **Essai à la main de A11** (pas encore fait en entier) : client avec plafond (Kossi `5678`), vente 100 % à crédit,
   mixte espèces + crédit au plafond, refus au-delà, annulation ; retour en avoir puis paiement par avoir ; facture avec
   client enregistré ; clôture (carte « Avoirs utilisés »). Puis ajouter à l'essai terminal : ticket à crédit en deux
   exemplaires, ticket de retour avec avoir.
3. **A12 Recouvrement** (`/tache A12`, branche `a/recouvrement` depuis `test` à jour) : encaissement d'une créance par la
   session de caisse ouverte (`enregistrerMouvementCaisse`, motif `encaissement_creance`, table `encaissements_creances`
   et vue `v_creances_clients` existent), paiements partiels, balance âgée 0–30 / 31–60 / +60 jours, liste de relance
   imprimable, historique par client, et **levée du refus de retour sur ticket à crédit** (« le rendu doit d'abord réduire
   la créance », § 6.8). Points de règle à faire trancher par Dev A avant de coder : droits (caissière encaisse ?),
   modes acceptés (espèces, TMoney, Flooz avec référence ?), ordre d'imputation d'un paiement sur plusieurs créances,
   retour sur ticket à crédit (réduit la créance, rembourse le reste ?), contenu de la liste de relance.
4. Ensuite A13 (écran client définitif), puis Phase 4 (A14 reste, A15 : `stock:alertesAccueil` de Dev B est disponible).

**Questions ouvertes** :
- **Pour la cliente** : marge sur le TTC ou le HT ; délai limite d'un retour ; mentions légales de la facture ; validité de
  la proforma ; ligne « tickets annulés » sur le X et le Z ; D-A1 (stock négatif), D-A3 (plafond de remise) ; **un avoir
  expire-t-il ?** (aucune validité aujourd'hui, validé par Dev A) ; un remboursement en avoir peut-il se changer en argent ?
- **Essai sur le terminal** toujours à faire (Xprinter, tiroir réel, 15,6″, douchette).
- Sur ce poste : `.claude/settings.json` modifié localement ? (`git checkout .claude/settings.json` si c'est le cas).

**Contrats** :
- **Livrés (Dev A)** : `clients:*` (déjà), `Client.soldeAvoir`, `FicheClient.avoirs` ; dans `caisse.ts` : `ModePaiementVente`
  + `'avoir'`, `VenteEnregistree.avoir`, `ResultatAnnulation.avoirRetabli`, `RequeteRetour.clientId`, `RetourEnregistre.avoir`,
  `TicketRetour.clientAvoir`, `RapportCaisse.totauxParMode.avoir` et `remboursements.avoir` (ajouts, sans impact pour B
  hors tests qui construisent ces objets).
- **Pour Dev B (rapports B14, A14)** : un ticket payé par avoir a un paiement `mode = 'avoir'` ; c'est une vente
  `terminee` ordinaire (dans `ventesPeriode`), mais ce n'est **pas** un encaissement d'argent : à écarter d'un futur
  « encaissé par mode ». Un retour en avoir est un paiement `avoir` négatif. Le solde d'un client se lit dans
  `v_avoirs_clients`.
- **Migration en zone partagée** : `20261101_0900_avoirs_boutique.sql` (recrée `paiements`). Fusionnée.
- **Fait côté Dev B** : libellés du journal des clients, du crédit et de la caisse (#83) ; j'y ai ajouté
  `utilisation_avoir`, `avoir`, `avoirs`.
- Attendu de Dev B : rien.

## 2026-10-28 → 31 — a/caisse-ventes-periode, a/clients-fiche, a/clients-credit-vente — A14 partie 1 (en avance), A11 parties 1 et 2
**Fait** :
- **A14 partie 1 livrée en avance** (PR #73, fusionnée) pour débloquer la marge de B14 : `ventesPeriode(db, { du, au })`
  (`modules/caisse/service-rapports.ts`) et canal `caisse:ventesPeriode` (gérant). Règles validées par Dev A
  (`REGLES_METIER` § 11) : CA = Σ `ventes.total_ttc` (la remise sur le ticket n'est pas dans `total_ligne`) ; un retour
  rend son coût ; chaque document à sa date ; coût arrondi une fois ; `marge` sur le TTC (règle écrite), `margeHt`
  pour information. Dev B l'a branchée (PR #76) : **B14 ✅**.
- **A11 Clients et vente à crédit — 🔄, parties 1 et 2 écrites**. Les 8 points de règle ont été validés par Dev A
  (`REGLES_METIER` § 7.1) : la caissière crée un client à plafond 0, le gérant seul fixe le plafond ; téléphone
  obligatoire si plafond > 0 (et, ajouté par Claude, unique parmi les actifs : deux fiches doubleraient le plafond —
  **à faire confirmer par Dev A**) ; crédit sans code du gérant tant que le plafond tient, **refus strict** au-delà ;
  échéance 30 jours modifiable ; ticket à crédit en **deux exemplaires** (client, boutique avec signature) ;
  annulation du ticket = créance annulée ; **retour sur ticket à crédit refusé jusqu'à A12** ; **avoir en boutique =
  dernière PR d'A11**.
  - Partie 1 (`6ea1daf`) : migration `20261031_1000_clients_credit.sql` (`clients.nif` ; annulation d'une créance par
    les colonnes `annulee_le`, `annulee_par`, `motif_annulation` — pas de table recréée, la vue `v_creances_clients`
    expose `statut = 'annulee'` et `restant_du = 0` ; triggers : ni suppression de client ni de créance, montant
    figé, annulation définitive, encaissements immuables) ; module `modules/clients/` (service, ipc) ; contrat
    `src/shared/ipc/clients.ts` : `clients:rechercher`, `lire`, `creer`, `modifier`, `desactiver` ;
    `encoursClient(db, clientId)`. 9 tests (`tests/clients.test.ts`).
  - Partie 2 (`7671851`) : `enregistrerVente` accepte le mode `credit` + `clientId` (+ `echeance`) ; plafond relu
    dans la transaction, créance créée avec la vente, journal `vente_credit` ; `annulerTicket` annule la créance
    (`creditAnnule`), refus si un encaissement existe ; `service-retour` refuse un ticket à crédit ; ticket
    (`materiel/ticket.ts`) : bloc « VENTE À CRÉDIT », deux exemplaires dans le même envoi, duplicata = exemplaire
    boutique. `src/shared/clients.ts` : `DELAI_CREDIT_JOURS`, `ajouterJours`. 11 tests (`tests/caisse-credit.test.ts`).
  - **Attention** : la PR #80 (partie 2) a été fusionnée dans sa base `a/clients-fiche`, pas dans `test`. La **PR #79**
    contient donc les deux parties ; un commentaire est posté sur #79 pour que Dev B relise les deux.
- `npm run verifier` sur `a/clients-fiche` : **743 tests verts**, typecheck OK.

**En cours** : **PR #79** (`a/clients-fiche` → `test`) en attente de la relecture de Dev B (relecteur : sowadan). Cette
entrée de carnet et l'état y sont ajoutés. Rien d'autre de non poussé.

**Prochaine étape** :
1. `/reprendre`, puis `git fetch` : la #79 est-elle fusionnée ? Si oui : ligne au journal des fusions de
   `ETAT_AVANCEMENT.md` (A11 parties 1 et 2), supprimer `a/clients-fiche` et `a/clients-credit-vente` (local et
   GitHub). Sinon, corriger ce que Dev B demande en relecture, sur `a/clients-fiche`.
2. **A11 PR 3 — écran Clients**, sans attendre la fusion : branche `a/clients-ecran` créée **depuis `a/clients-fiche`**
   (PR empilée — cette fois **ne pas la fusionner dans sa base** : attendre #79, rebaser sur `test`, changer la base) :
   - page `/clients` (menu « Clients », caissière et gérant) : recherche (nom ou téléphone), liste avec encours et
     « en retard » ; fiche : coordonnées modifiables, plafond modifiable **par le gérant seulement** (champ grisé pour
     la caissière), créances (ticket, date, montant, encaissé, restant dû, échéance, statut, en retard en rouge),
     « Désactiver » (gérant, motif) ; « Nouveau client » (`FenetreFormulaire`) ;
   - logique pure à part (`modules/clients/…ts`), tests ; route dans `app/routes.tsx` (zone partagée) ; `UI_UX` :
     nouvelle section.
3. **PR 4 — crédit à la caisse** : bouton « Crédit » de `PageCaisse` activé → choix du client (recherche, création
   rapide, alerte si `enRetard > 0`, reste disponible = plafond − encours) → `FenetrePaiement` avec une ligne
   « À crédit » (paiement mixte possible) et l'échéance (J+30 par défaut, `DELAI_CREDIT_JOURS`) ; envoi `clientId`,
   `echeance` ; message après vente avec `VenteEnregistree.credit` ; fenêtre d'annulation : afficher `creditAnnule`
   (« crédit effacé ») ; facture et proforma : choisir un client existant pour remplir le formulaire.
4. **PR 5 — avoir en boutique** (reporté d'A7) : à concevoir (table d'avoirs, mode de paiement : le CHECK de
   `paiements.mode` n'a pas `avoir`, il a `autre`) — proposer le modèle à Dev A avant de coder. Puis A11 → ✅.
5. Ensuite A12 (recouvrement : encaissement de créance par la session, `enregistrerMouvementCaisse` motif
   `encaissement_creance`, balance âgée, retour sur ticket à crédit) et A13 (écran client).

**Questions ouvertes** :
- Pour Dev A : confirmer la règle « un téléphone ne sert pas à deux clients actifs » (ajoutée par Claude).
- **Pour la cliente** : marge sur le TTC ou le HT (`margeHt` existe déjà) ; délai limite d'un retour ; mentions
  légales de la facture ; validité de la proforma ; ligne « tickets annulés » sur le X et le Z ; D-A1 (stock
  négatif), D-A3 (plafond de remise).
- **Essai sur le terminal** toujours à faire (Xprinter, tiroir réel, 15,6″, douchette) ; y ajouter le ticket à
  crédit en deux exemplaires et le ticket de retour. A3 et A4 restent 🔄.
- Sur ce poste : tag local `sauvegarde-avant-rebase-a3` à supprimer ; `.claude/settings.json` modifié localement, à
  jeter (`git checkout .claude/settings.json`) s'il l'est encore.

**Contrats** :
- **Livrés (Dev A)** : `caisse:ventesPeriode` / `ventesPeriode()` (PR #73, consommé par Dev B en #76) ; `clients:*`
  (5 canaux), `encoursClient()` ; dans `caisse.ts` : `ModePaiementVente`, `RequeteVente.clientId` / `echeance`,
  `VenteEnregistree.credit`, `ResultatAnnulation.creditAnnule` (ajouts, sans impact pour Dev B).
- **Pour Dev B (rapports)** : une vente à crédit est une vente `terminee` ordinaire (déjà dans `ventesPeriode`) ; la
  part à crédit est un paiement `credit`, jamais dans les espèces ; une créance annulée se lit par
  `v_creances_clients.statut = 'annulee'`.
- **Demandé à Dev B** (ligne ⏳ aux rendez-vous de `ETAT_AVANCEMENT.md`) : libellés de `creation_client`,
  `modification_client`, `plafond_credit`, `desactivation_client`, `vente_credit` dans `src/shared/audit.ts` (en
  plus des anciennes demandes : `mouvement_caisse`, `annulation_mouvement_caisse`, `retour_client`, `facture`,
  `edition_facture`, `proforma`).
- **Reçu de Dev B** : `stock:alertesAccueil` (PR #78) pour **A15** (tableau de bord) — rendez-vous 🔄 côté Dev B.

## 2026-10-16 — a/caisse-retour(-ecran), a/caisse-facture, a/caisse-proforma — A7 terminée, A10 parties 1 et 2
**Fait** (session du 13 au 16/10) :
- **Fusions de début de session** : A9 (#57), A6 (#58 puis #61). La PR #59 (écran d'A6) avait été
  fusionnée par erreur dans `a/caisse-annulation` au lieu de `test` (base non changée après #58) :
  refaite en #61. État mis à jour (#62). Branches fusionnées supprimées (local et GitHub).
- **A7 Retour client — ✅** (#63 serveur, #64 écran). Règles validées par Dev A, `REGLES_METIER` § 6.8
  (précisions du 13/10) et § 6.9 :
  - gérant, ou caissière avec le **code du gérant** (même fonction qu'A6, `autoriseParGerant` exportée
    de `service-annulation.ts`) ; remboursement sur la caisse **ouverte de celui qui fait le retour** ;
  - retour = vente `type = 'retour'`, numéro **`R-AAAA-NNNNNN`**, `vente_origine_id`, montants
    **négatifs**, paiement négatif ; **rien dans `mouvements_caisse`** ;
  - pas plus que vendu, **ligne par ligne** (`lignes_vente.ligne_origine_id`), en conditionnements ;
  - montant rendu = payé (remises comprises) au prorata, le dernier retour prend le reste
    (`montantRetourLigne` dans `src/shared/retour.ts` ; 950 F → 316 + 316 + 318) ;
  - espèces (pas plus que le tiroir), TMoney, Flooz (référence obligatoire) ; **avoir en boutique
    reporté à A11** (bouton grisé) ;
  - stock : `retour_client` sur les lots servis à la vente (dernier servi d'abord), `casse` si détruit ;
  - X / Z / écran de clôture : bloc « Retours client », espèces théoriques **moins les remboursements
    en espèces** (un remboursement TMoney ne touche pas le tiroir ; expliqué à Dev A) ; les ventes par
    mode ne comptent que les tickets de vente ;
  - ticket de retour imprimé « RETOUR CLIENT » ; écran `FenetreRetour.tsx` (bouton « Retour client »).
  - Migration `20261013_1400_retours_client.sql` (`motif_retour`, `sort_retour`, `ligne_origine_id`).
- **A10 Facture et proforma — 🔄, parties 1 et 2 fusionnées** (#65 facture, #66 proforma). Règles
  validées (10 points), `REGLES_METIER` § 6.12 et § 6.13 :
  - **facture** = document d'un **ticket déjà encaissé** (ni vente, ni stock, ni caisse), une par ticket,
    numéro **`F-…`**, table `factures`, client saisi et recopié (nom obligatoire, tél., adresse, NIF) ;
    refus : annulé, retour, entièrement retourné, déjà facturée ; section « Retours » et net payé ;
    montant en toutes lettres (`documents/lettres.ts`, 30 cas testés) ; NIF de la boutique ;
    première sortie réussie **de chaque sorte** (PDF / impression) = original, ensuite « COPIE » ;
  - **proforma** = devis depuis le panier, **sans caisse ouverte**, numéro **`PF-…`**, tables
    `proformas` / `lignes_proforma`, prix relus et contrôlés comme à la vente (`preparerLignes`,
    `controlerRemiseGlobale`, `controlerPlafond` exportées de `service-vente.ts`, accord du gérant non
    consommé), **30 jours** (`VALIDITE_PROFORMA_JOURS`), reprise **aux prix du jour** avec `prixChange`,
    article retiré = `null`, `expiree` signalée ; pas de COPIE ;
  - sortie A4 : HTML (`documents/page.ts`, `facture.ts`, `proforma.ts`) → fenêtre cachée sans JS →
    `printToPDF` + dialogue d'enregistrement, ou `webContents.print` (`documents/pdf.ts`), hors
    transaction ;
  - migration `20261015_1000_factures_proformas.sql` (3 tables, ni UPDATE ni DELETE).
  - Canaux : `caisse:facturer`, `trouverFacture`, `editerFacture`, `creerProforma`, `lireProforma`,
    `editerProforma`. PDF de la facture et de la proforma **vérifiés à la main par Dev A** (depuis la
    console : `window.pos.invoke` renvoie `{ ok, donnees }`, et attention aux lignes qui commencent
    par « ( » sans point-virgule avant).
- `test` à `9302a33` : **679 tests verts**, typecheck OK (vérifié en fin de session).

**En cours** : rien de non fusionné. Cette entrée et l'état sont sur `a/docs-carnet-a7-a10` (PR à ouvrir).

**Prochaine étape** :
1. `git switch test && git pull`, puis `git switch -c a/caisse-facture-ecran`.
2. **A10 partie 3 — écrans** (règles déjà validées, pas de nouveau point à trancher sauf la mise en page) :
   - dans `PageCaisse`, actions « Faire une facture » et « Proforma » ;
   - `FenetreFacture.tsx` : numéro du ticket (dernier ticket proposé, numéro court accepté),
     `caisse:trouverFacture` d'abord (si une facture existe : « Rééditer », sinon formulaire client) ;
     après `caisse:facturer`, boutons « Enregistrer le PDF » et « Imprimer » (`caisse:editerFacture`),
     message « COPIE » quand `copie: true` ; refus du service affiché dans la fenêtre ;
   - « Proforma » : actif quand le panier n'est pas vide ; fenêtre client facultatif → `caisse:creerProforma`
     avec `versLignesVente(panier)`, `remiseGlobale`, `jetonRemise` du panier ; puis PDF ; **le panier
     reste** (la caissière choisit de le vider) ;
   - « Reprendre une proforma » : `caisse:lireProforma`, puis charger les lignes au panier avec
     `article` (ignorer `null` avec un message), remises de ligne et remise globale ; bandeau « Prix
     changé depuis la proforma : … » pour les lignes `prixChange`, et « Proforma périmée » si `expiree`.
     Regarder dans `panier.ts` / `attente.ts` comment poser une remise sur une ligne (A5) ; ajouter une
     action de réducteur `chargerProforma` si besoin, testée ;
   - logique pure dans `modules/caisse/documents.ts` (ou proche), tests ; `UI_UX` : nouvelle § pour
     les deux fenêtres ; puis A10 → ✅.
3. Ensuite **Phase 3 : A11 Clients et vente à crédit** (`/tache A11`) : y brancher l'avoir en boutique
   d'A7 et le choix d'un client existant sur la facture / proforma (`client_id` prévu dans les tables).

**Questions ouvertes** :
- **Pour la cliente** : délai limite d'un retour (aucun aujourd'hui) ; mentions légales de la facture
  (RCCM, régime fiscal ? NIF seul d'ici là) ; validité de la proforma (30 jours, à passer en paramètre ?) ;
  ligne « tickets annulés » sur le X et le Z ; D-A1 (stock négatif), D-A3 (plafond de remise).
- Proposé à Dev A, non demandé : une carte « Retours » ou un net par mode sur l'écran de clôture.
- **Essai sur le terminal** toujours à faire (Xprinter, D-A2, tiroir réel, 15,6″, douchette) : A3 et
  A4 restent 🔄 ; ajouter au programme le ticket de retour imprimé.
- Sur ce poste : tag local `sauvegarde-avant-rebase-a3` (`git tag -d sauvegarde-avant-rebase-a3`) ; une
  autorisation ponctuelle ajoutée dans `.claude/settings.json` (non commitée, à jeter :
  `git checkout .claude/settings.json`).

**Contrats** :
- Ajoutés (Dev A) : `caisse:consulterRetour`, `caisse:enregistrerRetour` ; `RapportCaisse.remboursements` ;
  `caisse:facturer`, `trouverFacture`, `editerFacture`, `creerProforma`, `lireProforma`, `editerProforma`.
- **Pour Dev B (rapports B14, A14)** : un retour est une vente **terminée** de `type = 'retour'` en
  **négatif** (lignes, totaux, paiement) — le soustraire pour la marge, ou filtrer `type = 'ticket'` pour
  les ventes brutes ; une destruction apparaît en `casse`. Une facture et une proforma **ne créent aucune
  vente**.
- **Demandé à Dev B** (`src/shared/audit.ts`, toujours pas fait) : libellés de `mouvement_caisse`,
  `annulation_mouvement_caisse` (A8), `retour_client` (clés `numeroRetour`, `ticketOrigine`, `montant`,
  `mode`, `motif`, `sort`, `autoriseeParId`), `facture` (`numero`, `numeroTicket`, `client`, `montant`),
  `edition_facture` (`sortie`, `copie`), `proforma` (`numero`, `montant`, `client`).
- Attendu de Dev B : rien.

## 2026-10-13 — a/caisse-mouvements, a/caisse-fefo, a/caisse-annulation(-ecran) — A8, A9, A6 (et rattrapage A5)
**Fait** :
- **Rattrapage A5** (session du 2026-10-01, sans entrée de carnet) : PR #30 fusionnée. Remises sur
  ligne et sur ticket contrôlées côté serveur, plafond sur le **total** des remises du ticket
  (non renseigné = gérant obligatoire, D-A3), code du gérant tapé sur la caisse → accord à usage
  unique (`caisse:gerants`, `caisse:autoriserRemise`), TVA de la remise ticket au prorata des taux,
  lignes retirées journalisées (`caisse:journaliserAnnulationLigne`). Règles : `REGLES_METIER` § 6.6.
  Reste la **partie 3** : performance sur le terminal (scan → ligne < 1 s) et recette Phase 1 avec Dev B.
- **A8 Mouvements de caisse — ✅** (PR #55 serveur, #56 écran). Règles validées par Dev A,
  `REGLES_METIER` § 6.10 et § 1.4 :
  - apport / retrait / « Autre » saisis par le **gérant**, motif en clair obligatoire (imprimé sur
    le X et le Z), journal `mouvement_caisse` ;
  - une seule caisse ouverte → prise d'office ; plusieurs → le gérant choisit ;
  - **une sortie ne dépasse jamais les espèces théoriques** du tiroir (vaut aussi pour les dépenses) ;
  - correction = **contre-mouvement** lié (`mouvement_origine_id`), motif, journal
    `annulation_mouvement_caisse`, une fois, tant que la session est ouverte ;
  - tiroir ouvert après la transaction ; en panne, le mouvement reste et l'écran le dit.
  - Migration `20261008_1704_mouvements_caisse.sql` : table recréée (motif `reglement_fournisseur`
    ajouté pour Dev B, `mouvement_origine_id`), triggers : ni UPDATE ni DELETE, **aucun INSERT sur une
    session clôturée** (le garde-fou noté en A4 est fait).
  - Écran : bouton « Espèces du tiroir » (gérant) dans la caisse → `FenetreTiroir.tsx`.
  - **Sauvegarde après chaque clôture** branchée (`sauvegarderEnFond('cloture')` dans
    `caisse/ipc.ts`, demande de Dev B, B16).
  - Journal : clés sans suffixe « Id » (`session`, `document`, `contreMouvement`), sinon le journal
    de B14 les affiche comme des noms d'utilisateur.
- **A9 FEFO à la vente — 🔄, PR ouverte** (`a/caisse-fefo`, commit `243f1e4`, non fusionnée). Règles
  validées, `REGLES_METIER` § 6.3 : `allouerFefo` (Dev B) ligne après ligne dans la transaction, un
  mouvement `vente` par lot au CUMP ; `lignes_vente.lot_id` = le lot s'il est unique, sinon NULL (les
  mouvements font foi) ; si une part sort sans lot alors qu'un lot **périmé** a encore du stock →
  bandeau à la caisse (`VenteEnregistree.alertesPeremption`). 8 tests ; essai manuel validé par Dev A.
  Script d'essai hors dépôt pour vieillir un lot : une réception refuse une date passée.
- **A6 Annulation de ticket — 🔄, deux PR ouvertes** :
  - PR 1 `a/caisse-annulation` (commit `00827f1`) : `service-annulation.ts`, canaux
    `caisse:consulterTicket` et `caisse:annulerTicket`. Règles validées, `REGLES_METIER` § 6.7 :
    **seulement un ticket d'une caisse encore ouverte** (après clôture → retour client A7) ; gérant
    connecté, ou caissière sur sa caisse avec le **code du gérant** (vérifié HORS transaction : un code
    faux reste compté) ; statut `annulee` + motif, `contrePasser` de chaque mouvement, un paiement
    inverse par paiement (somme = 0), journal `annulation_ticket` ; tiroir ouvert s'il y a des espèces
    à rendre ; réimpression avec « TICKET ANNULÉ » et le motif, jamais de tiroir. 9 tests.
  - PR 2 `a/caisse-annulation-ecran` (commit `f072cda`, **empilée sur la PR 1**) : bouton
    « Annuler un ticket » → `FenetreAnnulation.tsx`, logique pure `annulation.ts`, 4 tests. Essai
    manuel validé par Dev A (code faux puis bon code, X à 0 ticket et 10 000 F, stock revenu, caisse
    clôturée refusée, journal).
- Sur `a/caisse-annulation-ecran` : **600 tests verts**, typecheck OK.

**En cours** : trois PR attendent la relecture de Dev B, **à fusionner dans cet ordre** :
1. `a/caisse-fefo` → `test` (A9).
2. `a/caisse-annulation` → `test` (A6 partie 1).
3. `a/caisse-annulation-ecran` (ouverte avec pour base `a/caisse-annulation`).
Plus cette PR de carnet `a/docs-carnet`, indépendante, à fusionner quand on veut.

**Prochaine étape** :
1. `git fetch` et regarder ce qui est fusionné.
   - Après la fusion de la PR 1 d'A6 (squash), rebaser la PR 2 :
     `git switch a/caisse-annulation-ecran; git rebase --onto origin/test 00827f1; npm run verifier; git push --force-with-lease`,
     puis changer sa base pour `test` sur GitHub.
   - Si A9 est fusionnée avant A6, un conflit est possible dans `ETAT_AVANCEMENT.md` (lignes A6 / A9
     voisines) : garder les deux côtés.
2. Après chaque fusion : la ligne au journal des fusions de `ETAT_AVANCEMENT.md`, A9 → ✅, A6 → ✅
   (après la PR 2), supprimer les branches (local et GitHub).
3. Puis **A7 — Retour client et remboursement** (`/tache A7`, branche `a/caisse-retour` depuis `test`
   à jour, **après** la fusion d'A6 et d'A9, dont il réutilise la contre-passation et les lots).
   Relire `REGLES_METIER` § 6.8, `UI_UX` § 5.10, `SCENARIO_REFERENCE` (jus d'ananas du T-2026-000158).
   Points à trancher avec Dev A avant le plan :
   - sur quelle caisse le remboursement : celle du jour (une session doit être ouverte) ;
   - « avoir en boutique » : il n'y a pas de table d'avoirs client avant A11 → reporter, ou noter
     seulement ;
   - lot de la boîte retournée : le relire dans les mouvements de la vente d'origine (A9) ;
   - qui valide : gérant, ou caissière avec le code du gérant comme A6 ;
   - le X et le Z : comment afficher les retours (ligne « Remboursements »).
4. A10 (facture A4 et proforma), puis Phase 3 (A11 crédit).

**Questions ouvertes** :
- **Essai sur le terminal** toujours à faire (Dev A n'a pas encore l'imprimante) : Xprinter (A3, A4,
  page de codes **D-A2**), tiroir réel (A8, A6), fenêtre de paiement sur le 15,6″, douchette réelle.
  A3 et A4 restent 🔄 jusque-là.
- D-A1 (stock négatif) et D-A3 (montant du plafond de remise) : en attente de la cliente, sans
  blocage (code du gérant en attendant).
- Le X et le Z n'affichent pas les tickets annulés de la session (ils n'en tiennent simplement pas
  compte) : à proposer à la cliente si elle veut une ligne de contrôle « Tickets annulés : 1 (8 500 F) ».
- Sur ce poste : tag local `sauvegarde-avant-rebase-a3` toujours présent (`git tag -d sauvegarde-avant-rebase-a3`).

**Contrats** :
- **Livré à Dev B (rendez-vous fin S10, PR #55)** dans `src/main/modules/caisse/service-mouvements.ts` :
  `enregistrerMouvementCaisse(db, { sessionId, utilisateurId, sens, motif, montant, commentaire,
  documentType?, documentId? })` et `annulerMouvementCaisse(db, { mouvementId, utilisateurId, motif })`,
  à appeler **dans la transaction** de la dépense ; ils ne relisent pas le rôle. `sessionOuverte(db)`
  sans utilisateur = la seule caisse ouverte, sinon `null` (choisir dans `sessionsOuvertes(db)`) ;
  avec un utilisateur, rien ne change. **Débloque B13 (source caisse) et le règlement fournisseur au tiroir.**
- **Décisions de Dev A pour Dev B** : la caissière saisit ses dépenses « caisse » dans le **menu
  Dépenses restreint** (source caisse, sa session) ; rien n'est ajouté dans l'écran Caisse. La sauvegarde
  après clôture est faite côté caisse.
- **Demandé à Dev B** : dans `src/shared/audit.ts`, ajouter les libellés de `mouvement_caisse` et
  `annulation_mouvement_caisse`, et traduire les valeurs de `sens` (entrée / sortie) et de `motif`
  (`LIBELLES_MOTIF_CAISSE` de `src/shared/caisse.ts` est réutilisable) ; sinon le journal les affiche en
  code brut.
- **Pour Dev B (rapports B14, A14)** : un ticket annulé a `statut = 'annulee'` et des paiements dont la
  somme fait 0 ; filtrer sur `statut = 'terminee'`. Contrat ajouté : `VenteEnregistree.alertesPeremption`
  (A9), sans impact.
- Consommé : `allouerFefo` (Dev B, B9) dans `enregistrerVente` (A9).

## 2026-10-01 — a/caisse-cloture — A4 Sessions de caisse, rapports X et Z
**Fait** :
- **Partie 1 (serveur, commit `238a185`, travail du 2026-09-25)** : `modules/caisse/service-cloture.ts`
  (rapport relu en base, clôture en une transaction, droits), `materiel/rapport.ts` (X et Z en
  48 colonnes, réutilise `mettreEnPage` désormais exporté par `materiel/ticket.ts`), canaux
  `caisse:sessionsOuvertes` (gérant), `caisse:rapportSession`, `caisse:cloturerSession`,
  `caisse:imprimerRapport`. **Règles validées par Dev A**, écrites dans `REGLES_METIER.md` § 6.9 :
  la caissière clôture sa session, le gérant (et l'admin) n'importe laquelle ; écart non nul =
  commentaire obligatoire ; espèces théoriques = fond + part espèces des tickets terminés + entrées −
  sorties, recalculées par le principal ; Z : 1re impression réussie = original, puis DUPLICATA
  (journal `impression_rapport_z`) ; X « Provisoire », non journalisé ; journal
  `cloture_session_caisse`. Cas de référence 58 700 / compté 58 200 → −500 testé.
- **Partie 2 (écran, commit `0bdae99`)** : `PageClotureCaisse.tsx` (route `/cloture`, menu
  « Clôture de caisse ») : 4 totaux par mode, espèces théoriques ligne à ligne, saisie du compté,
  écart coloré en direct (rouge manque, ambre surplus, vert juste), commentaire exigé, fenêtre de
  confirmation, « Imprimer le rapport X », « Clôturer et imprimer le Z », vue « Caisse clôturée »
  avec « Réimprimer le Z » (bandeau si l'imprimante échoue, la clôture reste enregistrée). Gérant :
  choisit la caisse si plusieurs sont ouvertes. Bouton « Clôturer la caisse » dans l'écran Caisse,
  refusé tant qu'un ticket est en cours ou en attente. `cloture.ts` (logique pure de l'écart, testée).
  Une session clôturée garde le théorique figé à la clôture (testé). Précisions dans `UI_UX.md` § 5.4.
- `/verifier` : aucun manquement. Branche **rebasée sur `test`** (B3 à B8 de Dev B ; un seul conflit
  dans le journal des fusions, deux côtés gardés), `npm install` (dépendance `xlsx` de B3),
  **355 tests verts**, poussée. Essais manuels de la clôture faits par Dev A.

**En cours** : A4 🔄 — **PR vers `test` à ouvrir à la main** (`gh` absent du poste) :
https://github.com/ryckos/pos-boutique/compare/test...a/caisse-cloture?expand=1 , titre
`feat(caisse): clôture de caisse, rapports X et Z (A4)` ; le texte a été donné à Dev A dans la session.

**Prochaine étape** :
1. Après fusion de la PR : A4 reste 🔄 (comme A3) jusqu'à l'**impression réelle du Z** sur la Xprinter ;
   ajouter la ligne au journal des fusions de `ETAT_AVANCEMENT.md` ; supprimer la branche.
2. **Essai terminal** (dès que Dev A a l'imprimante) : tout le programme de l'entrée A3 ci-dessous
   (page de codes D-A2, ticket, tiroir, panne) **plus** rapport X, clôture, Z puis « Réimprimer le Z »
   = DUPLICATA. Puis A3 et A4 → ✅.
3. Ensuite **A5 — Remises, droits, stabilisation** (`/tache A5`, branche `a/caisse-remises` depuis
   `test`). Bloquant : **D-A3 (plafond de remise du caissier)** à obtenir de la cliente avant de coder
   le plafond ; le reste (remise ligne / ticket en FCFA, journalisée) peut avancer.
4. **À ne pas oublier en A8** : `enregistrerMouvementCaisse()` devra **refuser une session clôturée**
   (« Cette caisse est clôturée : ouvrez une nouvelle session »), avec un test. Aujourd'hui rien ne
   garde `mouvements_caisse` : un test de `caisse-cloture.test.ts` écrit un retrait après la clôture
   (le Z reste juste grâce au théorique figé, mais l'écriture ne devrait pas être possible).
   Dev B appellera cette fonction pour les dépenses (B13).

**Questions ouvertes** :
- Essai terminal : Xprinter (A3, A4, D-A2), fenêtre de paiement sur le 15,6″, douchette réelle (A1.1).
- D-A1 (stock négatif), D-A3 (plafond remise, bloque une partie d'A5) : inchangées.
- Rappel à Dev B : fichier temporaire `electron.vite.config.1790196666553.mjs` toujours versionné.
- Sur ce poste : tag local `sauvegarde-avant-rebase-a3` encore présent (`git tag -d sauvegarde-avant-rebase-a3`).

**Contrats** : ajoutés (Dev A, ajouts seulement, aucun impact sur Dev B) : `caisse:sessionsOuvertes`,
`caisse:rapportSession`, `caisse:cloturerSession`, `caisse:imprimerRapport`. Pour Dev B (B13) : une
session clôturée est figée par le service, sans trigger ; la garde de `mouvements_caisse` viendra avec
`enregistrerMouvementCaisse()` (A8, fin S10). Rien d'attendu de Dev B pour A5.

## 2026-09-24 (fin) — a/caisse-ticket — A3 Ticket, tiroir, réglages matériel
**Fait** :
- A1.2 fusionnée (PR #15) et passée à ✅. D-A2 : personne ne se souvient du résultat de T2 →
  page de codes en **réglage modifiable**, `cp858` **provisoire**, test à faire sur le terminal
  (noté dans `DECISIONS.md`).
- Partie 1 (`d5d9ba3`) : `materiel/ticket.ts` (ticket 48 colonnes : en-tête provisoire, lignes,
  TOTAL double taille, TVA ventilée, paiements + références, espèces reçues, monnaie, DUPLICATA) ;
  `modules/caisse/service-ticket.ts` (relecture en base, original/duplicata par le journal,
  droits) ; `materiel/reglages.ts` (fichier local `materiel.json`) ; canaux `caisse:imprimerTicket`,
  `caisse:reimprimerTicket`, `materiel:lireReglages`, `materiel:enregistrerReglages`. Impression
  lancée APRÈS la vente, tiroir dans le même envoi si espèces ; échec = bandeau persistant
  « ticket non imprimé » + Réimprimer / Plus tard. **Encodeur corrigé** : `€` en cp1252, tiret long
  et espaces fines translittérés (sinon « ? » sur chaque ticket de carton).
- Partie 2 : page « Réglages matériel » (`modules/reglages-materiel/`, gérant) : imprimante
  détectée ou saisie, méthode, page de codes, **trois boutons de ticket de test** (cp858, cp1252,
  cp437), ouverture du tiroir ; « Réimprimer un ticket » par numéro dans la caisse.
- **Règles validées par Dev A**, écrites dans `REGLES_METIER.md` § 6.3 et § 13 : 1re impression
  réussie = original, ensuite DUPLICATA ; caissière = tickets de sa session, gérant = tous ; tiroir
  seulement pour l'original d'une vente avec espèces.
- 177 tests (16 nouveaux), build OK ; essais sans imprimante validés par Dev A (droits, réglages,
  erreurs claires, réimpression, refus pour la caissière).

**En cours** : A3 🔄 — PR vers `test` à ouvrir. **Essai sur le terminal en attente** : l'imprimante
n'est pas disponible pour l'instant, Dev A préviendra.

**Prochaine étape** :
1. Après fusion de la PR : garder A3 🔄 jusqu'à l'essai terminal (ne pas passer à ✅ avant).
2. **Essai sur le terminal**, dès que Dev A a l'imprimante :
   - Réglages matériel (Kossi `5678`) : choisir la Xprinter, imprimer les 3 tickets de test,
     garder la page où « éèêàçùôî ÉÇ € » est juste ;
   - reporter le résultat dans `DECISIONS.md` (D-A2 → décision prise) et changer
     `PAGE_DE_CODES_PAR_DEFAUT` dans `materiel/reglages.ts` si ce n'est pas cp858 ;
   - vente espèces : ticket en < 3 s, accents, coupe, tiroir ouvert ; imprimante débranchée =
     vente enregistrée + bandeau ; Réimprimer = original puis DUPLICATA ;
   - vérifier aussi la fenêtre de paiement sur le 15,6″ et la douchette (20 scans).
   Puis A3 → ✅.
3. En attendant l'imprimante : **A4 — Sessions de caisse, rapports X et Z** (`/tache A4`, branche
   `a/caisse-cloture` depuis `test`). L'ouverture de session existe déjà (A2) ; reste clôture,
   espèces théoriques (test : 10 000 + 46 200 + 3 500 − 1 000 = 58 700, compté 58 200 → −500),
   écart coloré, X, impression du Z (réutiliser `materiel/ticket.ts` et `envoyerBrut`).

**Questions ouvertes** :
- Essai terminal : Xprinter (A3, D-A2), fenêtre de paiement sur 15,6″, douchette réelle (A1.1).
- Rappel à Dev B : fichier temporaire `electron.vite.config.1790196666553.mjs` toujours versionné.
- D-A1 (stock négatif), D-A3 (plafond remise, pour A5) : inchangées.

**Contrats** : ajoutés (Dev A) : `caisse:imprimerTicket`, `caisse:reimprimerTicket`,
`materiel:lireReglages`, `materiel:enregistrerReglages`.

**Suite (2026-09-25)** : `test` avait avancé (B2.3, B5 de Dev B). Branche **rebasée** sur `origin/test`
(conflits de doc, routes et styles résolus en gardant les deux côtés ; 210 tests verts), puis
**paramètres de B5 branchés** : en-tête et pied du ticket = `boutique_nom`, `boutique_adresse`,
`ticket_pied` (« Ma Boutique » si le nom manque) ; réglages de l'imprimante = clés `imprimante_*`
via `ecrireParametres` de Dev B (droits gérant, journal `modification_parametre`) ; **le fichier
`materiel.json` et l'en-tête en dur sont supprimés**. Page de codes vide = `cp858` provisoire (D-A2).
Sur le poste de Dev A, l'imprimante de test « XP-TEST » saisie avant est à ressaisir (elle vivait
dans `materiel.json`). 212 tests verts. **PR #18 fusionnée dans `test` le 2026-09-25** ; A3 reste 🔄
jusqu'à l'essai terminal. La constante à changer si la page n'est pas cp858 s'appelle désormais
`PAGE_DE_CODES_PAR_DEFAUT` (`materiel/reglages.ts`). Tag local `sauvegarde-avant-rebase-a3` à
supprimer (`git tag -d sauvegarde-avant-rebase-a3`).

## 2026-09-24 (suite) — a/caisse-onglets — A1.2 Grille, conditionnement (partie 2)
**Fait** :
- A2 fusionnée (PR #14) et passée à ✅ (commit `378bd39` en tête de cette branche).
- `modules/caisse/grille.ts` (pur) : `ongletsDeGrille`, `filtrerGrille`, `afficherOnglets`.
  **Choix validés par Dev A** : onglets affichés dès deux rayons ; « Tout » d'abord (par défaut),
  rayons par ordre alphabétique français, « Sans rayon » en dernier pour les non classés. Onglets
  **sous** la grille, comme la maquette validée (UI_UX § 5.2) ; l'onglet choisi reste actif d'une
  vente à l'autre ; filtre local, aucune requête.
- `FenetreConditionnement.tsx` : bouton « Changer le conditionnement » sur la ligne sélectionnée →
  `catalogue:conditionnementsProduit` (Dev B) → liste avec prix, l'actuel marqué ; un toucher applique
  `changerConditionnement` (quantité gardée, fusion si déjà au ticket). « Ce produit ne se vend qu'à
  l'unité » s'il n'y a qu'un conditionnement. Douchette et raccourcis coupés pendant la fenêtre.
- `styles.css` (zone partagée) : `.caisse-onglet*`, `.conditionnement-*` ; `.ticket-actions` passe à la ligne.
- 6 tests (`tests/grille.test.ts`), 161 au total, build OK ; essai manuel validé par Dev A
  (onglets, 2 unités → 2 cartons 15 000 F, fusion 3 cartons 22 500 F, baguette à l'unité).

**En cours** : A1.2 🔄 — PR « partie 2 » vers `test` à ouvrir ; A1.2 → ✅ après fusion.

**Prochaine étape** :
1. Après fusion : A1.2 ✅ + ligne au journal des fusions ; supprimer la branche.
2. **A3 — Ticket, tiroir, réglages matériel** (`/tache A3`, branche `a/caisse-ticket` depuis `test`) :
   **demander d'abord à Dev A la page de codes gagnante du test T2 (D-A2)** ; ticket 48 colonnes via
   `materiel/escpos.ts`, imprimé APRÈS `enregistrerVente` ; tiroir à chaque encaissement espèces ;
   imprimante en panne = « Vente enregistrée, ticket non imprimé » + Réimprimer ; réimpression
   « DUPLICATA » ; écran Réglages matériel (gérant). `parametres:lire` pas encore livré par Dev B :
   en-tête en dur et configuration locale en attendant.

**Questions ouvertes** :
- Essai à la vraie douchette et affichage de la fenêtre de paiement sur le 15,6″ du terminal : sur site.
- Rappel à Dev B : fichier temporaire `electron.vite.config.1790196666553.mjs` toujours versionné.
- D-A1, D-A2 (bloque A3), D-A3 : inchangées.

**Contrats** : aucun modifié. `categorie` et `conditionnementsProduit` (Dev B) désormais utilisés.

## 2026-09-24 — a/caisse-paiement — A2 Encaissement (partie 2 : écrans)
**Fait** :
- Début de session : `test` à jour (140 tests). Contrats de Dev B arrivés : `categorie` (PR #8),
  `catalogue:conditionnementsProduit` (PR #10). Nouvelle règle de Dev B : formulaires en
  `ui/FenetreFormulaire.tsx` (les fenêtres de caisse F2 et paiement gardent `.voile`/`.fenetre`).
- `OuvertureCaisse.tsx` : sans session, « Caisse fermée » + « Ouvrir la caisse » (fond saisi dans
  `FenetreFormulaire`, `caisse:ouvrirSession`). `PageCaisse` lit `caisse:sessionCourante` au chargement.
- `paiement.ts` (logique pure) + `FenetrePaiement.tsx` sur deux colonnes. **Choix validés par Dev A
  après essai** (écrits dans `UI_UX.md` § 5.3) : espèces = toujours le reste (seuls TMoney/Flooz se
  saisissent) ; un seul champ espèces « Montant reçu du client » ; billets additionnés ; reçu vide =
  montant exact ; F4 puis Entrée encaisse ; sélection du contenu au toucher d'un champ de montant.
- `PageCaisse` : boutons Espèces/TMoney/Flooz actifs (Crédit jusqu'à A11), F4, douchette et
  raccourcis coupés pendant le paiement, message « Vente T-… enregistrée. Monnaie à rendre : … »,
  bandeau ambre `alertesStock` (D-A1).
- **Deux bogues trouvés à l'essai et corrigés** (tests de non-régression dans `tests/paiement.test.ts`) :
  ligne TMoney ajoutée à 0 F qui laissait encaisser en espèces seules ; frappe ajoutée au montant
  existant (« 8500 » + « 5000 »). Le service n'a jamais rien enregistré d'incohérent (vérifié en base).
- 15 tests de paiement, 155 au total, build OK. Essais manuels 1 à 8 validés par Dev A.

**En cours** : A2 🔄 — PR « partie 2 » vers `test` à ouvrir. A2 → ✅ et journal des fusions après fusion.

**Prochaine étape** :
1. Après fusion : A2 ✅ + ligne au journal des fusions ; supprimer la branche.
2. **A1.2 partie 2** (branche `a/caisse-onglets` depuis `test`), les deux contrats sont arrivés :
   - onglets de catégories au-dessus de la grille : « Tout » + un par `categorie` (nom du rayon,
     `null` = « Autres »), filtre local, pas de nouvelle requête ;
   - bouton « Changer le conditionnement » dans `.ticket-actions` de la ligne sélectionnée →
     `catalogue:conditionnementsProduit { produitId }` → petite fenêtre `.voile`/`.fenetre` listant les
     conditionnements → action `{ type: 'changerConditionnement', ancienId, article }` (déjà prête).
   Puis A1.2 → ✅.
3. Ensuite **A3** (ticket ESC/POS, tiroir, réglages) : demander à Dev A la page de codes D-A2 ;
   `parametres:lire` attendu de Dev B (fin S5), en attendant en-tête en dur.

**Questions ouvertes** :
- Essai à la vraie douchette sur le terminal (A1.1) et **affichage de la fenêtre de paiement sur le
  15,6″ réel** (tient-elle sans défiler ?) : à vérifier sur site.
- Signalé à Dev B : fichier temporaire `electron.vite.config.1790196666553.mjs` versionné par
  `be2635f`, à supprimer et à ignorer (`.gitignore`).
- D-A1 (stock négatif), D-A2 (page de codes), D-A3 (plafond remise) : inchangées.

**Contrats** : aucun modifié. Reçus : `categorie` et `conditionnementsProduit` (Dev B).

## 2026-09-23 (fin) — a/caisse-encaissement — A2 Encaissement (partie 1 : serveur)
> **Entrée restaurée** : perdue lors de la résolution de conflit de la PR #7 (fusionnée), remise en place
> par `/verifier`. Branche créée depuis `test` **avant** la fusion de la PR A1.2 (`a/caisse-grille`, entrée de carnet
> « A1.2 partie 1 » sur cette branche-là). Au rebase, garder les deux entrées, celle-ci en haut.

**Fait** :
- **Décision validée par Dev A** : le minimum des sessions de caisse est avancé d'A4 à A2, car
  `ventes.session_caisse_id` est obligatoire (règle 6.1 : aucune vente sans session). Pas de session
  automatique. A4 garde clôture, X, Z.
- Contrat `src/shared/ipc/caisse.ts` : `caisse:sessionCourante`, `caisse:ouvrirSession
  { fondOuverture }`, `caisse:enregistrerVente` (`RequeteVente` → `VenteEnregistree` avec
  `alertesStock`). Rôles caissier et gérant. Modes acceptés : `especes`, `tmoney`, `flooz`
  (**crédit refusé jusqu'à A11**, validé par Dev A).
- `calculs.ts` : `ventilerTva()` par taux (seul arrondi).
- `service-session.ts` : `sessionOuverte(db, utilisateurId)`, `ouvrirSession()` (une seule ouverte,
  fond entier ≥ 0, journalisée `ouverture_session_caisse`).
- `service-vente.ts` : `enregistrerVente(db, utilisateurId, requete)` en une `avecTransaction`
  (prix/coûts relus dans `v_catalogue_vente` + CUMP, photocopie, un mouvement `vente` par ligne,
  `lot_id` null jusqu'à A9, paiements, somme = total, référence mobile money obligatoire, espèces
  reçues ≥ part espèces, monnaie rendue). Stock négatif : vente enregistrée + `alertesStock`
  (**D-A1 non tranchée**, validé par Dev A : pas de journalisation spéciale).
- `tests/caisse-vente.test.ts` : 22 tests (TVA 11 363 / 1 937 ; vente de démo 8 500 F, HT 7 249,
  TVA 1 251, monnaie 1 500 ; tomate 72 → 46 ; marges 1 500 / 200 / 120 ; scénario 10 100 F ; refus
  et rollback complet, numéro non consommé). 86 tests au total, build OK.
- Commits `20f9225`, `1d108fb`.

**En cours** : A2 🔄 — PR « partie 1 » vers `test`. A1.2 partie 1 aussi en PR (non fusionnée).

**Prochaine étape** :
1. Dès que la PR A1.2 est fusionnée : `git fetch && git rebase origin/test` sur cette branche
   (conflits attendus seulement dans `ETAT_AVANCEMENT.md` et ce carnet : garder les deux versions).
2. **A2 partie 2** (même branche si la PR 1 n'est pas encore fusionnée, sinon nouvelle branche
   `a/caisse-paiement` depuis `test`) :
   - au chargement de `PageCaisse` : `caisse:sessionCourante` ; sans session, n'afficher que
     « Ouvrir la caisse » (saisie du fond, `caisse:ouvrirSession`) — UI_UX § 5.2 ;
   - `FenetrePaiement.tsx` (UI_UX § 5.3), en réutilisant `.voile` / `.fenetre` de la PR A1.2 :
     billets 1 000 / 2 000 / 5 000 / 10 000 + « Montant exact », monnaie à rendre en très grand,
     référence obligatoire TMoney/Flooz, paiement mixte avec « Reste à payer », bouton « Encaisser » ;
     ouverte par les boutons Espèces/TMoney/Flooz et par F4 (`case 'encaisser'` déjà prévu) ;
   - envoi `{ lignes: [{ conditionnementId, quantite }], paiements, montantRecu }` ; au succès,
     vider le ticket et afficher « Vente T-… enregistrée. Monnaie à rendre : … » ; afficher
     `alertesStock` en bandeau ambre ; l'impression et le tiroir restent pour A3.
   Puis A2 → ✅ et contrat `caisse:enregistrerVente` → ✅.

**Questions ouvertes** :
- Essai à la vraie douchette sur le terminal (A1.1) : toujours à faire.
- D-A1 (stock négatif), D-A2 (page de codes, à demander avant A3), D-A3 (plafond remise) : inchangées.

**Contrats** :
- **Livré en lecture pour Dev B** : `caisse:enregistrerVente`, modèle de transaction
  (`service-vente.ts`). `sessionOuverte(db, utilisateurId)` existe déjà ; attention, Dev B attend
  pour B13 une forme **sans** utilisateur (`sessionOuverte(db)`, fin S10) : à discuter en A8.
- Attendus inchangés : `catalogue:conditionnementsProduit` (fin S4), `categorie` dans
  `ArticleCatalogue` (avec B2.1), `parametres:lire` (fin S5).

## 2026-09-23 (suite) — a/caisse-grille — A1.2 Grille, recherche, conditionnement, attente (partie 1)
**Fait** :
- A1.1 fusionnée (PR #3) et passée à ✅. Correctif des droits demandé par la revue de Dev B fusionné
  (PR #5) : `materiel:imprimantes` exige gérant, `materiel:ouvrirEcranClient` exige une session.
  Contrat « contrôle des rôles » passé à ✅.
- A1.2 partie 1 (2 commits `ae66392`, `e0b9a3e`) :
  - `modules/caisse/attente.ts` : tickets en attente (`mettreEnAttente`, `reprendre`, `resumeAttente`,
    `reducteurCaisse`). **Choix validés par Dev A** : reprendre un ticket alors que le courant est
    rempli **permute** les deux ; ticket courant et tickets en attente gardés **en mémoire par
    caissière** (Map au niveau du module de `PageCaisse`), survivent au changement d'écran et à la
    déconnexion, perdus à la fermeture de l'application, jamais en base.
  - `modules/caisse/clavier.ts` : F2 recherche, F4 encaisser (sans effet avant A2), F8 attente,
    Suppr, Échap (désélectionne), + / −. Ignorés dans les champs et quand la recherche est ouverte.
  - `FenetreRecherche.tsx` : nombre tapé → `catalogue:rechercherCode` d'abord (PLU `101` = baguette),
    sinon `catalogue:rechercher` ; 200 ms après la dernière frappe ; flèches, Entrée, Échap.
  - `changerConditionnement()` dans `panier.ts` (quantité conservée, fusion si déjà au ticket, refus si
    autre produit) : **logique et tests seulement**, pas de bouton tant que le canal de Dev B manque.
  - `styles.css` (zone partagée) : `.caisse-recherche`, `.caisse-ticket-actions`, `.attente-*`,
    `.voile`, `.fenetre*`, `.recherche-*`, nouveau jeton `--voile`.
  - 12 tests de plus (76 au total), build OK, essai manuel concluant (recherche, attente, raccourcis,
    mémoire, vente mixte < 15 s).

**En cours** : A1.2 🔄 — PR « partie 1 » vers `test` ouverte / en relecture par Dev B.

**Prochaine étape** :
1. Faire fusionner la PR partie 1 (relecture Dev B). Supprimer la branche.
2. **Partie 2** dès qu'un des contrats de Dev B arrive dans `test` (nouvelle branche depuis `test`,
   ex. `a/caisse-conditionnement`) :
   - `catalogue:conditionnementsProduit` → bouton « Changer le conditionnement » dans
     `.ticket-actions` de la ligne sélectionnée ; petite fenêtre listant les conditionnements ; action
     `{ type: 'changerConditionnement', ancienId, article }` déjà prête dans le réducteur.
   - `categorie` dans `ArticleCatalogue` → onglets de catégories au-dessus de la grille (« Tout » +
     une par catégorie), filtre local sans nouvelle requête.
   Puis A1.2 → ✅.
3. En attendant les contrats : démarrer **A2 — Encaissement et `caisse:enregistrerVente`** (`/tache A2`),
   rendez-vous à livrer à Dev B fin S5.

**Questions ouvertes** :
- Essai à la vraie douchette sur le terminal (A1.1) : toujours à faire.
- D-A1, D-A2, D-A3 : inchangées.

**Contrats** :
- Demandé à Dev B (2026-09-23) : `categorie: string | null` dans `ArticleCatalogue` (au moins dans
  `catalogue:grille`), avec B2.1 ; ordre alphabétique suffisant, `ordreCategorie` bienvenu.
  Ligne ajoutée aux rendez-vous de `ETAT_AVANCEMENT.md`.
- Rappel fin S4 : `catalogue:conditionnementsProduit` attendu sous la forme
  `{ requete: { produitId: number }; reponse: ArticleCatalogue[] }`, unité en premier.
- Aucun contrat livré ni modifié par Dev A.
