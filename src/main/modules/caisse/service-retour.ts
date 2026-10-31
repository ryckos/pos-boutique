/**
 * Propriétaire : Dev A.
 *
 * Retour client (tâche A7, règle 6.8). Précisions validées par Dev A (2026-10-13) :
 * - on part du ticket d'origine (numéro complet, ou « 158 » pour l'année en cours) ; on ne rend pas
 *   plus que vendu, ligne par ligne, retours précédents compris, en conditionnements de la ligne ;
 * - gérant, ou caissière avec le code du gérant (comme l'annulation, A6) ; le remboursement sort de
 *   la caisse OUVERTE de celui qui fait le retour, quel que soit le jour du ticket ;
 * - le retour est une vente `type = 'retour'` numérotée R-AAAA-NNNNNN, liée au ticket
 *   (`vente_origine_id`), en montants négatifs, avec un paiement négatif. Rien n'est écrit dans
 *   `mouvements_caisse` : le X et le Z lisent les remboursements dans ces paiements ;
 * - montant rendu = ce que le client a payé (net de la remise de ligne et de sa part de la remise du
 *   ticket), au prorata, le dernier retour d'une ligne prenant le reste (`montantRetourLigne`) ;
 * - espèces, TMoney ou Flooz (référence obligatoire) ; en espèces, pas plus que le tiroir. Avoir en
 *   boutique (A11, § 7.2) : crédit nominatif créé avec le retour, paiement négatif `avoir`, rien ne
 *   sort du tiroir. Un ticket payé en partie par avoir ne se rembourse qu'en avoir, au même client ;
 * - stock : un `retour_client` (+) sur les lots servis à la vente, le dernier servi d'abord, au coût de
 *   la sortie d'origine ; « Détruire » ajoute un `casse` (−) sur le même lot. Le CUMP ne bouge pas ;
 * - journal `retour_client`. Le tiroir s'ouvre ensuite (ipc.ts) si le remboursement est en espèces.
 * Le ticket d'origine n'est jamais modifié.
 */
import type { LigneTicketRetour, RequeteRetour, RetourEnregistre, TicketRetour } from '@shared/ipc/caisse'
import { formaterFCFA } from '@shared/format'
import {
  LIBELLES_MOTIF_RETOUR,
  LIBELLES_SORT_RETOUR,
  type ModeRemboursement,
  montantRetourLigne,
  numeroTicketComplet,
  quantiteRetournable,
  texteMotifRetour
} from '@shared/retour'
import type { UtilisateurConnecte } from '@shared/types'
import type { Db } from '../../db/connexion'
import { avecTransaction, executer, toutes, une } from '../../db/requetes'
import { enregistrerMouvement } from '../../core/mouvements'
import { prochainNumero } from '../../core/numerotation'
import { journaliser } from '../../core/audit'
import { ErreurMetier } from '../../core/erreurs'
import { repartirRemise, ventilerTva } from './calculs'
import { autoriseParGerant } from './service-annulation'
import { creerAvoir } from '../clients/service-avoir'
import { rapportSession } from './service-cloture'
import { sessionOuverte } from './service-session'
import { venteParNumero } from './service-ticket'

const MODES: Record<ModeRemboursement, string> = {
  especes: 'Espèces',
  tmoney: 'TMoney',
  flooz: 'Flooz',
  avoir: 'Avoir en boutique'
}

interface VenteOrigine {
  id: number
  numeroTicket: string
  type: string
  statut: string
  horodatage: string
  caissier: string
  totalTtc: number
  remiseGlobale: number
  estCredit: number
  clientId: number | null
}

/** Une ligne vendue, avec ce qu'il faut pour la rendre. */
interface LigneOrigine extends LigneTicketRetour {
  produitId: number
  conditionnementId: number
  tauxTva: number
  /** Coût d'un conditionnement, copié de la vente. */
  coutUnitaire: number
  /** Unités de base par conditionnement vendu. */
  quantiteBase: number
}

function lireOrigine(db: Db, venteId: number): VenteOrigine {
  return une<VenteOrigine>(
    db,
    `SELECT v.id, v.numero_ticket AS numeroTicket, v.type, v.statut, v.horodatage, u.nom AS caissier,
            v.total_ttc AS totalTtc, v.remise_globale AS remiseGlobale, v.est_credit AS estCredit,
            v.client_id AS clientId
     FROM ventes v JOIN utilisateurs u ON u.id = v.utilisateur_id WHERE v.id = ?`,
    venteId
  )!
}

