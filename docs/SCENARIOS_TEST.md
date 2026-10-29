# Scénarios de test de bout en bout — par utilisateur et par cas d'utilisation

Ce cahier sert à **tester l'application à la main**, écran par écran, avec les trois personnes de la
boutique : la caissière, le gérant et l'administratrice (la patronne). Chaque test dit qui se connecte,
ce qu'il faut préparer, les gestes à faire et ce qu'on doit voir. Les chiffres attendus sont calculés
**au franc près** à partir de la base de démonstration.

Il complète `SCENARIO_REFERENCE.md` (la semaine de référence de la recette) sans le remplacer.

---

## 0. Avant de commencer

### 0.1 Une base neuve pour chaque campagne de test

Les chiffres attendus supposent une **base de démonstration neuve**, et les tests de la partie 5
joués **dans l'ordre**. Dans PowerShell, à la racine du projet :

```powershell
$env:POS_DB = "$env:TEMP\recette.db"
Remove-Item $env:POS_DB* -ErrorAction SilentlyContinue   # repartir de zéro
npm run dev                                              # la démo se crée au premier lancement
# À la fin : Remove-Item Env:POS_DB
```

### 0.2 Les personnes

| Personne | Rôle         | Code   | Menu attendu |
|----------|--------------|--------|--------------|
| **Afi**  | caissière    | `0000` | Caisse, Clôture de caisse, Mon code |
| **Kossi**| gérant       | `5678` | Tout, **sauf** Comptes utilisateurs, Journal des opérations, Paramètres |
| **Patron**| administratrice | `1234` | Tout |

### 0.3 Les données de démonstration

| Produit                 | Rayon        | TVA  | Stock | Coût moyen | Conditionnements (prix, code) |
|-------------------------|--------------|------|-------|-----------:|-------------------------------|
| Riz parfumé 5 kg        | Alimentation | 18 % | 20    | 3 200 | Unité 4 500 F, `6181000000011` |
| Lait en poudre 400 g    | Alimentation | 18 % | 12, lot DEMO-01 (périme dans 10 j) | 2 100 | Unité 2 800 F, `6181000000028` |
| Tomate concentrée 70 g  | Alimentation | 18 % | 72    | 250   | Unité 350 F `6181000000042` · Lot de 3 1 000 F `2000000000015` (bouton) · Carton de 24 7 500 F `16181000000049` (bouton) |
| Jus d'ananas 1 L        | Boissons     | 18 % | 18, lot DEMO-01 (10 j) | 420 | Unité 600 F `6034000012345` · Pack de 6 3 300 F (bouton) |
| Baguette                | Boulangerie  | 0 %  | 40    | 180   | Unité 300 F, PLU `101` (bouton) |
| Gari (sachet)           | Alimentation | 0 %  | 25    | 350   | Unité 500 F, PLU `205` (bouton) |
| Savon de ménage         | Entretien    | 18 % | 30    | 150   | Unité 250 F, `6181000000035` |

Fournisseur : **Grossiste Hédzranawoé**, délai de paiement 15 jours.
Plafond de remise de la caissière : **non renseigné** (toute remise de la caissière demande le code
du gérant, D-A3).

### 0.4 Scanner sans douchette

Sur un poste de développement, la douchette se remplace par : **les boutons tactiles**, la recherche
**F2** (par nom ou par PLU), ou un code tapé dans un champ qui accepte le scan, suivi d'Entrée.
L'essai à la vraie douchette se fait sur le terminal (partie 7).

### 0.5 Noter le résultat

Pour chaque test : **OK**, ou **KO** avec ce qu'on a vu à la place (capture d'écran si possible). Un
KO sur un chiffre attendu est toujours bloquant.

| Repère | Signification |
|--------|---------------|
| AFI-…  | Cas d'utilisation de la caissière |
| KOS-…  | Cas d'utilisation du gérant |
| PAT-…  | Cas d'utilisation de l'administratrice |
| TRV-…  | Tous les utilisateurs : ergonomie, droits, robustesse |
| SEM-…  | La semaine complète, enchaînée (partie 5) | ☐ OK ☐ KO |
| DEP-…  | Installation, mises à jour et retour arrière (partie 6) |
| TER-…  | Sur le terminal de la boutique (partie 7) | ☐ OK ☐ KO |

### 0.6 Fiche de la campagne

À remplir en tête de chaque campagne : un résultat n'a de sens que pour une version donnée.

| Rubrique | À remplir |
|----------|-----------|
| Date | |
| Testeur | |
| Version de l'application (ou commit, branche) | |
| Poste (développement, PC de test, terminal) | |
| Base utilisée (démo neuve, copie de la base de la cliente…) | |
| Tests joués | |
| Résultat : nombre de OK / KO | |
| KO bloquants (repères) | |

Une version Word de ce cahier, à imprimer et remplir à la main, est tenue à jour dans
`docs/SCENARIOS_TEST.docx` (`python scripts/md_vers_docx.py docs/SCENARIOS_TEST.md
docs/SCENARIOS_TEST.docx "Scénarios de test — Ma Boutique POS"`).

---

## 1. Tous les utilisateurs

### TRV-01 — Se connecter et se déconnecter
- **Étapes** : toucher son nom, taper son code ; puis « Se déconnecter » en bas du menu.
- **Attendu** : les noms des comptes actifs, par ordre alphabétique. Après le code juste, le menu de
  son rôle (tableau 0.2). La déconnexion ramène à la liste des noms. Se déconnecter **ne ferme pas**
  la caisse ouverte.
- **Résultat** : ☐ OK ☐ KO — remarque :

### TRV-02 — Code faux et verrouillage du compte
- **Étapes** : toucher « Afi », taper 5 fois un code faux (`1111`), puis le bon code `0000`.
- **Attendu** : à chaque erreur, un message clair. Après la 5ᵉ, le compte est **verrouillé 30 s** :
  même le bon code est refusé pendant ce temps. Kossi peut se connecter pendant ce temps (les autres
  comptes ne sont pas bloqués). Après 30 s, `0000` ouvre la session et remet le compteur à zéro.
  Un code de moins de 4 chiffres ne compte pas comme une tentative.
- **Résultat** : ☐ OK ☐ KO — remarque :

### TRV-03 — Changer son code (« Mon code »)
- **Étapes** (Afi) : « Mon code », code actuel `0000`, nouveau `2468` deux fois, « Changer mon
  code ». Se déconnecter, se reconnecter avec `2468`. Remettre `0000` de la même façon.
- **Attendu** : `0000` est refusé tant que le code est `2468`. Un code actuel faux est refusé (et
  compte pour le verrouillage).
