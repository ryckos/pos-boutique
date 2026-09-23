# Le projet — vision, contexte et périmètre

Synthèse du **cahier des charges** soumis à la cliente (version 1.0). En cas de doute, le cahier
des charges signé fait foi. Toute fonction absente de ce périmètre est une **demande nouvelle** et
passe par un avenant écrit : ne pas l'ajouter de sa propre initiative.

## Contexte

La cliente exploite un mini-supermarché à Lomé. Sa gestion est aujourd'hui manuelle, ce qui rend
difficiles :

- le suivi précis des stocks ;
- le contrôle de la caisse ;
- la connaissance des marges réelles ;
- le suivi des dettes fournisseurs et des créances clients ;
- la maîtrise des pertes (péremptions, casse, vol).

Elle a acheté un équipement de point de vente complet, dont la compatibilité a été testée sur site
en Phase 0.

## Objectifs

1. Encaisser rapidement et sans erreur, à la douchette.
2. Connaître à tout instant le stock réel de chaque produit, sans comptage manuel.
3. Savoir précisément ce que rapporte chaque produit, chaque jour et chaque mois.
4. Éviter les pertes en anticipant les dates de péremption.
5. Suivre les sommes dues aux fournisseurs et celles dues par les clients.
6. Contrôler la caisse et détecter immédiatement tout écart.
7. Garantir une traçabilité complète : toute opération a un auteur, une date et un motif.

## Les trois principes fondateurs (cahier des charges, chapitre 3)

1. **Rien n'est jamais effacé.** Une erreur se corrige par une opération inverse liée à l'originale.
2. **Le stock n'est jamais saisi à la main.** Il est calculé à partir des mouvements.
3. **Un produit, une unité de compte, plusieurs façons de le vendre.** Chaque conditionnement
   (unité, lot, carton) a son prix libre ; le stock reste compté dans l'unité de base.

## Matériel et environnement

| Élément         | Détail                                                                          |
|-----------------|---------------------------------------------------------------------------------|
| Terminal        | OMA POS M120w — Windows 10, Intel Celeron, 4 Go RAM, 128 Go, WiFi               |
| Écrans          | 15,6″ tactile (caissier, principal) + 11,6″ (client, secondaire, mode « étendre ») |
| Imprimante      | Xprinter M804 — thermique 80 mm, 230 mm/s, USB, ESC/POS, coupe auto, port tiroir 24 V (RJ11) |
| Douchette       | Laser USB, 5 V, émulation clavier, suffixe Entrée                               |
| Recommandés     | Onduleur (prioritaire), tiroir-caisse RJ11, imprimante d'étiquettes (option)    |

Contraintes de terrain :

- **Internet non garanti** : tout fonctionne hors ligne ; le cloud n'est qu'une sauvegarde.
- **Coupures d'électricité** : aucune donnée perdue, même pendant une vente (SQLite en mode WAL,
  transactions).
- **4 Go de RAM** : l'application doit rester légère ; pas de requête lourde à chaque frappe.
- **FCFA sans décimales**, **TVA à 18 %** (certains produits exonérés, ex. le pain).
- **Mobile money** (TMoney / Mixx by Yas, Flooz) : un mode de paiement à part entière, avec
  référence de transaction, sans intégration automatique avec l'opérateur.

## Utilisateurs et droits (cahier des charges, chapitre 5)

| Opération                           | Caissier          | Gérant | Admin |
|-------------------------------------|-------------------|--------|-------|
| Vendre et encaisser                 | Oui               | Oui    | Oui   |
| Accorder une remise                 | Limitée (plafond) | Oui    | Oui   |
| Annuler un ticket                   | Avec motif        | Oui    | Oui   |
| Modifier un prix de vente           | Non               | Oui    | Oui   |
| Créer ou modifier un produit        | Non               | Oui    | Oui   |
| Réceptionner une livraison          | Non               | Oui    | Oui   |
| Valider un inventaire               | Non               | Oui    | Oui   |
| Enregistrer une dépense             | Depuis la caisse  | Oui    | Oui   |
| Consulter les rapports financiers   | Non               | Oui    | Oui   |
| Consulter le journal des opérations | Non               | Non    | Oui   |
| Gérer les comptes utilisateurs      | Non               | Non    | Oui   |

Traduction technique : `session.exiger(['gerant'])` autorise le gérant **et** l'admin (l'admin
passe partout). `session.exiger()` sans argument autorise toute personne connectée.

## Périmètre inclus

- Toutes les fonctions du chapitre 4 : caisse et ventes, produits et catalogue, stock,
  approvisionnements et fournisseurs, péremptions, clients et crédits, inventaires, dépenses et
  trésorerie, rapports, utilisateurs et sécurité, réglages et sauvegardes.
- Installation sur le terminal et configuration du matériel.
- Import du catalogue depuis un fichier fourni par la cliente.
- Accompagnement de l'inventaire initial.
- Formation, guide d'utilisation, accompagnement au démarrage, garantie.

## Périmètre exclu — ne pas développer

- Comptabilité générale, paie, déclarations fiscales.
- Boutique en ligne, site web, vente à distance.
- Plusieurs boutiques ou points de vente.
- Application mobile.
- Intégration automatique avec les opérateurs de mobile money.
- Balance connectée pour la vente au poids.
- Saisie manuelle du catalogue si aucun fichier n'est fourni.
- Fourniture et maintenance du matériel.

L'architecture doit toutefois **permettre** ces évolutions plus tard sans reconstruction : ne pas
fermer de porte inutilement (par exemple, des quantités en `REAL` pour un futur produit pesé).

## Exigences de qualité (cahier des charges, chapitre 6)

**Rapidité**
- Ajout au panier après un scan : moins d'une seconde.
- Impression lancée moins de 3 s après le paiement.
- Écrans courants ouverts en moins de 2 s.

**Fiabilité**
- Aucune perte de données en cas de coupure brutale.
- Une journée complète sans redémarrage.
- Aucune dépendance à Internet pour vendre.

**Simplicité**
- Interface 100 % en français.
- Montants en FCFA sans décimales.
- Écrans tactiles.
- Un caissier formé en moins d'une heure.

**Sécurité**
- Accès par PIN, PIN stockés hachés.
- Terminal dédié à l'application.
- Sauvegardes protégées.

## Planning (cahier des charges, chapitre 8)

| Phase | Semaines | Résultat attendu                                                      |
|-------|----------|------------------------------------------------------------------------|
| 0     | S1–S2    | Matériel validé sur site — **terminée**                                |
| 1     | S3–S8    | La boutique vend, encaisse, imprime et clôture sa caisse               |
| 2     | S9–S12   | Réceptions, fournisseurs, lots, péremptions, marges réelles            |
| 3     | S13–S15  | Crédits clients, recouvrement, dépenses, inventaires, écran client     |
| 4     | S16–S18  | Tableau de bord, rapports, exports, sauvegardes distantes              |
| 5     | S19–S20  | Tests finaux, formation, installation, accompagnement                  |

Chaque phase se termine par une présentation et une validation de la cliente. Après la Phase 1, la
boutique est déjà opérationnelle ; les phases suivantes enrichissent sans interrompre la vente.