/**
 * Lignes du ticket, ce qui a été payé pour chacune et ce qui en a déjà été rendu. La remise du ticket
 * est répartie entre les lignes au prorata de leur montant (même calcul que pour la TVA, règle 6.6).
 */
function lireLignes(db: Db, v: VenteOrigine): LigneOrigine[] {
  const lignes = toutes<{
    ligneId: number
    produitId: number
    conditionnementId: number
    designation: string
    quantite: number
    prixUnitaire: number
    tauxTva: number
    coutUnitaire: number
    quantiteBaseTotale: number
    totalLigne: number
  }>(
    db,
    `SELECT id AS ligneId, produit_id AS produitId, conditionnement_id AS conditionnementId, designation,
            quantite, prix_unitaire AS prixUnitaire, taux_tva AS tauxTva, cout_unitaire AS coutUnitaire,
            quantite_base_totale AS quantiteBaseTotale, total_ligne AS totalLigne
     FROM lignes_vente WHERE vente_id = ? ORDER BY id`,
    v.id
  )
  const deja = toutes<{ ligneId: number; quantite: number; montant: number }>(
    db,
    `SELECT l.ligne_origine_id AS ligneId, SUM(l.quantite) AS quantite, -SUM(l.total_ligne) AS montant
     FROM lignes_vente l JOIN ventes r ON r.id = l.vente_id
     WHERE r.vente_origine_id = ? AND r.type = 'retour' AND r.statut = 'terminee'
     GROUP BY l.ligne_origine_id`,
    v.id
  )
  const parts = repartirRemise(
    lignes.map((l) => l.totalLigne),
    v.remiseGlobale
  )
  return lignes.map((l, i) => {
    const d = deja.find((x) => x.ligneId === l.ligneId)
    const montantPaye = l.totalLigne - parts[i]
    const montantDejaRembourse = d?.montant ?? 0
    return {
      ligneId: l.ligneId,
      produitId: l.produitId,
      conditionnementId: l.conditionnementId,
      designation: l.designation,
      prixUnitaire: l.prixUnitaire,
      tauxTva: l.tauxTva,
      coutUnitaire: l.coutUnitaire,
      quantiteBase: l.quantiteBaseTotale / l.quantite,
      quantiteVendue: l.quantite,
      quantiteDejaRetournee: d?.quantite ?? 0,
      montantPaye,
      montantDejaRembourse,
      totalLigne: montantPaye - montantDejaRembourse
    }
  })
}

/** Pourquoi on ne peut rien retourner sur ce ticket, ou faire un retour maintenant ; null sinon. */
function raisonRefus(db: Db, u: UtilisateurConnecte, v: VenteOrigine, lignes: LigneOrigine[]): string | null {
  if (v.type !== 'ticket') {
    return `Le document ${v.numeroTicket} n’est pas un ticket de vente : retrouvez le ticket d’origine.`
  }
  if (v.statut === 'annulee') return `Le ticket ${v.numeroTicket} est annulé : il n’y a rien à retourner.`
  if (v.statut !== 'terminee') return `Le ticket ${v.numeroTicket} n’est pas encaissé.`
  // Le rendu devrait d'abord réduire la créance : réglé avec le recouvrement (A12, validé le 2026-10-28).
  if (v.estCredit) {
    return `Le ticket ${v.numeroTicket} est à crédit : son retour n’est pas encore possible, voyez le gérant.`
  }
  if (lignes.every((l) => quantiteRetournable(l) <= 0)) {
    return `Tous les articles du ticket ${v.numeroTicket} ont déjà été retournés.`
  }
  if (!sessionOuverte(db, u.id)) {
    return 'Ouvrez votre caisse avant de faire un retour : le remboursement sort de votre tiroir.'
  }
  return null
}

const venteDuNumero = (db: Db, saisie: string): number =>
  venteParNumero(db, numeroTicketComplet(String(saisie ?? ''), new Date().getFullYear()))

