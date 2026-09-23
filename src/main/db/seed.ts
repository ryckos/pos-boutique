/**
 * Données de démonstration — UNIQUEMENT en développement, sur une base vide.
 * Comptes : Patron (admin) PIN 1234 · Afi (caissière) PIN 0000 · Kossi (gérant) PIN 5678
 * ZONE PARTAGÉE : chacun peut y ajouter les données utiles à ses écrans.
 */
import type { Db } from './connexion'
import { avecTransaction, executer, une } from './requetes'
import { creerUtilisateur } from '../modules/auth/service'
import { enregistrerMouvement } from '../core/mouvements'

interface ProduitDemo {
  nom: string
  categorie: number
  tva: number
  peremption?: boolean
  seuil: number
  cump: number
  stockInitial: number
  conditionnements: Array<{
    nom: string
    base: number
    prix: number
    code?: string
    plu?: string
    bouton?: boolean
  }>
}

const PRODUITS: ProduitDemo[] = [
  { nom: 'Riz parfumé 5 kg', categorie: 1, tva: 18, seuil: 5, cump: 3200, stockInitial: 20,
    conditionnements: [{ nom: 'Unité', base: 1, prix: 4500, code: '6181000000011' }] },
  { nom: 'Lait en poudre 400 g', categorie: 1, tva: 18, peremption: true, seuil: 6, cump: 2100, stockInitial: 12,
    conditionnements: [{ nom: 'Unité', base: 1, prix: 2800, code: '6181000000028' }] },
  { nom: 'Tomate concentrée 70 g', categorie: 1, tva: 18, seuil: 24, cump: 250, stockInitial: 72,
    conditionnements: [
      { nom: 'Unité', base: 1, prix: 350, code: '6181000000042' },
      { nom: 'Lot de 3', base: 3, prix: 1000, code: '2000000000015', bouton: true },
      { nom: 'Carton de 24', base: 24, prix: 7500, code: '16181000000049', bouton: true }
    ] },
  { nom: "Jus d'ananas 1 L", categorie: 4, tva: 18, peremption: true, seuil: 6, cump: 420, stockInitial: 18,
    conditionnements: [
      { nom: 'Unité', base: 1, prix: 600, code: '6034000012345' },
      { nom: 'Pack de 6', base: 6, prix: 3300, bouton: true }
    ] },
  { nom: 'Baguette', categorie: 2, tva: 0, seuil: 0, cump: 180, stockInitial: 40,
    conditionnements: [{ nom: 'Unité', base: 1, prix: 300, plu: '101', bouton: true }] },
  { nom: 'Gari (sachet)', categorie: 1, tva: 0, seuil: 10, cump: 350, stockInitial: 25,
    conditionnements: [{ nom: 'Unité', base: 1, prix: 500, plu: '205', bouton: true }] },
  { nom: 'Savon de ménage', categorie: 3, tva: 18, seuil: 12, cump: 150, stockInitial: 30,
    conditionnements: [{ nom: 'Unité', base: 1, prix: 250, code: '6181000000035' }] }
]

/** Renvoie true si les données ont été créées, false si la base n'était pas vide. */
export function semerDonneesDemo(db: Db): boolean {
  const n = une<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM utilisateurs')!.n
  if (n > 0) return false

  avecTransaction(db, () => {
    const admin = creerUtilisateur(db, 'Patron', '1234', 'admin')
    creerUtilisateur(db, 'Afi', '0000', 'caissier')
    creerUtilisateur(db, 'Kossi', '5678', 'gerant')

    for (const [cle, valeur] of [
      ['boutique_nom', 'MA BOUTIQUE'],
      ['boutique_adresse', 'Lomé, Togo'],
      ['ticket_pied', 'Merci de votre visite !']
    ]) {
      executer(db, 'INSERT INTO parametres (cle, valeur) VALUES (?, ?)', cle, valeur)
    }

    for (const nom of ['Alimentation', 'Boulangerie', 'Entretien', 'Boissons']) {
      executer(db, 'INSERT INTO categories (nom) VALUES (?)', nom)
    }

    let ordre = 0
    for (const p of PRODUITS) {
      const produitId = executer(
        db,
        `INSERT INTO produits (nom, categorie_id, taux_tva, suivi_peremption, seuil_alerte, cout_moyen_pondere)
         VALUES (?, ?, ?, ?, ?, ?)`,
        p.nom, p.categorie, p.tva, p.peremption ? 1 : 0, p.seuil, p.cump
      ).id

      p.conditionnements.forEach((c, i) => {
        executer(
          db,
          `INSERT INTO conditionnements
             (produit_id, nom, quantite_base, prix_vente, code_barres, code_plu, est_defaut, bouton_tactile, ordre_bouton)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          produitId, c.nom, c.base, c.prix, c.code ?? null, c.plu ?? null,
          i === 0 ? 1 : 0, c.bouton ? 1 : 0, c.bouton ? ++ordre : 0
        )
      })

      let lotId: number | null = null
      if (p.peremption) {
        lotId = executer(
          db,
          `INSERT INTO lots (produit_id, numero_lot, date_peremption, prix_achat_unitaire)
           VALUES (?, 'DEMO-01', date('now','localtime','+10 days'), ?)`,
          produitId, p.cump
        ).id
      }

      enregistrerMouvement(db, {
        produitId, lotId, type: 'reception', quantite: p.stockInitial, coutUnitaire: p.cump,
        documentType: 'demo', motif: 'Stock de démonstration', utilisateurId: admin
      })
    }
  })
  return true
}
