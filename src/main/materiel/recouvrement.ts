/**
 * Propriétaire : Dev A.
 *
 * Reçu de paiement d'une créance et liste de relance (A12, REGLES_METIER § 7.3), sur le modèle du
 * ticket : lignes de texte testables d'abord, octets ESC/POS ensuite. 48 colonnes, même en-tête.
 */
import type { LigneRelance } from '@shared/ipc/clients'
import type { PageDeCodes } from '@shared/ipc/materiel'
import { LIBELLES_MODE_ENCAISSEMENT, LIBELLES_TRANCHE, type Tranche } from '@shared/recouvrement'
import type { RecuCreance } from '../modules/clients/service-recouvrement'
import {
  colonnes,
  couper,
  dateTicket,
  type EnteteTicket,
  LARGEUR,
  type LigneImprimee,
  mettreEnPage,
  montantTicket,
  SEPARATEUR
} from './ticket'

/** Reçu remis au client : ce qu'il a payé, sur quels tickets, ce qu'il doit encore. */
export function lignesRecu(r: RecuCreance, entete: EnteteTicket): LigneImprimee[] {
  const l: LigneImprimee[] = []
  l.push({ texte: entete.nom.slice(0, LARGEUR / 2), centre: true, gras: true, double: true })
  for (const a of entete.adresse) l.push({ texte: a, centre: true })
  l.push(SEPARATEUR)
  l.push({ texte: 'REÇU DE PAIEMENT', centre: true, gras: true })
  l.push({ texte: r.numeroRecu, centre: true })
  l.push({ texte: dateTicket(r.horodatage), centre: true })
  l.push(SEPARATEUR)
  for (const t of couper(`Client : ${r.client}`)) l.push({ texte: t })
  if (r.telephone) l.push({ texte: `Tél.   : ${r.telephone}` })
  l.push({ texte: `Caisse : ${r.caissier}` })
  l.push(SEPARATEUR)
  for (const p of r.parts) {
    l.push({ texte: colonnes(`Ticket ${p.numeroTicket}`, montantTicket(p.montant)) })
    l.push({ texte: colonnes('  reste dû sur ce ticket', montantTicket(p.restantApres)) })
  }
  l.push(SEPARATEUR)
  l.push({ texte: colonnes('MONTANT PAYÉ', montantTicket(r.montant)), gras: true })
  l.push({ texte: colonnes('Mode', LIBELLES_MODE_ENCAISSEMENT[r.mode]) })
  if (r.reference) l.push({ texte: colonnes('Référence', r.reference) })
  l.push({ texte: colonnes('RESTE À PAYER', montantTicket(r.restantClient)), gras: true })
  l.push(SEPARATEUR)
  if (entete.pied) for (const t of couper(entete.pied)) l.push({ texte: t, centre: true })
  return l
}

/** Le tiroir part en tête du même envoi pour les espèces, comme pour un ticket de vente. */
export function mettreEnPageRecu(
  r: RecuCreance,
  entete: EnteteTicket,
  pageDeCodes: PageDeCodes,
  options: { tiroir: boolean }
): Buffer {
  return mettreEnPage(lignesRecu(r, entete), pageDeCodes, { tiroir: options.tiroir })
}

/** Liste de relance : les clients en retard, du plus ancien retard au plus récent, par tranche. */
export function lignesRelance(liste: LigneRelance[], entete: EnteteTicket, date: string): LigneImprimee[] {
  const l: LigneImprimee[] = []
  l.push({ texte: entete.nom.slice(0, LARGEUR / 2), centre: true, gras: true, double: true })
  l.push({ texte: 'LISTE DE RELANCE', centre: true, gras: true })
  l.push({ texte: `Au ${date}`, centre: true })
  l.push(SEPARATEUR)
  if (liste.length === 0) {
    l.push({ texte: 'Aucun client en retard.', centre: true })
    return l
  }
  const tranches: Tranche[] = ['plus60', 'de31a60', 'jusqu30']
  for (const t of tranches) {
    const clients = liste.filter((c) => c.tranche === t)
    if (clients.length === 0) continue
    l.push({ texte: `RETARD : ${LIBELLES_TRANCHE[t].toUpperCase()}`, gras: true })
    for (const c of clients) {
      l.push({ texte: colonnes(c.client, montantTicket(c.montantEchu)), gras: true })
      l.push({ texte: `  ${c.telephone ?? 'pas de téléphone'} - ${c.joursRetard} j de retard` })
      for (const x of c.creances) {
        l.push({ texte: colonnes(`  ${x.numeroTicket}`, montantTicket(x.restantDu)) })
      }
    }
    l.push(SEPARATEUR)
  }
  const total = liste.reduce((s, c) => s + c.montantEchu, 0)
  l.push({ texte: colonnes(`TOTAL EN RETARD (${liste.length})`, montantTicket(total)), gras: true })
  return l
}

export function mettreEnPageRelance(
  liste: LigneRelance[],
  entete: EnteteTicket,
  pageDeCodes: PageDeCodes,
  date: string
): Buffer {
  return mettreEnPage(lignesRelance(liste, entete, date), pageDeCodes)
}