/** Ce que la fenêtre de retour affiche, avant toute décision. */
export function consulterRetour(db: Db, u: UtilisateurConnecte, numeroTicket: string): TicketRetour {
  const v = lireOrigine(db, venteDuNumero(db, numeroTicket))
  const lignes = lireLignes(db, v)
  return {
    venteId: v.id,
    numeroTicket: v.numeroTicket,
    horodatage: v.horodatage,
    caissier: v.caissier,
    totalTtc: v.totalTtc,
    lignes: lignes.map((l) => ({
      ligneId: l.ligneId,
      designation: l.designation,
      prixUnitaire: l.prixUnitaire,
      totalLigne: l.totalLigne,
      quantiteVendue: l.quantiteVendue,
      quantiteDejaRetournee: l.quantiteDejaRetournee,
      montantPaye: l.montantPaye,
      montantDejaRembourse: l.montantDejaRembourse
    })),
    paiements: toutes(
      db,
      'SELECT mode, montant, reference FROM paiements WHERE vente_id = ? AND montant > 0 ORDER BY id',
      v.id
    ),
    retoursPrecedents: toutes<{ numero: string }>(
      db,
      `SELECT numero_ticket AS numero FROM ventes
       WHERE vente_origine_id = ? AND type = 'retour' AND statut = 'terminee' ORDER BY id`,
      v.id
    ).map((r) => r.numero),
    raisonRefus: raisonRefus(db, u, v, lignes),
    clientAvoir: payeParAvoir(db, v)
  }
}

/** Le client dont l'avoir a payé une part du ticket (il faut alors rembourser en avoir), sinon null. */
function payeParAvoir(db: Db, v: VenteOrigine): { id: number; nom: string } | null {
  const paye = une<{ n: number }>(
    db,
    "SELECT COUNT(*) AS n FROM paiements WHERE vente_id = ? AND mode = 'avoir' AND montant > 0",
    v.id
  )!.n
  if (paye === 0 || v.clientId === null) return null
  return une<{ id: number; nom: string }>(db, 'SELECT id, nom FROM clients WHERE id = ?', v.clientId) ?? null
}

/** Contrôles qui ne dépendent pas de la base : motif, sort, remboursement, forme des lignes. */
function controlerDemande(demande: RequeteRetour): { motif: string; reference: string | null } {
  if (!Object.hasOwn(LIBELLES_MOTIF_RETOUR, demande.motif))
    throw new ErreurMetier('Choisissez le motif du retour.')
  const motif = texteMotifRetour(demande.motif, demande.precision)
  if (!motif) throw new ErreurMetier('Motif « Autre » : précisez la raison du retour.')
  if (!Object.hasOwn(LIBELLES_SORT_RETOUR, demande.sort)) {
    throw new ErreurMetier('Choisissez le sort du produit : détruire ou remettre en stock.')
  }
  const mode = demande.remboursement?.mode
  // hasOwn et non « in » : un mode forgé comme 'constructor' ne doit pas passer.
  if (!mode || !Object.hasOwn(MODES, mode)) {
    throw new ErreurMetier('Remboursement : choisissez espèces, TMoney ou Flooz.')
  }
  const reference = demande.remboursement.reference?.trim() || null
  if (mode === 'avoir' && !Number.isInteger(demande.clientId)) {
    throw new ErreurMetier('Avoir en boutique : choisissez le client à qui il est destiné.')
  }
  if (mode !== 'especes' && mode !== 'avoir' && !reference) {
    throw new ErreurMetier(`Saisissez la référence du transfert ${MODES[mode]} fait au client.`)
  }
  const lignes = demande.lignes ?? []
  if (lignes.length === 0) throw new ErreurMetier('Cochez au moins un article à retourner.')
  if (new Set(lignes.map((l) => l.ligneId)).size !== lignes.length) {
    throw new ErreurMetier('Un article est coché deux fois : cochez chaque ligne une seule fois.')
  }
  for (const l of lignes) {
    if (!Number.isInteger(l.quantite) || l.quantite < 1) {
      throw new ErreurMetier('Quantité retournée invalide : saisissez un nombre entier d’au moins 1.')
    }
  }
  return { motif, reference }
}

/**
 * Lots à reprendre pour `quantite` unités de base d'un produit : ceux que la vente d'origine a servis,
 * moins ce que les retours précédents (et les lignes déjà passées de ce retour) ont repris, le dernier
 * servi d'abord. Lot NULL = part vendue sans lot.
 */
