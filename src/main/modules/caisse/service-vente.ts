/**
 * Propriétaire : Dev A.
 *
 * Enregistrement d'une vente (règle 6.3) — le modèle de transaction du projet, lu par Dev B.
 *
 * Tout se fait dans UNE transaction : la vente, ses lignes, ses mouvements de stock et ses
 * paiements existent ensemble ou pas du tout. L'écran n'envoie que des identifiants, des
 * quantités et des paiements : prix, coûts et TVA sont relus en base. L'impression et le tiroir
 * viennent APRÈS, hors transaction (tâche A3).
 */
import type { ModePaiementCaisse, RequeteVente, VenteEnregistree } from '@shared/ipc/caisse'
import { formaterFCFA } from '@shared/format'
import type { Db } from '../../db/connexion'
import { avecTransaction, executer, une } from '../../db/requetes'
import { enregistrerMouvement, stockProduit } from '../../core/mouvements'
import { prochainNumero } from '../../core/numerotation'
import { ErreurMetier } from '../../core/erreurs'
import { ventilerTva } from './calculs'
import { sessionOuverte } from './service-session'

const MODES: Record<ModePaiementCaisse, string> = { especes: 'Espèces', tmoney: 'TMoney', flooz: 'Flooz' }
const MOBILE_MONEY: ModePaiementCaisse[] = ['tmoney', 'flooz']

/** Un conditionnement tel que la base le connaît au moment de la vente. */
interface ConditionnementEnBase {
  conditionnementId: number
  produitId: number
  designation: string
  quantiteBase: number
  prixVente: number
  tauxTva: number
  /** CUMP par unité de base. */
  cump: number
}

/** Une ligne préparée, prête à être photocopiée dans lignes_vente. */
interface LignePreparee extends ConditionnementEnBase {
  quantite: number
  totalLigne: number
  quantiteBaseTotale: number
}

const estMontant = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0

function lireConditionnement(db: Db, conditionnementId: number): ConditionnementEnBase {
  const c = une<ConditionnementEnBase>(
    db,
    `SELECT v.conditionnement_id AS conditionnementId, v.produit_id AS produitId, v.designation,
            v.quantite_base AS quantiteBase, v.prix_vente AS prixVente, v.taux_tva AS tauxTva,
            p.cout_moyen_pondere AS cump
     FROM v_catalogue_vente v JOIN produits p ON p.id = v.produit_id
     WHERE v.conditionnement_id = ?`,
    conditionnementId
  )
  if (!c) {
    throw new ErreurMetier(
      'Un article du ticket n’est plus en vente (désactivé ou supprimé du catalogue). Retirez-le du ticket.'
    )
  }
  return c
}

function preparerLignes(db: Db, lignes: RequeteVente['lignes']): LignePreparee[] {
  if (!Array.isArray(lignes) || lignes.length === 0) {
    throw new ErreurMetier('Le ticket est vide : scannez un article avant d’encaisser.')
  }
  return lignes.map(({ conditionnementId, quantite }) => {
    if (!Number.isInteger(quantite) || quantite < 1) {
      throw new ErreurMetier('Quantité invalide sur une ligne : saisissez un nombre entier d’au moins 1.')
    }
    const c = lireConditionnement(db, conditionnementId)
    return {
      ...c,
      quantite,
      totalLigne: quantite * c.prixVente,
      quantiteBaseTotale: quantite * c.quantiteBase
    }
  })
}

