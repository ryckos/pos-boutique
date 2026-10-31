/**
 * Propriétaire : Dev A. Recouvrement des créances (A12, REGLES_METIER § 7.3).
 *
 * Règles validées par Dev A (2026-11-01) :
 * - la caissière comme le gérant encaissent, sur LEUR caisse ouverte : un encaissement sans session
 *   n'existe pas. Espèces, TMoney ou Flooz (référence obligatoire en mobile money) ;
 * - le paiement va sur la créance choisie ; sinon sur la plus ancienne d'abord, et se répartit sur
 *   plusieurs créances. Jamais plus que ce que le client doit. Un paiement partiel est permis ;
 * - les espèces entrent dans le tiroir (mouvement de caisse `encaissement_creance`, une ligne par
 *   créance payée) ; TMoney et Flooz n'y touchent jamais ;
 * - un paiement garde un numéro de reçu EC-AAAA-NNNNNN. Seul le gérant l'annule, avec un motif, tant
 *   que la caisse est ouverte : contre-mouvement de caisse, dette rétablie, rien n'est effacé ;
 * - la balance âgée classe le restant dû par ancienneté de la créance (0–30, 31–60, plus de 60 jours) ;
 *   la liste de relance retient les clients dont une échéance est dépassée.
 * Le reçu et le tiroir viennent APRÈS la transaction (ipc.ts) : une imprimante en panne ne défait rien.
 */
import type {
  BalanceAgee,
  EncaissementEnregistre,
  LigneBalanceAgee,
  LigneHistoriqueClient,
  LigneRelance,
  RequeteEncaissement
} from '@shared/ipc/clients'
import { formaterFCFA } from '@shared/format'
import {
  imputerPaiement,
  LIBELLES_MODE_ENCAISSEMENT,
  trancheAnciennete,
  type ModeEncaissement
} from '@shared/recouvrement'
import type { UtilisateurConnecte } from '@shared/types'
import type { Db } from '../../db/connexion'
import { avecTransaction, executer, toutes, une } from '../../db/requetes'
import { journaliser } from '../../core/audit'
import { ErreurMetier } from '../../core/erreurs'
import { prochainNumero } from '../../core/numerotation'
import { annulerMouvementCaisse, enregistrerMouvementCaisse } from '../caisse/service-mouvements'
import { sessionOuverte } from '../caisse/service-session'

export type EncaissementFait = Omit<EncaissementEnregistre, 'recuImprime' | 'tiroirOuvert'>

const MODES: ModeEncaissement[] = ['especes', 'tmoney', 'flooz']

interface CreanceDue {
  creanceId: number
  numeroTicket: string
  restantDu: number
}

const CREANCES_DUES = `
  SELECT v.creance_id AS creanceId, ve.numero_ticket AS numeroTicket, v.restant_du AS restantDu
    FROM v_creances_clients v JOIN ventes ve ON ve.id = v.vente_id
   WHERE v.client_id = ? AND v.restant_du > 0`

const restantClient = (db: Db, clientId: number): number =>
  une<{ n: number }>(
    db,
    'SELECT COALESCE(SUM(restant_du), 0) AS n FROM v_creances_clients WHERE client_id = ?',
    clientId
  )!.n