function lotsAReprendre(
  db: Db,
  origineId: number,
  produitId: number,
  quantite: number,
  coutParDefaut: number
): { lotId: number | null; quantite: number; cout: number }[] {
  const vendus = toutes<{ lotId: number | null; quantite: number; cout: number }>(
    db,
    `SELECT lot_id AS lotId, -SUM(quantite) AS quantite, MAX(cout_unitaire) AS cout
     FROM mouvements_stock
     WHERE document_type = 'vente' AND document_id = ? AND type = 'vente' AND produit_id = ?
     GROUP BY lot_id ORDER BY MAX(id) DESC`,
    origineId,
    produitId
  )
  const repris = toutes<{ lotId: number | null; quantite: number }>(
    db,
    `SELECT m.lot_id AS lotId, SUM(m.quantite) AS quantite
     FROM mouvements_stock m JOIN ventes r ON r.id = m.document_id
     WHERE m.document_type = 'vente' AND m.type = 'retour_client' AND m.produit_id = ?
       AND r.vente_origine_id = ? AND r.statut = 'terminee'
     GROUP BY m.lot_id`,
    produitId,
    origineId
  )
  const parts: { lotId: number | null; quantite: number; cout: number }[] = []
  let reste = quantite
  for (const v of vendus) {
    if (reste <= 0) break
    const dispo = v.quantite - (repris.find((r) => r.lotId === v.lotId)?.quantite ?? 0)
    const prise = Math.min(dispo, reste)
    if (prise > 0) {
      parts.push({ lotId: v.lotId, quantite: prise, cout: v.cout })
      reste -= prise
    }
  }
  // Filet : une vente d'avant les mouvements par lot. Ne devrait pas arriver, jamais bloquant.
  if (reste > 0) parts.push({ lotId: null, quantite: reste, cout: coutParDefaut })
  return parts
}