- **Résultat** : ☐ OK ☐ KO — remarque :

### TRV-04 — Droits : ce que chacun ne voit pas
- **Étapes** : se connecter tour à tour avec Afi, Kossi et Patron, et parcourir le menu.
- **Attendu** : le tableau 0.2 exactement. Afi n'atteint aucune page de gestion. Kossi ne voit ni
  Comptes, ni Journal, ni Paramètres ; sur « Sauvegardes », il ne voit ni « Restaurer » ni le choix de
  la clé USB.
- **Résultat** : ☐ OK ☐ KO — remarque :

### TRV-05 — Icônes, infobulles et aide « ? »
- **Pré-requis** : une dette chez le Grossiste (KOS-09), sinon l'icône « Payer » n'apparaît pas.
- **Étapes** (Kossi, page Fournisseurs) :
  1. survoler chaque icône d'une ligne à la souris ;
  2. sur l'écran tactile, garder le doigt appuyé sur une icône ;
  3. faire un appui bref sur l'icône « Dettes » ;
  4. toucher le « ? » à droite du titre, puis toucher ailleurs ; le rouvrir et appuyer sur Échap.
- **Attendu** :
  1. une infobulle avec un verbe et le nom du fournisseur (« Payer « Grossiste Hédzranawoé » ») ;
  2. l'infobulle apparaît et **rien ne s'ouvre** ;
  3. la fenêtre Dettes s'ouvre ;
  4. la légende liste les icônes de la page avec leur fonction (Désactiver en rouge) ; elle se ferme
     au toucher à côté, et à Échap. Dans une fenêtre (Dettes), Échap ferme **la légende seulement**.
- Les icônes d'une ligne de tableau restent **sur une seule ligne**. Une icône indisponible (« Promo »
  des Péremptions) est grisée mais son infobulle dit pourquoi.
- **Résultat** : ☐ OK ☐ KO — remarque :

### TRV-06 — Pagination des tableaux
- **Pré-requis** : une liste de plus de 20 lignes (Produits après KOS-04, Journal, ou Stock avec un
  catalogue importé).
- **Étapes** : passer d'une page à l'autre, choisir « 50 par page », taper une recherche, puis
  exporter.
- **Attendu** : « Lignes 21 à 40 sur N » ; les flèches première / précédente / suivante / dernière se
  grisent aux extrémités ; une recherche revient en page 1 ; **l'export contient toutes les lignes
  filtrées**, pas seulement la page affichée. Une liste de 10 lignes ou moins n'a pas de barre.
- **Résultat** : ☐ OK ☐ KO — remarque :

### TRV-07 — Écran étroit
- **Étapes** : réduire la fenêtre sous 1180 px de large.
- **Attendu** : le menu se replie sur ses icônes ; le nom de chaque page apparaît en infobulle ;
  l'en-tête des pages et les filtres passent à la ligne sans rien cacher ; les tableaux larges
  défilent horizontalement.
- **Résultat** : ☐ OK ☐ KO — remarque :

---

## 2. Afi — caissière

> Sauf mention contraire : Afi est connectée et sa caisse est ouverte (AFI-01).

### AFI-01 — Ouvrir sa caisse
- **Étapes** : menu « Caisse », « Ouvrir la caisse », fond de caisse **10 000**, valider.
- **Attendu** : l'écran de vente, ticket vide : « Scannez un article ou touchez un bouton pour
  commencer. » Sans caisse ouverte, aucune vente n'est possible.
- **Résultat** : ☐ OK ☐ KO — remarque :

### AFI-02 — Vente mixte de référence (scan, bouton, PLU, F2)
- **Étapes** :
  1. scanner le carton de tomate `16181000000049` ;
  2. toucher le bouton « Tomate — Lot de 3 » ;
  3. scanner deux fois l'unité de tomate `6181000000042` ;
  4. F2, taper `101` (PLU), choisir la baguette ;
  5. F2, taper `ananas`, choisir le jus d'ananas (Unité).
- **Attendu** :

  | Ligne | Montant |
  |-------|--------:|
  | Tomate — Carton de 24 (pastille « Carton de 24 ») | 7 500 |
  | Tomate — Lot de 3 (pastille) | 1 000 |
  | 2 × Tomate (unité) — le 2ᵉ scan augmente la quantité, pas de nouvelle ligne | 700 |
  | Baguette | 300 |
  | Jus d'ananas 1 L | 600 |
  | **Total** | **10 100 F** |

  La recherche ignore les accents et les majuscules (`ANANAS` trouve aussi le jus).
- **Résultat** : ☐ OK ☐ KO — remarque :

### AFI-03 — Corriger une ligne
- **Étapes** : toucher la ligne « 2 × Tomate » :
  - « + » puis « − » ;
  - « Changer le conditionnement » → « Lot de 3 », puis revenir à « Unité » ;
  - « Supprimer la ligne (Suppr) » sur une ligne ajoutée pour l'essai.
- **Attendu** : la quantité et le total suivent en direct ; le conditionnement actuel est grisé dans
  la fenêtre ; une ligne à 0 disparaît. Les actions de la ligne sont rangées en deux rangées
  (quantité et Supprimer, puis Conditionnement et Remise), toutes à la même taille.
- **Résultat** : ☐ OK ☐ KO — remarque :

### AFI-04 — Mettre un ticket en attente et le reprendre
- **Étapes** : avec le ticket d'AFI-02 en cours, F8 ; servir un autre client (une baguette) et
  l'encaisser ; puis toucher « Reprendre le ticket … ».
- **Attendu** : le ticket en attente reste affiché avec son nombre d'articles et son montant ; repris,
  il revient intact (10 100 F). Plusieurs tickets peuvent attendre en même temps.
- **Résultat** : ☐ OK ☐ KO — remarque :

### AFI-05 — Encaisser en espèces
- **Étapes** : ticket de 10 100 F, F4 (Espèces), reçu **15 000**, « Encaisser ».
- **Attendu** : monnaie à rendre **4 900 F**, en grand. Le ticket est numéroté `T-AAAA-NNNNNN`. Le
  ticket s'imprime (original) et le tiroir s'ouvre. Sur le ticket : TVA 18 % sur 9 800 F
  (HT 8 305, TVA 1 495), 0 % sur 300 F, total HT 8 605 F. Stock de tomate : 72 − 29 = **43**.
  **Noter le numéro du ticket** : il sert à AFI-10, AFI-11 et AFI-12.
- **Résultat** : ☐ OK ☐ KO — remarque :

