/**
 * Propriétaire : Dev A.
 *
 * Rapports de caisse X et Z imprimés (tâche A4, règle 6.9), sur le modèle du ticket : lignes de
 * texte testables d'abord, octets ESC/POS ensuite. Même largeur (48 colonnes), même en-tête.
 */
import type { RapportCaisse } from '@shared/ipc/caisse'
import type { PageDeCodes } from '@shared/ipc/materiel'
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

export type TypeRapport = 'X' | 'Z'

export function lignesRapport(
  r: RapportCaisse,
  entete: EnteteTicket,
  options: { type: TypeRapport; duplicata: boolean }
): LigneImprimee[] {
  const l: LigneImprimee[] = []
  const ligne = (gauche: string, montant: number, gras = false): void => {
    l.push({ texte: colonnes(gauche, montantTicket(montant)), gras })
  }

  l.push({ texte: entete.nom.slice(0, LARGEUR / 2), centre: true, gras: true, double: true })
  l.push({ texte: `RAPPORT ${options.type}`, centre: true, gras: true, double: true })
  if (options.type === 'X') l.push({ texte: 'Provisoire : caisse non clôturée', centre: true })
  if (options.duplicata) l.push({ texte: 'DUPLICATA', centre: true, gras: true, double: true })
  l.push(SEPARATEUR)
  l.push({ texte: `Session  n° ${r.sessionId}` })
  l.push({ texte: `Caisse   ${r.caissier}` })
  l.push({ texte: `Ouverte  ${dateTicket(r.dateOuverture)}` })
  if (r.dateFermeture) l.push({ texte: `Fermée   ${dateTicket(r.dateFermeture)}` })
  l.push({ texte: `Tickets  ${r.nombreTickets}` })
  l.push(SEPARATEUR)

  l.push({ texte: 'VENTES PAR MODE DE PAIEMENT', gras: true })
  ligne('Espèces', r.totauxParMode.especes)
  ligne('TMoney', r.totauxParMode.tmoney)
  ligne('Flooz', r.totauxParMode.flooz)
  ligne('Crédit', r.totauxParMode.credit)
  ligne('Total des ventes', r.totalVentes, true)
  l.push(SEPARATEUR)

  // Tiret ordinaire pour les sorties : le signe moins typographique n'existe dans aucune page.
  l.push({ texte: 'ESPÈCES', gras: true })
  ligne('Fond d’ouverture', r.fondOuverture)
  ligne('+ Ventes en espèces', r.ventesEspeces)
  for (const m of r.mouvements) ligne(`${m.sens === 'entree' ? '+' : '-'} ${m.libelle}`, m.montant)
  ligne('= Espèces théoriques', r.especesTheoriques, true)

  if (options.type === 'Z' && r.montantCompte !== null && r.ecart !== null) {
    ligne('Espèces comptées', r.montantCompte)
    ligne('Écart', r.ecart, true)
    if (r.commentaire) {
      l.push({ texte: 'Commentaire :' })
      for (const t of couper(r.commentaire)) l.push({ texte: t })
    }
    l.push(SEPARATEUR)
    l.push({ texte: '' })
    l.push({ texte: 'Signature caisse :' })
    l.push({ texte: '' })
    l.push({ texte: 'Signature gérant :' })
  }
  if (options.duplicata) l.push({ texte: 'DUPLICATA', centre: true, gras: true })
  return l
}

export function mettreEnPageRapport(
  r: RapportCaisse,
  entete: EnteteTicket,
  pageDeCodes: PageDeCodes,
  options: { type: TypeRapport; duplicata: boolean }
): Buffer {
  return mettreEnPage(lignesRapport(r, entete, options), pageDeCodes)
}