/** Contrôle des paiements (règle 6.5). Renvoie les espèces reçues et la monnaie à rendre. */
function controlerPaiements(
  requete: RequeteVente,
  totalTtc: number
): { montantRecu: number; monnaieRendue: number } {
  const paiements = requete.paiements ?? []
  if (paiements.length === 0) throw new ErreurMetier('Choisissez un mode de paiement avant d’encaisser.')

  for (const p of paiements) {
    // hasOwn et non « in » : un mode forgé comme 'constructor' ne doit pas passer.
    if (!Object.hasOwn(MODES, p.mode)) throw new ErreurMetier('Mode de paiement non accepté à la caisse.')
    if (!estMontant(p.montant) || p.montant === 0) {
      throw new ErreurMetier(
        `Montant ${MODES[p.mode]} invalide : saisissez un montant en francs, sans virgule.`
      )
    }
    if (MOBILE_MONEY.includes(p.mode) && !p.reference?.trim()) {
      throw new ErreurMetier(`Saisissez la référence de la transaction ${MODES[p.mode]}.`)
    }
  }

  const paye = paiements.reduce((s, p) => s + p.montant, 0)
  if (paye < totalTtc)
    throw new ErreurMetier(`Paiement incomplet : il manque ${formaterFCFA(totalTtc - paye)}.`)
  if (paye > totalTtc) {
    throw new ErreurMetier(
      `Paiement supérieur au total de ${formaterFCFA(paye - totalTtc)} : corrigez les montants.`
    )
  }

  const especes = paiements.filter((p) => p.mode === 'especes').reduce((s, p) => s + p.montant, 0)
  if (especes === 0) return { montantRecu: 0, monnaieRendue: 0 }
  const montantRecu = requete.montantRecu ?? especes
  if (!estMontant(montantRecu)) {
    throw new ErreurMetier('Montant reçu invalide : saisissez un montant en francs, sans virgule.')
  }
  if (montantRecu < especes) {
    throw new ErreurMetier(`Espèces reçues insuffisantes : il manque ${formaterFCFA(especes - montantRecu)}.`)
  }
  return { montantRecu, monnaieRendue: montantRecu - especes }
}

export function enregistrerVente(db: Db, utilisateurId: number, requete: RequeteVente): VenteEnregistree {
  return avecTransaction(db, () => {
    const session = sessionOuverte(db, utilisateurId)
    if (!session) throw new ErreurMetier('Ouvrez la caisse (fond de caisse) avant d’encaisser.')

    const lignes = preparerLignes(db, requete.lignes)
    const totaux = ventilerTva(lignes.map((l) => ({ totalTtc: l.totalLigne, tauxTva: l.tauxTva })))
    const { montantRecu, monnaieRendue } = controlerPaiements(requete, totaux.totalTtc)

    // Le numéro n'est pris qu'une fois tout contrôlé ; en cas d'échec plus loin, le rollback le rend.
    const numeroTicket = prochainNumero(db, 'T')
    const venteId = executer(
      db,
      `INSERT INTO ventes (numero_ticket, session_caisse_id, utilisateur_id, total_ht, total_tva, total_ttc,
                           montant_recu, monnaie_rendue)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      numeroTicket,
      session.id,
      utilisateurId,
      totaux.totalHt,
      totaux.totalTva,
      totaux.totalTtc,
      montantRecu,
      monnaieRendue
    ).id

    for (const l of lignes) {
      // Photocopie au moment T : l'historique ne bouge plus si le catalogue change.
      executer(
        db,
        `INSERT INTO lignes_vente (vente_id, produit_id, conditionnement_id, designation, quantite, prix_unitaire,
                                   taux_tva, cout_unitaire, quantite_base_totale, total_ligne)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        venteId,
        l.produitId,
        l.conditionnementId,
        l.designation,
        l.quantite,
        l.prixVente,
        l.tauxTva,
        l.cump * l.quantiteBase,
        l.quantiteBaseTotale,
        l.totalLigne
      )
      // Lot : null jusqu'au FEFO (A9, allouerFefo de Dev B).
      enregistrerMouvement(db, {
        produitId: l.produitId,
        type: 'vente',
        quantite: -l.quantiteBaseTotale,
        coutUnitaire: l.cump,
        documentType: 'vente',
        documentId: venteId,
        utilisateurId
      })
    }

    for (const p of requete.paiements) {
      executer(
        db,
        'INSERT INTO paiements (vente_id, mode, montant, reference) VALUES (?, ?, ?, ?)',
        venteId,
        p.mode,
        p.montant,
        p.reference?.trim() || null
      )
    }

    // Stock négatif : jamais bloquant (D-A1 en attente), signalé à l'écran.
    const alertesStock = [...new Set(lignes.map((l) => l.produitId))]
      .map((produitId) => ({ produitId, stockApres: stockProduit(db, produitId) }))
      .filter((a) => a.stockApres < 0)
      .map((a) => ({
        ...a,
        designation: une<{ nom: string }>(db, 'SELECT nom FROM produits WHERE id = ?', a.produitId)!.nom
      }))

    return { venteId, numeroTicket, totalTtc: totaux.totalTtc, monnaieRendue, alertesStock }
  })
}