### AFI-06 — Encaisser en mobile money et en paiement mixte
- **Étapes** :
  - ticket de 2 800 F (lait) : « TMoney », sans référence, puis avec la référence `TM12345` ;
  - ticket de 4 500 F (riz) : 2 000 en espèces + 2 500 en Flooz (référence obligatoire).
- **Attendu** : sans référence, l'encaissement est refusé avec un message qui dit de la saisir.
  Le paiement mixte n'est accepté que si la somme fait exactement le total. Le tiroir ne s'ouvre pas
  pour un ticket payé sans espèces. « Crédit » est grisé (fiche client à venir, A11).
- **Résultat** : ☐ OK ☐ KO — remarque :

### AFI-07 — Remise : plafond et code du gérant
- **Étapes** : ticket avec 1 riz (4 500 F). Toucher la ligne, « Faire une remise », 300 F.
- **Attendu** : plafond non renseigné → la remise demande le **code du gérant** ; Kossi tape `5678`
  sur la caisse d'Afi, sans la déconnecter. Le ticket affiche 4 500 − remise 300 = **4 200 F**. Un
  code faux est refusé (et compte pour le verrouillage de Kossi). Après encaissement, la remise est
  au journal, au nom d'Afi, autorisée par Kossi (vérifier en PAT-05). Voir aussi PAT-03 (plafond).
- **Résultat** : ☐ OK ☐ KO — remarque :

### AFI-08 — L'imprimante est en panne
- **Étapes** : débrancher l'imprimante (ou régler une imprimante inexistante en KOS-24), encaisser
  une baguette.
- **Attendu** : la vente est enregistrée ; bandeau « Vente enregistrée, ticket non imprimé… » avec
  « Réimprimer » et « Plus tard ». La caisse n'est **jamais bloquée**. Imprimante rebranchée,
  « Réimprimer » sort l'**original**.
- **Résultat** : ☐ OK ☐ KO — remarque :

### AFI-09 — Réimprimer un ticket (duplicata)
- **Étapes** : « Réimprimer un ticket », numéro du ticket d'AFI-05.
- **Attendu** : le ticket sort avec la mention **DUPLICATA** ; le tiroir ne s'ouvre pas. Afi ne peut
  réimprimer que les tickets de sa caisse ouverte.
- **Résultat** : ☐ OK ☐ KO — remarque :

### AFI-10 — Faire une facture
- **Étapes** : « Faire une facture », numéro court du ticket d'AFI-05 (ex. `1`), client « Société
  Agbo », puis PDF.
- **Attendu** : facture `F-AAAA-NNNNNN` avec les lignes, la TVA par taux (mêmes chiffres que le
  ticket), « Payée », et « Arrêtée la présente facture à la somme de dix mille cent francs CFA ». La
  première sortie est l'original, la suivante porte **COPIE**. Une seconde facture du même ticket est
  refusée (« rééditez-la »). Nom du client vide : refusé.
- **Résultat** : ☐ OK ☐ KO — remarque :

### AFI-11 — Proforma et reprise
- **Étapes** : panier 2 × riz ; « Proforma », client facultatif, PDF ; « Vider le ticket ». Puis
  « Reprendre une proforma », son numéro court.
- **Attendu** : proforma `PF-AAAA-NNNNNN`, « Valable jusqu'au » + 30 jours, sans vente ni mouvement de
  stock. La reprise recharge les 2 riz dans le panier. **Variante** : si Kossi change le prix du riz
  entre-temps (KOS-02), la caisse signale l'écart et vend **au prix du jour**.
- **Résultat** : ☐ OK ☐ KO — remarque :

### AFI-12 — Retour client (code du gérant)
- **Étapes** : « Retour client », numéro du ticket d'AFI-05, cocher le jus d'ananas (1), motif
  « Produit défectueux », sort « Détruire », remboursement espèces ; Kossi tape son code.
- **Attendu** : retour `R-AAAA-NNNNNN`, rendu **600 F**, ticket de retour imprimé « RETOUR CLIENT »,
  tiroir ouvert. Le ticket d'origine n'est pas modifié. Historique du jus : `retour_client` +1 puis
  `casse` −1. Un second retour du même jus est refusé (on ne rend pas plus que vendu). « Avoir en
  boutique » est grisé (A11).
- **Résultat** : ☐ OK ☐ KO — remarque :

### AFI-13 — Annuler un ticket (code du gérant)
- **Étapes** : vendre une baguette (300 F espèces) ; « Annuler un ticket », son numéro, motif
  « erreur de caisse », Kossi tape son code.
- **Attendu** : ticket au statut annulé, tiroir ouvert pour rendre 300 F, baguette remise en stock. À
  la réimpression : « TICKET ANNULÉ » et le motif. Le ticket ne compte plus dans le X ni le Z.
- **Résultat** : ☐ OK ☐ KO — remarque :

### AFI-14 — Rapport X puis clôture (Z)
- **Pré-requis** : AFI-01, AFI-05, AFI-12 et AFI-13 seulement (pas de mouvement de tiroir).
- **Étapes** : « Clôture de caisse », « Imprimer le rapport X » ; puis compter **19 000** et
  « Clôturer et imprimer le Z ».
- **Attendu** :

  | Poste | Montant |
  |-------|--------:|
  | Fond d'ouverture | 10 000 |
  | + Ventes en espèces (le ticket annulé ne compte pas) | 10 100 |
  | − Remboursements (retours) | 600 |
  | **= Espèces théoriques** | **19 500** |
  | Espèces comptées | 19 000 |
  | **Écart** | **−500** (en rouge) |

  Le commentaire est **obligatoire** tant que l'écart n'est pas nul. Le X porte « Provisoire » ; le
  Z sort en original, une réimpression porte DUPLICATA. Une sauvegarde « Clôture de caisse » apparaît dans
  Sauvegardes (KOS-25). La caisse clôturée n'accepte plus de vente.
  *Si d'autres tests ont été joués avant, recalculer avec la formule de `REGLES_METIER.md` § 6.9.*
- **Résultat** : ☐ OK ☐ KO — remarque :