/** Encaisse `montant` d'un client sur sa caisse ouverte. Tout ou rien, relu dans la transaction. */
export function encaisserCreance(db: Db, u: UtilisateurConnecte, r: RequeteEncaissement): EncaissementFait {
  if (!Number.isInteger(r.montant) || r.montant <= 0) {
    throw new ErreurMetier('Montant invalide : saisissez un montant en francs, sans virgule.')
  }
  if (!MODES.includes(r.mode)) throw new ErreurMetier('Choisissez espèces, TMoney ou Flooz.')
  const reference = r.reference?.trim() || null
  if (r.mode !== 'especes' && !reference) {
    throw new ErreurMetier(`Saisissez la référence du transfert ${LIBELLES_MODE_ENCAISSEMENT[r.mode]}.`)
  }

  return avecTransaction(db, () => {
    const session = sessionOuverte(db, u.id)
    if (!session) {
      throw new ErreurMetier(
        'Ouvrez votre caisse avant d’encaisser un paiement : il passe par votre session.'
      )
    }
    const client = une<{ nom: string }>(db, 'SELECT nom FROM clients WHERE id = ?', r.clientId)
    if (!client) throw new ErreurMetier('Client introuvable : choisissez-le dans la liste.')

    let dues = toutes<CreanceDue>(db, `${CREANCES_DUES} ORDER BY v.cree_le, v.creance_id`, r.clientId)
    if (r.creanceId !== undefined) {
      dues = dues.filter((c) => c.creanceId === r.creanceId)
      if (dues.length === 0) throw new ErreurMetier('Cette créance est déjà payée ou n’est pas à ce client.')
    }
    if (dues.length === 0) throw new ErreurMetier(`${client.nom} ne doit rien : il n’y a rien à encaisser.`)
    const totalDu = dues.reduce((s, c) => s + c.restantDu, 0)
    const parts = imputerPaiement(dues, r.montant)
    if (!parts) {
      throw new ErreurMetier(
        `${client.nom} ne doit que ${formaterFCFA(totalDu)} : ${formaterFCFA(r.montant)} dépasse ce qu’il reste à payer.`
      )
    }

    const numeroRecu = prochainNumero(db, 'EC')
    const resultat = parts.map((p) => {
      const creance = dues.find((c) => c.creanceId === p.creanceId)!
      const { id } = executer(
        db,
        `INSERT INTO encaissements_creances
           (creance_id, montant, mode, reference, session_caisse_id, utilisateur_id, numero_recu)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        p.creanceId,
        p.montant,
        r.mode,
        reference,
        session.id,
        u.id,
        numeroRecu
      )
      // Les espèces entrent dans le tiroir ; le mobile money n'y touche jamais.
      if (r.mode === 'especes') {
        enregistrerMouvementCaisse(db, {
          sessionId: session.id,
          utilisateurId: u.id,
          sens: 'entree',
          motif: 'encaissement_creance',
          montant: p.montant,
          commentaire: `${client.nom}, ticket ${creance.numeroTicket}`,
          documentType: 'encaissement_creance',
          documentId: id
        })
      }
      return {
        creanceId: p.creanceId,
        numeroTicket: creance.numeroTicket,
        montant: p.montant,
        restantApres: creance.restantDu - p.montant
      }
    })
    const reste = restantClient(db, r.clientId)
    journaliser(db, {
      utilisateurId: u.id,
      action: 'encaissement_creance',
      entite: 'creances',
      entiteId: parts[0].creanceId,
      apres: {
        recu: numeroRecu,
        client: client.nom,
        montant: r.montant,
        mode: r.mode,
        ...(reference && { reference }),
        tickets: resultat.map((p) => p.numeroTicket).join(', '),
        resteDu: reste
      }
    })
    return {
      numeroRecu,
      client: client.nom,
      montant: r.montant,
      mode: r.mode,
      parts: resultat,
      restantClient: reste
    }
  })
}

/**
 * Annule un reçu : le gérant seul, motif obligatoire, tant que la caisse du paiement est ouverte.
 * Les espèces ressortent du tiroir par un contre-mouvement ; la dette redevient due.
 */
export function annulerEncaissement(
  db: Db,
  u: UtilisateurConnecte,
  a: { numeroRecu: string; motif: string }
): void {
  if (u.role === 'caissier') throw new ErreurMetier('Seul le gérant peut annuler un encaissement.')
  const motif = a.motif?.trim()
  if (!motif) throw new ErreurMetier('Indiquez le motif de l’annulation.')

  avecTransaction(db, () => {
    const lignes = toutes<{ id: number; sessionId: number; montant: number; mode: string; client: string }>(
      db,
      `SELECT e.id, e.session_caisse_id AS sessionId, e.montant, e.mode, cl.nom AS client
         FROM encaissements_creances e
         JOIN creances c ON c.id = e.creance_id JOIN clients cl ON cl.id = c.client_id
        WHERE e.numero_recu = ? ORDER BY e.id`,
      a.numeroRecu
    )
    if (lignes.length === 0) throw new ErreurMetier(`Reçu ${a.numeroRecu} introuvable : vérifiez le numéro.`)
    if (une(db, 'SELECT 1 FROM annulations_encaissements WHERE numero_recu = ?', a.numeroRecu)) {
      throw new ErreurMetier(`Le reçu ${a.numeroRecu} est déjà annulé.`)
    }
    const sessionId = lignes[0].sessionId
    const s = une<{ statut: string }>(db, 'SELECT statut FROM sessions_caisse WHERE id = ?', sessionId)!
    if (s.statut !== 'ouverte') {
      throw new ErreurMetier('Cette caisse est clôturée : l’encaissement ne s’annule plus.')
    }
    for (const l of lignes.filter((x) => x.mode === 'especes')) {
      const mouvement = une<{ id: number }>(
        db,
        `SELECT id FROM mouvements_caisse
          WHERE document_type = 'encaissement_creance' AND document_id = ? AND mouvement_origine_id IS NULL`,
        l.id
      )
      if (!mouvement) throw new Error(`Encaissement ${l.id} en espèces sans mouvement de caisse`)
      annulerMouvementCaisse(db, { mouvementId: mouvement.id, utilisateurId: u.id, motif })
    }
    executer(
      db,
      `INSERT INTO annulations_encaissements (numero_recu, motif, utilisateur_id, session_caisse_id)
       VALUES (?, ?, ?, ?)`,
      a.numeroRecu,
      motif,
      u.id,
      sessionId
    )
    const montant = lignes.reduce((somme, l) => somme + l.montant, 0)
    journaliser(db, {
      utilisateurId: u.id,
      action: 'annulation_encaissement',
      entite: 'encaissements_creances',
      entiteId: lignes[0].id,
      apres: { recu: a.numeroRecu, client: lignes[0].client, montant, motif }
    })
  })
}

/** Reçu tel qu'il s'imprime, relu en base. */
export interface RecuCreance {
  numeroRecu: string
  horodatage: string
  caissier: string
  client: string
  telephone: string | null
  mode: ModeEncaissement
  reference: string | null
  montant: number
  parts: { numeroTicket: string; montant: number; restantApres: number }[]
  restantClient: number
}

export function lireRecu(db: Db, numeroRecu: string): RecuCreance {
  const lignes = toutes<{
    horodatage: string
    caissier: string
    clientId: number
    client: string
    telephone: string | null
    mode: ModeEncaissement
    reference: string | null
    montant: number
    numeroTicket: string
    restantApres: number
  }>(
    db,
    `SELECT e.horodatage, u.nom AS caissier, cl.id AS clientId, cl.nom AS client, cl.telephone, e.mode,
            e.reference, e.montant, ve.numero_ticket AS numeroTicket, v.restant_du AS restantApres
       FROM encaissements_creances e
       JOIN utilisateurs u ON u.id = e.utilisateur_id
       JOIN creances c ON c.id = e.creance_id
       JOIN clients cl ON cl.id = c.client_id
       JOIN ventes ve ON ve.id = c.vente_id
       JOIN v_creances_clients v ON v.creance_id = c.id
      WHERE e.numero_recu = ? ORDER BY e.id`,
    numeroRecu
  )
  if (lignes.length === 0) throw new ErreurMetier(`Reçu ${numeroRecu} introuvable : vérifiez le numéro.`)
  const premiere = lignes[0]
  return {
    numeroRecu,
    horodatage: premiere.horodatage,
    caissier: premiere.caissier,
    client: premiere.client,
    telephone: premiere.telephone,
    mode: premiere.mode,
    reference: premiere.reference,
    montant: lignes.reduce((s, l) => s + l.montant, 0),
    parts: lignes.map((l) => ({
      numeroTicket: l.numeroTicket,
      montant: l.montant,
      restantApres: l.restantApres
    })),
    restantClient: restantClient(db, premiere.clientId)
  }
}

// --- Historique, balance âgée, relance ----------------------------------------------------------

/** Ordre des lignes qui portent la même seconde : la dette naît avant d'être payée ou annulée. */
const ORDRE: Record<LigneHistoriqueClient['type'], number> = {
  credit: 0,
  encaissement: 1,
  reduction: 2,
  annulation: 3
}

/** Tout ce qui a changé la dette du client, avec ce qu'il devait après chaque ligne. */
export function historiqueClient(db: Db, u: UtilisateurConnecte, clientId: number): LigneHistoriqueClient[] {
  if (!une(db, 'SELECT 1 FROM clients WHERE id = ?', clientId)) {
    throw new ErreurMetier('Client introuvable : rechargez la liste.')
  }
  const lignes: Omit<LigneHistoriqueClient, 'soldeApres'>[] = []

  for (const c of toutes<{ date: string; ticket: string; montant: number }>(
    db,
    `SELECT c.cree_le AS date, ve.numero_ticket AS ticket, c.montant_initial AS montant
       FROM creances c JOIN ventes ve ON ve.id = c.vente_id
      WHERE c.client_id = ? AND c.annulee_le IS NULL`,
    clientId
  )) {
    lignes.push({
      date: c.date,
      type: 'credit',
      libelle: `Vente à crédit ${c.ticket}`,
      variation: c.montant,
      numeroRecu: null,
      annulable: false
    })
  }

  const recus = toutes<{
    recu: string
    date: string
    mode: ModeEncaissement
    montant: number
    sessionOuverte: number
    annule: number
    dateAnnulation: string | null
  }>(
    db,
    `SELECT e.numero_recu AS recu, MIN(e.horodatage) AS date, e.mode, SUM(e.montant) AS montant,
            (s.statut = 'ouverte') AS sessionOuverte, (a.id IS NOT NULL) AS annule,
            a.horodatage AS dateAnnulation
       FROM encaissements_creances e
       JOIN creances c ON c.id = e.creance_id
       JOIN sessions_caisse s ON s.id = e.session_caisse_id
       LEFT JOIN annulations_encaissements a ON a.numero_recu = e.numero_recu
      WHERE c.client_id = ? AND e.numero_recu IS NOT NULL
      GROUP BY e.numero_recu`,
    clientId
  )
  for (const r of recus) {
    const mode = LIBELLES_MODE_ENCAISSEMENT[r.mode]
    lignes.push({
      date: r.date,
      type: 'encaissement',
      libelle: `Paiement ${r.recu} (${mode})`,
      variation: -r.montant,
      numeroRecu: r.recu,
      annulable: u.role !== 'caissier' && r.sessionOuverte === 1 && r.annule === 0
    })
    if (r.annule === 1 && r.dateAnnulation) {
      lignes.push({
        date: r.dateAnnulation,
        type: 'annulation',
        libelle: `Paiement ${r.recu} annulé`,
        variation: r.montant,
        numeroRecu: r.recu,
        annulable: false
      })
    }
  }

  for (const r of toutes<{ date: string; montant: number; retour: string; ticket: string }>(
    db,
    `SELECT x.horodatage AS date, x.montant, re.numero_ticket AS retour, ve.numero_ticket AS ticket
       FROM reductions_creances x
       JOIN creances c ON c.id = x.creance_id
       JOIN ventes re ON re.id = x.retour_id
       JOIN ventes ve ON ve.id = c.vente_id
      WHERE c.client_id = ?`,
    clientId
  )) {
    lignes.push({
      date: r.date,
      type: 'reduction',
      libelle: `Retour ${r.retour} sur le ticket ${r.ticket}`,
      variation: -r.montant,
      numeroRecu: null,
      annulable: false
    })
  }

  lignes.sort((a, b) => a.date.localeCompare(b.date) || ORDRE[a.type] - ORDRE[b.type])
  let solde = 0
  return lignes.map((l) => ({ ...l, soldeApres: (solde += l.variation) }))
}

interface LigneDue {
  clientId: number
  client: string
  telephone: string | null
  ticket: string
  restantDu: number
  jours: number
  echeance: string | null
  joursRetard: number
}

/** Les créances à payer, avec leur ancienneté et leur retard en jours (dates locales). */
function creancesDues(db: Db): LigneDue[] {
  return toutes<LigneDue>(
    db,
    `SELECT v.client_id AS clientId, cl.nom AS client, cl.telephone, ve.numero_ticket AS ticket,
            v.restant_du AS restantDu,
            CAST(julianday(date('now','localtime')) - julianday(date(v.cree_le)) AS INTEGER) AS jours,
            v.date_echeance AS echeance,
            CASE WHEN v.date_echeance IS NOT NULL AND v.date_echeance < date('now','localtime')
                 THEN CAST(julianday(date('now','localtime')) - julianday(v.date_echeance) AS INTEGER)
                 ELSE 0 END AS joursRetard
       FROM v_creances_clients v
       JOIN clients cl ON cl.id = v.client_id
       JOIN ventes ve ON ve.id = v.vente_id
      WHERE v.restant_du > 0
      ORDER BY cl.nom, v.cree_le`
  )
}

export function balanceAgee(db: Db): BalanceAgee {
  const parClient = new Map<number, LigneBalanceAgee>()
  for (const d of creancesDues(db)) {
    const l = parClient.get(d.clientId) ?? {
      clientId: d.clientId,
      client: d.client,
      telephone: d.telephone,
      jusqu30: 0,
      de31a60: 0,
      plus60: 0,
      total: 0,
      enRetard: 0
    }
    l[trancheAnciennete(d.jours)] += d.restantDu
    l.total += d.restantDu
    if (d.joursRetard > 0) l.enRetard += d.restantDu
    parClient.set(d.clientId, l)
  }
  const lignes = [...parClient.values()].sort(
    (a, b) => b.total - a.total || a.client.localeCompare(b.client, 'fr')
  )
  const totaux = lignes.reduce(
    (t, l) => ({
      jusqu30: t.jusqu30 + l.jusqu30,
      de31a60: t.de31a60 + l.de31a60,
      plus60: t.plus60 + l.plus60,
      total: t.total + l.total,
      enRetard: t.enRetard + l.enRetard
    }),
    { jusqu30: 0, de31a60: 0, plus60: 0, total: 0, enRetard: 0 }
  )
  return { lignes, totaux }
}

/** Les clients dont une échéance est dépassée, du plus en retard au moins en retard. */
export function listeRelance(db: Db): LigneRelance[] {
  const parClient = new Map<number, LigneRelance>()
  const dues = creancesDues(db)
  for (const d of dues) {
    if (d.joursRetard <= 0 || d.echeance === null) continue
    const l = parClient.get(d.clientId) ?? {
      clientId: d.clientId,
      client: d.client,
      telephone: d.telephone,
      montantEchu: 0,
      total: dues.filter((x) => x.clientId === d.clientId).reduce((s, x) => s + x.restantDu, 0),
      joursRetard: 0,
      tranche: 'jusqu30' as const,
      creances: []
    }
    l.montantEchu += d.restantDu
    l.joursRetard = Math.max(l.joursRetard, d.joursRetard)
    l.creances.push({
      numeroTicket: d.ticket,
      restantDu: d.restantDu,
      dateEcheance: d.echeance,
      joursRetard: d.joursRetard
    })
    parClient.set(d.clientId, l)
  }
  return [...parClient.values()]
    .map((l) => ({ ...l, tranche: trancheAnciennete(l.joursRetard) }))
    .sort((a, b) => b.joursRetard - a.joursRetard || b.montantEchu - a.montantEchu)
}