export function enregistrerRetour(db: Db, u: UtilisateurConnecte, demande: RequeteRetour): RetourEnregistre {
  const { motif, reference } = controlerDemande(demande)
  const mode = demande.remboursement.mode
  const origineId = venteDuNumero(db, demande.numeroTicket)
  // Refus visibles avant de demander le code : inutile de faire taper le gérant pour rien.
  const avant = lireOrigine(db, origineId)
  const refus = raisonRefus(db, u, avant, lireLignes(db, avant))
  if (refus) throw new ErreurMetier(refus)
  const gerantId = autoriseParGerant(db, u, demande.autorisation, 'Un retour client')

  return avecTransaction(db, () => {
    // Relu dans la transaction : un autre retour a pu passer entre-temps.
    const v = lireOrigine(db, origineId)
    const lignesOrigine = lireLignes(db, v)
    const refusTardif = raisonRefus(db, u, v, lignesOrigine)
    if (refusTardif) throw new ErreurMetier(refusTardif)
    const session = sessionOuverte(db, u.id)!
    const clientAvoir = payeParAvoir(db, v)
    if (clientAvoir && (mode !== 'avoir' || demande.clientId !== clientAvoir.id)) {
      throw new ErreurMetier(
        `Le ticket ${v.numeroTicket} a été payé en partie par avoir : remboursez en avoir en boutique, au nom de ${clientAvoir.nom}.`
      )
    }

    const lignes = demande.lignes.map((d) => {
      const l = lignesOrigine.find((x) => x.ligneId === d.ligneId)
      if (!l) throw new ErreurMetier(`Un article coché n’est pas sur le ticket ${v.numeroTicket}.`)
      const retournable = quantiteRetournable(l)
      if (d.quantite > retournable) {
        throw new ErreurMetier(
          retournable === 0
            ? `« ${l.designation} » a déjà été entièrement retourné.`
            : `« ${l.designation} » : on ne peut pas rendre plus que vendu (encore ${retournable} au plus).`
        )
      }
      return { ...l, quantiteRendue: d.quantite, montant: montantRetourLigne(l, d.quantite) }
    })
    const montant = lignes.reduce((s, l) => s + l.montant, 0)

    if (mode === 'especes' && montant > 0) {
      const { especesTheoriques } = rapportSession(db, session.id)
      if (montant > especesTheoriques) {
        throw new ErreurMetier(
          `Il n’y a que ${formaterFCFA(Math.max(0, especesTheoriques))} en caisse : impossible de rendre ${formaterFCFA(montant)} en espèces. Remboursez par TMoney ou Flooz.`
        )
      }
    }

    // TVA ventilée sur les montants rendus, comme à la vente, puis enregistrée en négatif.
    const totaux = ventilerTva(lignes.map((l) => ({ totalTtc: l.montant, tauxTva: l.tauxTva })))
    const numeroRetour = prochainNumero(db, 'R')
    const retourId = executer(
      db,
      `INSERT INTO ventes (numero_ticket, session_caisse_id, utilisateur_id, type, vente_origine_id,
                           total_ht, total_tva, total_ttc, motif_retour, sort_retour)
       VALUES (?, ?, ?, 'retour', ?, ?, ?, ?, ?, ?)`,
      numeroRetour,
      session.id,
      u.id,
      v.id,
      -totaux.totalHt,
      -totaux.totalTva,
      -totaux.totalTtc,
      motif,
      demande.sort
    ).id

    const motifStock = `Retour ${numeroRetour} du ticket ${v.numeroTicket} : ${motif}`
    for (const l of lignes) {
      const quantiteBase = l.quantiteRendue * l.quantiteBase
      const parts = lotsAReprendre(db, v.id, l.produitId, quantiteBase, l.coutUnitaire / l.quantiteBase)
      // Photocopie de la ligne vendue ; le montant rendu en négatif, la part des remises non rendue
      // dans remise_ligne (quantite × prix − rendu), le lien vers la ligne d'origine.
      executer(
        db,
        `INSERT INTO lignes_vente (vente_id, produit_id, conditionnement_id, lot_id, designation, quantite,
                                   prix_unitaire, remise_ligne, taux_tva, cout_unitaire, quantite_base_totale,
                                   total_ligne, ligne_origine_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        retourId,
        l.produitId,
        l.conditionnementId,
        parts.length === 1 ? parts[0].lotId : null,
        l.designation,
        l.quantiteRendue,
        l.prixUnitaire,
        Math.max(0, l.quantiteRendue * l.prixUnitaire - l.montant),
        l.tauxTva,
        l.coutUnitaire,
        quantiteBase,
        -l.montant,
        l.ligneId
      )
      for (const p of parts) {
        const mouvement = {
          produitId: l.produitId,
          lotId: p.lotId,
          coutUnitaire: p.cout,
          documentType: 'vente',
          documentId: retourId,
          motif: motifStock,
          utilisateurId: u.id
        }
        // Le produit revient toujours en stock ; détruit, il en ressort aussitôt (la perte est tracée).
        enregistrerMouvement(db, { ...mouvement, type: 'retour_client', quantite: p.quantite })
        if (demande.sort === 'detruire')
          enregistrerMouvement(db, { ...mouvement, type: 'casse', quantite: -p.quantite })
      }
    }

    // Article entièrement remisé : rien à rendre, pas de paiement à 0 F.
    if (montant > 0) {
      executer(
        db,
        'INSERT INTO paiements (vente_id, mode, montant, reference) VALUES (?, ?, ?, ?)',
        retourId,
        mode,
        -montant,
        reference
      )
    }
    const creation =
      mode === 'avoir' && montant > 0
        ? creerAvoir(db, { clientId: demande.clientId!, retourId, montant, utilisateurId: u.id })
        : null
    const avoir = creation && {
      numero: creation.numero,
      montant: creation.montant,
      client: creation.client,
      soldeClient: creation.soldeClient
    }

    journaliser(db, {
      utilisateurId: u.id,
      action: 'retour_client',
      entite: 'ventes',
      entiteId: retourId,
      apres: {
        numeroRetour,
        ticketOrigine: v.numeroTicket,
        montant,
        mode,
        ...(avoir && { avoir: avoir.numero, client: avoir.client }),
        motif,
        sort: demande.sort,
        ...(gerantId !== u.id && { autoriseeParId: gerantId })
      }
    })

    return {
      venteId: retourId,
      numeroRetour,
      numeroTicketOrigine: v.numeroTicket,
      montant,
      mode,
      avoir,
      tiroirOuvert: false
    }
  })
}