### AFI-15 — Dépense payée au tiroir (puis annulée par le gérant)
- **Pré-requis** : AFI-14 (caisse d'Afi clôturée). Afi rouvre sa caisse avec un fond de **10 000**.
- **Étapes** : Afi, menu « Dépenses » : « Nouvelle dépense », Transport, « taxi-moto », **1 000** ;
  puis une deuxième de **20 000** ; « Clôture de caisse », « Imprimer le rapport X ». Kossi, menu
  « Dépenses » : annuler le taxi-moto (motif « erreur ») ; Afi réimprime le X.
- **Attendu** : la page d'Afi s'appelle « Dépenses de ma caisse », sans filtres, catégories ni
  annulation ; ni « Payée par » ni date dans la fenêtre. `DEP-…` ; 20 000 refusé (« Il n'y a que
  9 000 F en caisse »). X : « Dépense (taxi-moto) » −1 000, espèces théoriques **9 000**. Chez Kossi,
  « Payée par : Caisse (Afi) » ; après l'annulation, X à **10 000** (une entrée « Annulation… »). Après
  la clôture d'Afi, l'icône d'annulation disparaît et la liste d'Afi est vide.
- **Résultat** : ☐ OK ☐ KO — remarque :

---

## 3. Kossi — gérant

### KOS-01 — Catégories : rayons et sous-rayons
- **Étapes** : créer le rayon « Hygiène » ; sur « Alimentation », icône « + » → sous-rayon
  « Conserves » ; renommer « Conserves » en « Conserves et sauces » ; créer un second rayon
  « boissons » ; désactiver « Hygiène » ; essayer de désactiver « Alimentation ».
- **Attendu** : « boissons » est refusé (« Boissons » existe, majuscules ignorées). « Hygiène »
  (vide) se désactive ; « Alimentation » est refusée (« déplacez-les d'abord »). Les rayons actifs
  sont les onglets de la caisse.
- **Résultat** : ☐ OK ☐ KO — remarque :

### KOS-02 — Créer et modifier un produit
- **Étapes** : « Nouveau produit » : « Sardines 125 g », rayon Alimentation › Conserves et sauces,
  TVA 18 %, seuil 12 ; Unité 400 F avec un code généré (icône « code-barres ») ; ajouter « Carton de
  50 » à **25 000** F. Enregistrer. Puis modifier le prix du riz à 4 600 F.
- **Attendu** : code interne valide commençant par `20`. Alerte (non bloquante) : le carton coûte
  plus cher que 50 unités (20 000 F). Le changement de prix du riz est au journal
  (`modification_prix`, PAT-05). La quantité de base d'un conditionnement existant n'est pas
  modifiable. Un code déjà utilisé par un autre article est refusé.
- **Résultat** : ☐ OK ☐ KO — remarque :

### KOS-03 — Code inconnu scanné sur l'écran Produits
- **Étapes** : dans la recherche, taper `6034000099999` puis Entrée ; puis `12` puis Entrée ; puis
  `123456` puis Entrée.
- **Attendu** : « Code 6034000099999 inconnu » avec « Créer le produit avec ce code », qui ouvre la
  fiche avec le code pré-rempli. `12` est un PLU valide (1 à 5 chiffres). `123456` : « illisible »
  (ni code-barres de 8 à 14 chiffres, ni PLU).
- **Résultat** : ☐ OK ☐ KO — remarque :

### KOS-04 — Importer le catalogue depuis Excel
- **Étapes** : « Importer depuis Excel », « Télécharger le modèle » ; le remplir avec 25 produits
  (dont un rayon nouveau « Épicerie / Sucre », un produit sans code, une ligne sans prix) ;
  « Vérifier le fichier » ; corriger la ligne en erreur ; vérifier à nouveau ; « Importer ».
- **Attendu** : rapport ligne par ligne, erreurs en premier ; **une ligne en erreur bloque tout**
  (bouton d'import grisé). Après correction : « 25 produits importés », rayon et sous-rayon créés.
  Réimporter le même fichier : tout est « Ignorée », aucun doublon. Aucun mouvement de stock créé.
- **Résultat** : ☐ OK ☐ KO — remarque :

### KOS-05 — Stock initial des produits importés
- **Étapes** : « Stock initial », filtre « À compter » ; « Compter » un produit importé :
  1 carton de 24 + 5 lots de 3 + 2 unités si ces conditionnements existent, sinon **41** unités ;
  coût par unité 250 ; enregistrer. Puis l'annuler (motif) et le recompter.
- **Attendu** : stock **41**, coût moyen = **250** exactement ; le produit passe en « Compté ». Les
  produits de la démo sont « Non concernés » (ils ont déjà des entrées). L'annulation contre-passe le
  mouvement et le produit redevient « À compter ». Comptage 0 refusé.
- **Résultat** : ☐ OK ☐ KO — remarque :

### KOS-06 — Consulter le stock et l'historique d'un produit
- **Étapes** : « Stock » ; filtre « Ruptures et stocks bas » ; icône « Historique » de la tomate.
- **Attendu** : valeur totale du stock en tête ; répartition indicative sous le stock (72 = « 3 Carton
  de 24 ») ; l'historique part du stock au début de la période, liste chaque mouvement avec le stock
  après, l'auteur et le document (n° de ticket, RC, INV…), entrées en vert, sorties en rouge, et
  finit sur le stock actuel.
- **Résultat** : ☐ OK ☐ KO — remarque :

### KOS-07 — Fiches fournisseurs
- **Étapes** : créer « Brasserie BB Lomé », délai 30 j ; en créer un second « brasserie bb lomé » ;
  modifier le téléphone ; essayer de désactiver le Grossiste après KOS-09.
- **Attendu** : le doublon est refusé (majuscules et espaces ignorés). Délai hors 0–365 refusé.
  Désactivation du Grossiste refusée tant qu'il reste une dette ; celle de la Brasserie (aucune dette)
  acceptée, avec motif.
- **Résultat** : ☐ OK ☐ KO — remarque :

### KOS-08 — Commande fournisseur
- **Étapes** : « Nouvelle commande », Grossiste ; « Proposer depuis les alertes » (cocher un produit
  en page 1 et un autre en page 2 si la liste est longue) ; ajouter 3 × Carton de 24 de tomate ;
  enregistrer ; « Marquer comme envoyée » ; « Copier le texte ».
- **Attendu** : numéro `CA-AAAA-NNNNNN` dès le brouillon ; conversion en direct « = 72 boîtes » ;
  aucune quantité calculée par l'application ; une fois envoyée, la commande ne se modifie plus.
  Annuler demande un motif.
- **Résultat** : ☐ OK ☐ KO — remarque :

### KOS-09 — Réception d'une livraison (CUMP, lots, dette)
- **Étapes** : « Nouvelle réception », Grossiste ; « Livrer CA-… » (KOS-08) ou saisie libre :
  - Tomate — Carton de 24, qté **3**, prix **6 000** ;
  - Lait en poudre, qté **12**, prix **2 100**, lot `LOT-B03`, date dans 60 jours ;
  - scanner `6034000099999` → « Créer le produit » « Jus de mangue 1 L » (Boissons, 18 %, suivi de
    péremption, Unité 650 F) → retour à la réception, qté 6, prix 400, lot `M01`, date dans 30 j.
  Puis « Valider la réception ».
- **Attendu** : sous la ligne tomate « = 72 boîtes à 250 F/boîte » ; lot et date exigés pour le
  lait et le jus (date passée refusée). Total **45 600 F** (18 000 + 25 200 + 2 400). Numéro `RC`
  attribué à la validation. Tomate : stock +72, coût moyen **250**. Dette du Grossiste = 45 600 F,
  échéance aujourd'hui + 15 j. Commande liée : « Reçue ». Une réception validée ne se modifie plus.
- **Résultat** : ☐ OK ☐ KO — remarque :

### KOS-10 — Évolution du coût moyen (CUMP)
- **Étapes** : nouvelle réception, Tomate — Carton de 24, qté **2**, prix **6 600**.
- **Attendu** : « = 48 boîtes à 275 F/boîte ». Nouveau coût moyen
  = (stock avant × 250 + 48 × 275) / (stock avant + 48). Avec 144 boîtes avant : 49 200 / 192 =
  **256,25**. (Le cas de référence 46 boîtes → **262,8** est vérifié par les tests automatiques.)
- **Résultat** : ☐ OK ☐ KO — remarque :

### KOS-11 — Péremptions et retrait d'un lot
- **Pré-requis** : base neuve (avant KOS-09).
- **Étapes** : « Péremptions » ; icône « Retirer » sur Jus d'ananas · DEMO-01, quantité 1,
  commentaire « emballage percé ».
- **Attendu** : lignes ambre (10 j) : Lait DEMO-01, 12 × 2 100 = **25 200 F** ; Jus DEMO-01,
  18 × 420 = **7 560 F** ; valeur en jeu **32 760 F**. Rouge à 3 jours ou moins, « Périmé depuis
  N j » pour un lot dépassé. Après le retrait : jus 17, perte au prix d'achat 420 F, valeur en jeu
  32 340 F. « Promo −20 % » grisé (promotions programmées à venir).
- **Résultat** : ☐ OK ☐ KO — remarque :

### KOS-12 — Sortie de stock et retour fournisseur (avoir attendu)
- **Étapes** : « Sorties de stock », scanner la tomate ; quantité **2**, motif « Défectueux ou
  casse », commentaire « boîtes bombées », cocher « Retour au fournisseur » (Grossiste) ; valider.
  Puis une sortie « Don » d'un savon.
- **Attendu** : mouvement `retour_fournisseur` −2. Avoir attendu = 2 × **dernier prix payé à ce
  fournisseur pour la tomate** : 2 × 250 = **500 F** après KOS-09 seul, 2 × 275 = **550 F** après
  KOS-10. Quantité supérieure au stock refusée. Le don sort en « Défectueux ou casse » libellé « Don ».
- **Résultat** : ☐ OK ☐ KO — remarque :

### KOS-13 — Annuler une sortie
- **Étapes** : icône « Annuler » sur le don de savon, motif.
- **Attendu** : contre-passation, le savon revient ; la ligne reste visible « Annulée » avec le
  motif. Une sortie dont l'avoir est reçu ou refusé ne s'annule plus.
- **Résultat** : ☐ OK ☐ KO — remarque :

### KOS-14 — Dettes, règlements et avoirs
- **Étapes** (page Fournisseurs, Grossiste) :
  1. « Payer » : règlement global **20 000** en espèces ;
  2. « Dettes » : annuler ce règlement (motif), puis le ressaisir ;
  3. sur l'avoir attendu de KOS-12, « Avoir reçu », montant égal à l'attendu ;
  4. essayer un règlement supérieur au reste dû.
- **Attendu** : le règlement global paie d'abord la réception la plus ancienne. Le règlement annulé
  reste visible et ne compte plus. Solde dû = réceptions − règlements − avoirs reçus (chiffres exacts
  dans la semaine enchaînée, SEM-09 : 56 400 − 20 000 − 550 = 35 850 F).
  Un règlement au-delà du reste dû est refusé. Échéance passée : « En retard de N j » en rouge, et
  le total en retard en tête de page.
- **Résultat** : ☐ OK ☐ KO — remarque :

### KOS-15 — Achats d'un fournisseur
- **Étapes** : icône « Achats » du Grossiste.
- **Attendu** : les livraisons des 90 derniers jours avec leur total ; pour chaque conditionnement,
  le dernier prix payé (Carton de 24 : 6 600 F après KOS-10, écart +600 F avec la livraison
  précédente, en ambre) ; icône « œil » → détail de la réception.
- **Résultat** : ☐ OK ☐ KO — remarque :

### KOS-16 — Inventaire
- **Étapes** : « Ouvrir un inventaire » (rayon Entretien, ou tout le magasin) ; compter le savon :
  **28** unités (stock 30), motif « Vol », commentaire « vol présumé » ; compter la tomate par
  conditionnements jusqu'au stock exact (ex. 1 carton + 5 lots + 2 unités = **41**) ; valider.
- **Attendu** : numéro `INV` dès l'ouverture ; motif obligatoire si écart ; recomptage = remplace ;
  produits non comptés annoncés (leur stock ne change pas). À la validation : savon −2, **démarque
  2 × 150 = 300 F** ; tomate écart 0. L'inventaire validé est figé ; icône « œil » → détail et
  export. Un seul inventaire en cours à la fois.
- **Résultat** : ☐ OK ☐ KO — remarque :

### KOS-17 — Dépenses
- **Étapes** : « Nouvelle dépense » : Transport, « taxi-moto », **1 000**, « Fonds propres » ;
  puis Loyer **15 000** ; filtrer par catégorie ; annuler le loyer (motif) ; choisir la source
  « Caisse » sans caisse ouverte ; « Catégories » : créer « Gardiennage », désactiver « Eau ».
- **Attendu** : `DEP-AAAA-NNNNNN` ; total 16 000 F, puis **1 000 F** après annulation (le loyer
  reste visible, annulé). Date future refusée. Source « Caisse » sans caisse ouverte : « Aucune caisse
  n'est ouverte » (dépense au tiroir : AFI-15). Nom de catégorie déjà pris (même désactivée) refusé.
- **Résultat** : ☐ OK ☐ KO — remarque :

### KOS-18 — Rapports de gestion
- **Étapes** : « Rapports de gestion », onglets Pertes, Valeur du stock, Achats, Résultat ; changer
  la période ; « Revenir au mois en cours ».
- **Attendu** :
  - **Pertes** par cause, chacune au coût du moment : péremption (KOS-11, 420 F), casse (dont la
    destruction d'AFI-12, 420 F), dons à part, vol, démarque d'inventaire (KOS-16, 300 F) ; les
    surplus d'inventaire affichés à part ; une sortie annulée ne compte pas ;
  - **Valeur du stock** par rayon = le total de l'écran Stock ;
  - **Achats** par fournisseur : livré, avoirs reçus, réglé, reste dû ;
  - **Résultat** : chiffre d'affaires et coût des marchandises vendues de la période (retours
    déduits), marge brute = chiffre d'affaires − coût, puis − dépenses (1 000 F) = résultat ; le
    chiffre d'affaires est le même que celui des ventes de la période (A14).
  - Date de fin dans le futur refusée.
- **Résultat** : ☐ OK ☐ KO — remarque :

### KOS-19 — Exports Excel
- **Étapes** : « Exporter » sur Produits (avec un filtre), Stock, Péremptions, Sorties, Réceptions,
  Commandes, Fournisseurs, Dépenses, chaque onglet des Rapports, détail d'un inventaire.
- **Attendu** : « Enregistrer sous » ; le fichier contient la ligne de titre (« … — exporté le … par
  Kossi »), une ligne vide, les en-têtes, **toutes les lignes affichées, filtres compris** (pas
  seulement la page). Montants et quantités sont des nombres, dates de vraies dates, codes-barres du
  texte (zéros gardés).
- **Résultat** : ☐ OK ☐ KO — remarque :

### KOS-20 — Espèces du tiroir (apport, retrait, annulation)
- **Pré-requis** : la caisse d'Afi est ouverte.
- **Étapes** : Kossi dans la caisse, « Espèces du tiroir » : apport **5 000** (« monnaie ») ;
  retrait **2 000** (« versement banque ») ; annuler l'apport (motif) ; essayer un retrait supérieur
  aux espèces du tiroir.
- **Attendu** : chaque mouvement ouvre le tiroir et apparaît dans le X et le Z avec son motif.
  L'annulation crée un contre-mouvement lié (« Annulation : Apport (monnaie) »). Le retrait trop
  grand est refusé (« Il n'y a que … F en caisse »). Afi ne voit pas ce bouton.
- **Résultat** : ☐ OK ☐ KO — remarque :

### KOS-21 — Vendre, annuler et rembourser en tant que gérant
- **Étapes** : Kossi ouvre sa propre caisse, vend, annule un ticket, fait un retour client et une
  remise **sans taper de code**.
- **Attendu** : aucun code demandé au gérant ; tout est au journal à son nom.
- **Résultat** : ☐ OK ☐ KO — remarque :

### KOS-22 — Clôturer la caisse d'une autre personne
- **Étapes** : Afi a une caisse ouverte et s'est déconnectée ; Kossi, « Clôture de caisse », choisit
  la caisse d'Afi, compte, clôture.
- **Attendu** : clôture acceptée et journalisée au nom de Kossi ; le Z est disponible. Afi ne peut
  clôturer que sa propre caisse.
- **Résultat** : ☐ OK ☐ KO — remarque :

### KOS-23 — Paramètres en lecture
- **Étapes** : vérifier que « Paramètres » n'est pas dans le menu de Kossi.
- **Attendu** : absent (admin seulement) ; Kossi règle l'imprimante dans « Réglages matériel ».
- **Résultat** : ☐ OK ☐ KO — remarque :

### KOS-24 — Réglages matériel
- **Pré-requis** (terminal) : l'imprimante est partagée dans Windows sous le nom `XPOS`.
- **Étapes** : « Modifier les réglages » : méthode « Partage réseau », nom `XPOS`, page de codes
  cp1252 ; « Imprimer le test en cp1252 » ; « Ouvrir le tiroir ».
- **Attendu** : sur une base neuve, la page de codes proposée est déjà **cp1252** (D-20). Le ticket de
  test sort avec « éèêàçùôî ÉÇ € » justes ; le tiroir s'ouvre et l'ouverture est journalisée
  (`ouverture_tiroir_hors_vente`). Un nom de partage faux donne un message clair, sans bloquer
  l'application.
- **Résultat** : ☐ OK ☐ KO — remarque :

### KOS-25 — Sauvegardes (gérant)
- **Étapes** : « Sauvegardes », « Sauvegarder maintenant ».
- **Attendu** : « Sauvegarde faite (taille) » ; la liste montre la nouvelle « Sauvegarde manuelle »
  et celle de la « Clôture de caisse » (AFI-14). Pas de bouton « Restaurer » ni de choix de clé USB.
- **Résultat** : ☐ OK ☐ KO — remarque :

---

## 4. Patron — administratrice

### PAT-01 — Premier démarrage en production
- **Étapes** : lancer l'application en production sur une base **vide** (installateur, ou
  `POS_DB` vers un fichier neuf sans démo).
- **Attendu** : l'assistant demande de créer le compte administrateur (nom, code choisi deux fois) ;
  ce code n'est **pas** provisoire. Aucune donnée de démonstration en production.
- **Résultat** : ☐ OK ☐ KO — remarque :

### PAT-02 — Gérer les comptes utilisateurs
- **Étapes** :
  1. « Créer un compte » : « Ama », caissière, code provisoire `1357` ;
  2. se connecter en Ama avec `1357` ;
  3. revenir en Patron : icône « clé » (réinitialiser le code d'Ama, `2468`) ; icône « personne »
     (Ama devient gérante) ; icône « désactiver » (motif) ;
  4. essayer de désactiver son propre compte, et de rétrograder le seul administrateur.
- **Attendu** :
  2. Ama doit **choisir son propre code** (deux fois, différent du provisoire) avant d'accéder à quoi
     que ce soit ;
  3. après réinitialisation, l'ancien code d'Ama ne marche plus, et son compte est débloqué s'il
     était verrouillé ; une fois désactivée, Ama disparaît de l'écran de connexion ;
  4. refusé dans les deux cas. Toutes ces actions sont au journal.
- **Résultat** : ☐ OK ☐ KO — remarque :

### PAT-03 — Paramètres de la boutique
- **Étapes** : « Paramètres » : nom, adresse, NIF, pied de ticket ; seuil des péremptions 20 j ;
  « Remise maximale sans gérant » **500** F. Puis Afi (AFI-07) : remise de 300 F, puis une seconde
  remise portant le total à 600 F.
- **Attendu** : le ticket et la facture prennent le nouvel en-tête et le NIF. Péremptions : « sous
  20 jours ». Afi accorde 300 F **sans** code ; au-delà de 500 F au total du ticket, le code du gérant
  est demandé. Chaque paramètre modifié est au journal (avant / après).
- **Résultat** : ☐ OK ☐ KO — remarque :

### PAT-04 — Tout ce que fait le gérant
- **Étapes** : rejouer au moins KOS-02, KOS-09 et KOS-16 en Patron.
- **Attendu** : mêmes résultats ; l'administratrice passe partout.
- **Résultat** : ☐ OK ☐ KO — remarque :

### PAT-05 — Journal des opérations
- **Étapes** : « Journal des opérations » ; filtrer par personne (Afi), par action (« Remise »,
  « Modification de prix »…), sur 7 jours puis sur le mois ; « Afficher plus » ; exporter.
- **Attendu** : tout en français, sans code technique ni identifiant brut (noms des personnes,
  libellés des actions et des champs). On y retrouve : verrouillages (TRV-02), remise autorisée par
  Kossi (AFI-07), annulation (AFI-13), retour (AFI-12), clôture (AFI-14), changement de prix (KOS-02),
  import (KOS-04), stock initial (KOS-05), désactivations, annulations de règlement / dépense /
  sortie, inventaire, paramètres (PAT-03), comptes (PAT-02). Jamais de valeur de code. L'export
  contient tout le filtre, pas seulement les 200 lignes affichées.
- **Résultat** : ☐ OK ☐ KO — remarque :

### PAT-06 — Sauvegarde sur clé USB
- **Étapes** : brancher une clé, « Choisir la clé USB », choisir un dossier ; « Sauvegarder
  maintenant » ; débrancher la clé ; sauvegarder à nouveau ; « Ne plus copier sur une clé ».
- **Attendu** : clé « Branchée » puis « Non branchée » ; la copie est sur la clé quand elle est
  présente ; sinon un simple avertissement, la sauvegarde locale est faite quand même.
- **Résultat** : ☐ OK ☐ KO — remarque :

### PAT-07 — Restaurer une sauvegarde
- **Étapes** : noter un repère (ex. créer la dépense « TEST RESTAURATION ») ; dans la liste,
  « Restaurer » une sauvegarde faite **avant** ce repère ; cocher « J'ai compris » ; valider. Puis
  « Restaurer depuis un fichier » avec la sauvegarde « Avant une restauration ».
- **Attendu** : l'application redémarre ; chacun doit se reconnecter ; la dépense repère a disparu ;
  le journal de la base restaurée contient « Restauration d’une sauvegarde ». La seconde restauration
  ramène la base d'avant : le repère revient. Un fichier qui n'est pas une base, ou issu d'une
  version plus récente, est refusé sans rien changer.
- **Résultat** : ☐ OK ☐ KO — remarque :

---

## 5. La semaine complète, enchaînée (recette)

À jouer **dans l'ordre**, sur une base neuve, sans autre test entre deux étapes. Les chiffres sont
ceux de la base de démonstration.

| Étape | Qui | Cas | Ce qu'on fait | Attendu | Résultat |
|-------|-----|-----|---------------|---------|----------|
| SEM-01 | Kossi | KOS-11 | Péremptions, retirer 1 jus DEMO-01 | Valeur en jeu 32 760 → **32 340 F** ; jus **17** | ☐ OK ☐ KO |
| SEM-02 | Kossi | KOS-09 | Réception : 3 cartons tomate à 6 000, 12 laits à 2 100 lot LOT-B03 | RC, total **43 200 F**, tomate **144** à 250, lait **24** à 2 100, dette 43 200 | ☐ OK ☐ KO |
| SEM-03 | Kossi | KOS-10 | Réception : 2 cartons tomate à 6 600 | Tomate **192**, coût moyen **256,25** ; dette 56 400 | ☐ OK ☐ KO |
| SEM-04 | Afi | AFI-01, 02, 05 | Fond 10 000 ; vente de référence 10 100 F, espèces 15 000 | Monnaie **4 900** ; tomate **163** ; jus **16** ; baguette **39** | ☐ OK ☐ KO |
| SEM-05 | Afi + Kossi | AFI-12 | Retour du jus, détruit, 600 F en espèces | `R-…`, jus reste **16** (+1 −1) | ☐ OK ☐ KO |
| SEM-06 | Kossi | KOS-20 | Apport 5 000 « monnaie » sur la caisse d'Afi | Visible dans le X | ☐ OK ☐ KO |
| SEM-07 | Afi | AFI-14 | X, puis compter **23 900**, commentaire, Z | Théorique 10 000 + 10 100 − 600 + 5 000 = **24 500** ; écart **−600** | ☐ OK ☐ KO |
| SEM-08 | Kossi | KOS-12 | Sortie tomate 2, casse, retour au Grossiste | Tomate **161** ; avoir attendu **550 F** (2 × 275) | ☐ OK ☐ KO |
| SEM-09 | Kossi | KOS-14 | Règlement global 20 000 ; avoir reçu 550 | Solde dû 56 400 − 20 000 − 550 = **35 850 F** | ☐ OK ☐ KO |
| SEM-10 | Kossi | KOS-16 | Inventaire total : tomate 6 cartons + 5 lots + 2 unités ; savon 28, vol | Tomate **161**, écart 0 ; savon −2 ; démarque **300 F** | ☐ OK ☐ KO |
| SEM-11 | Kossi | KOS-17 | Dépense taxi-moto 1 000, fonds propres | `DEP-…`, total du mois 1 000 F | ☐ OK ☐ KO |
| SEM-12 | Kossi | KOS-18 | Rapport des pertes du mois | Péremption **420** + casse **420** + démarque **300** = **1 140 F** | ☐ OK ☐ KO |
| SEM-13 | Patron | KOS-06 | Historique de la tomate : « pourquoi 161 ? » | 72 démo + 72 + 48 − 29 − 2 = **161**, chaque ligne avec son auteur et son document | ☐ OK ☐ KO |
| SEM-14 | Patron | PAT-05 | Journal : la clôture d'Afi | Écart −600 et son commentaire | ☐ OK ☐ KO |
| SEM-15 | Patron | KOS-25 | Sauvegardes | Une sauvegarde « Clôture de caisse » de SEM-07 | ☐ OK ☐ KO |

---

## 6. Installation, mises à jour et retour arrière

Ces tests vérifient la procédure de `docs/DEPLOIEMENT.md` **avant** de l'appliquer chez la cliente.
Ils se jouent avec l'**installateur** (`npm run dist`), sur un PC de test Windows, jamais sur le
terminal de la boutique ni sur sa base. Les chemins `<dossier>` sont ceux relevés sur la fiche
d'installation.

### DEP-01 — Première installation sans données de démonstration
- **Étapes** : sur un PC où l'application n'a jamais été installée, lancer l'installateur ; au
  premier démarrage, créer le compte administrateur.
- **Attendu** : l'assistant de premier démarrage s'affiche ; aucun produit, compte ou fournisseur de
  démonstration ; `boutique.db` et le dossier `sauvegardes` apparaissent dans `%APPDATA%\<dossier>`.
  (Même vérification que PAT-01.)
- **Résultat** : ☐ OK ☐ KO — remarque :

### DEP-02 — Les données survivent à la fermeture et à la réinstallation
- **Étapes** : créer un produit et faire une vente ; fermer, relancer ; désinstaller l'application
  (Paramètres Windows › Applications), puis réinstaller la même version.
- **Attendu** : après chaque étape, le produit et la vente sont toujours là. La désinstallation ne
  touche pas le dossier de données.
- **Résultat** : ☐ OK ☐ KO — remarque :

### DEP-03 — Base d'essai séparée
- **Étapes** : lancer l'application avec `set POS_DB=C:\PosEssai\essai.db` (procédure § 5.7) ; y faire
  une vente et une clôture ; fermer ; relancer normalement.
- **Attendu** : la base d'essai démarre vide (assistant) ; la vraie base ne contient **ni la vente ni
  la clôture** d'essai.
- **Résultat** : ☐ OK ☐ KO — remarque :

### DEP-04 — Mise à jour avec migration : rien ne se perd
- **Pré-requis** : une version N installée, avec des données (au moins la semaine de la partie 5) ;
  une version N+1 qui contient une nouvelle migration.
- **Étapes** : noter la valeur du stock (écran Stock), le total dû (Fournisseurs), le nombre de
  produits et le dernier ticket ; clôturer les caisses ; « Sauvegarder maintenant » ; fermer ;
  installer N+1 ; relancer.
- **Attendu** :
  - l'application démarre sans message « Démarrage impossible » ;
  - une sauvegarde « Avant une mise à jour » est apparue, datée du redémarrage ;
  - les quatre valeurs notées sont **identiques** ; on peut se connecter avec les mêmes comptes et
    les mêmes codes ;
  - les nouveautés de N+1 fonctionnent sur ces données.
- **Variante** : faire la même chose sur une **copie** d'une vraie sauvegarde de la boutique
  (répétition générale, `DEPLOIEMENT.md` § 6.2).
- **Résultat** : ☐ OK ☐ KO — remarque :

### DEP-05 — Mise à jour sans migration
- **Étapes** : comme DEP-04, avec une version qui n'ajoute aucune migration.
- **Attendu** : mêmes valeurs qu'avant ; **pas** de nouvelle sauvegarde « Avant une mise à jour »
  (c'est normal).
- **Résultat** : ☐ OK ☐ KO — remarque :

### DEP-06 — Retour arrière après une mise à jour ratée
- **Étapes** : après DEP-04, réinstaller la version N ; faire la restauration manuelle
  (`DEPLOIEMENT.md` § 7.3) avec la sauvegarde « Avant une mise à jour » ; relancer.
- **Attendu** : la version N démarre et retrouve exactement les données d'avant la mise à jour ;
  ce qui a été saisi après la mise à jour n'y est plus (attendu, et annoncé dans la procédure).
- **Résultat** : ☐ OK ☐ KO — remarque :

### DEP-07 — Une ancienne version refuse une sauvegarde plus récente
- **Étapes** : avec la version N installée, « Restaurer depuis un fichier » une sauvegarde faite par
  la version N+1 (après sa migration).
- **Attendu** : refus « Cette sauvegarde vient d'une version plus récente de l'application : mettez
  d'abord l'application à jour » ; la base en place n'a pas changé.
- **Résultat** : ☐ OK ☐ KO — remarque :

### DEP-08 — Reprise après panne sur un autre poste
- **Étapes** : sur un second PC, installer la même version ; créer un administrateur provisoire ;
  « Restaurer depuis un fichier » la dernière sauvegarde copiée sur la clé USB.
- **Attendu** : redémarrage avec toutes les données et tous les comptes d'origine (l'administrateur
  provisoire n'existe plus) ; refaire les réglages propres au poste (imprimante, clé USB).
- **Résultat** : ☐ OK ☐ KO — remarque :

---

## 7. Sur le terminal de la boutique (OMA POS M120w)

À faire sur le vrai matériel, en fin de phase :

| Test | Étapes | Attendu | Résultat |
|------|--------|---------|----------|
| TER-01 — Douchette | Scanner 20 articles à la suite, dont un carton dont l'unité se voit à travers le film | Chaque scan donne sa ligne en **moins d'une seconde** ; aucun caractère perdu ; « Changer le conditionnement » corrige le piège du carton | ☐ OK ☐ KO |
| TER-02 — Tactile | Toute la vente AFI-02 au doigt, sans clavier ; appui long sur les icônes | Aucune cible trop petite ; infobulles lisibles ; aucun double déclenchement | ☐ OK ☐ KO |
| TER-03 — Imprimante Xprinter M804 | Partage `XPOS`, cp1252 ; AFI-05, AFI-09, AFI-14, KOS-24 | Accents lisibles, 48 colonnes, coupe du papier, tiroir ouvert seulement quand il faut | ☐ OK ☐ KO |
| TER-04 — Écran client | Vente AFI-02 | Le client voit les lignes et le total en direct, remises comprises | ☐ OK ☐ KO |
| TER-05 — Coupure de courant | Débrancher pendant la saisie d'une réception (brouillon), puis pendant un encaissement | Au redémarrage : brouillon de réception retrouvé ; la vente est soit entièrement enregistrée, soit absente, jamais à moitié | ☐ OK ☐ KO |
| TER-06 — Client pressé | Chronométrer AFI-02 + AFI-05 | Moins de **30 secondes** | ☐ OK ☐ KO |

---

## 8. Ce qui ne se teste pas encore

Ces fonctions ne sont pas livrées : un test qui échoue dessus n'est pas un défaut.

| Fonction | En attente de |
|----------|---------------|
| Vente à crédit, fiche client, avoir en boutique, recouvrement, balance âgée | A11, A12 (Dev A) |
| Écran des rapports de ventes (par heure, par caissier, top / flop produits) | A14 (partie 2) |
| Tableau de bord d'accueil | A15 |
| Promotions programmées (bouton « Promo » des péremptions) | A16 |
| Écran client définitif | A13 |
| Envoi de la sauvegarde à distance | D-A4 |
| Démarrage automatique et mode kiosque | Phase 5 (B-P5) ; provisoire : raccourci au démarrage de Windows |
| Plafond de remise de la caissière : montant définitif | D-A3 (la cliente) |
| Politique de stock négatif | D-A1 (la cliente) |
