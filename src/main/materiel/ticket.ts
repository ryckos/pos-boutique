/**
 * Propriétaire : Dev A.
 *
 * Mise en page du ticket de caisse (tâche A3), en deux temps pour être testable :
 *  1. `lignesTicket()` : le ticket en lignes de texte (48 colonnes en police normale sur 80 mm,
 *     24 en double taille), avec leur style ;
 *  2. `mettreEnPageTicket()` : ces lignes en octets ESC/POS, via l'encodeur validé en Phase 0.
 * Aucune dépendance à Electron ni à la base : les données arrivent déjà relues (service-ticket.ts).
 */
import type { PageDeCodes } from '@shared/ipc/materiel'
import type { VentilationTaux } from '../modules/caisse/calculs'
import { Builder, IMPULSION_TIROIR } from './escpos'

export const LARGEUR = 48
const LARGEUR_DOUBLE = LARGEUR / 2

export interface LigneTicketVente {
  designation: string
  quantite: number
  prixUnitaire: number
  totalLigne: number
}

export interface PaiementTicket {
  mode: string
  montant: number
  reference: string | null
}

/** Une vente telle qu'elle s'imprime : tout est relu en base (photocopie au moment T). */
export interface TicketAImprimer {
  numeroTicket: string
  /** 'AAAA-MM-JJ HH:MM:SS', heure locale, telle que stockée. */
  horodatage: string
  caissier: string
  lignes: LigneTicketVente[]
  totalTtc: number
  parTaux: VentilationTaux[]
  paiements: PaiementTicket[]
  montantRecu: number
  monnaieRendue: number
}

export interface EnteteTicket {
  nom: string
  adresse: string[]
  pied: string
}

export interface LigneImprimee {
  texte: string
  centre?: boolean
  gras?: boolean
  double?: boolean
}

const LIBELLES_MODES: Record<string, string> = {
  especes: 'Espèces',
  tmoney: 'TMoney',
  flooz: 'Flooz',
  carte: 'Carte',
  credit: 'Crédit',
  autre: 'Autre'
}

/**
 * 8500 → « 8 500 F », avec une espace ORDINAIRE : formaterFCFA() produit une espace fine
 * insécable qu'aucune page de codes de l'imprimante ne connaît.
 */
export function montantTicket(n: number): string {
  const signe = n < 0 ? '-' : ''
  const chiffres = String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${signe}${chiffres} F`
}

const taux = (t: number): string => `${String(t).replace('.', ',')} %`

/** '2026-09-24 10:42:05' → '24/09/2026 10:42' */
export function dateTicket(horodatage: string): string {
  const [date = '', heure = ''] = horodatage.split(' ')
  const [a, m, j] = date.split('-')
  return `${j}/${m}/${a} ${heure.slice(0, 5)}`
}

/** Texte à gauche, montant à droite, sur `largeur` colonnes ; le texte est tronqué si besoin. */
export function colonnes(gauche: string, droite: string, largeur = LARGEUR): string {
  const place = largeur - droite.length - 1
  const g = gauche.length > place ? gauche.slice(0, Math.max(place, 0)) : gauche
  return g + ' '.repeat(Math.max(largeur - g.length - droite.length, 1)) + droite
}

/** Coupe un texte en lignes de `largeur` colonnes, aux espaces si possible. */
export function couper(texte: string, largeur = LARGEUR): string[] {
  const lignes: string[] = []
  let courante = ''
  for (const mot of texte.split(/\s+/).filter(Boolean)) {
    let reste = mot
    while (reste.length > largeur) {
      if (courante) lignes.push(courante)
      lignes.push(reste.slice(0, largeur))
      reste = reste.slice(largeur)
      courante = ''
    }
    if (!courante) courante = reste
    else if (courante.length + 1 + reste.length <= largeur) courante += ` ${reste}`
    else {
      lignes.push(courante)
      courante = reste
    }
  }
  if (courante) lignes.push(courante)
  return lignes
}

export const SEPARATEUR: LigneImprimee = { texte: '-'.repeat(LARGEUR) }

/** Le ticket en lignes de texte, sans aucun octet de commande. */
export function lignesTicket(
  ticket: TicketAImprimer,
  entete: EnteteTicket,
  options: { duplicata: boolean }
): LigneImprimee[] {
  const l: LigneImprimee[] = []

  l.push({ texte: entete.nom.slice(0, LARGEUR_DOUBLE), centre: true, gras: true, double: true })
  for (const a of entete.adresse) for (const t of couper(a)) l.push({ texte: t, centre: true })
  if (options.duplicata) l.push({ texte: 'DUPLICATA', centre: true, gras: true, double: true })
  l.push(SEPARATEUR)
  l.push({ texte: `Ticket ${ticket.numeroTicket}` })
  l.push({ texte: `Date   ${dateTicket(ticket.horodatage)}` })
  l.push({ texte: `Caisse ${ticket.caissier}` })
  l.push(SEPARATEUR)

  for (const v of ticket.lignes) {
    const total = montantTicket(v.totalLigne)
    if (v.quantite === 1 && v.designation.length + 1 + total.length <= LARGEUR) {
      l.push({ texte: colonnes(v.designation, total) })
      continue
    }
    for (const t of couper(v.designation)) l.push({ texte: t })
    l.push({ texte: colonnes(`  ${v.quantite} x ${montantTicket(v.prixUnitaire)}`, total) })
  }

  l.push(SEPARATEUR)
  l.push({
    texte: colonnes('TOTAL', montantTicket(ticket.totalTtc), LARGEUR_DOUBLE),
    gras: true,
    double: true
  })
  // TVA ventilée par taux (règle 6.4) : prix TTC, HT et TVA calculés à la vente.
  for (const t of ticket.parTaux) {
    l.push({ texte: colonnes(`Dont HT ${taux(t.taux)}`, montantTicket(t.ht)) })
    l.push({ texte: colonnes(`Dont TVA ${taux(t.taux)}`, montantTicket(t.tva)) })
  }
  l.push(SEPARATEUR)

  for (const p of ticket.paiements) {
    const libelle = LIBELLES_MODES[p.mode] ?? p.mode
    l.push({
      texte: colonnes(p.reference ? `${libelle} (réf. ${p.reference})` : libelle, montantTicket(p.montant))
    })
  }
  if (ticket.montantRecu > 0) {
    l.push({ texte: colonnes('Espèces reçues', montantTicket(ticket.montantRecu)) })
    l.push({ texte: colonnes('Monnaie rendue', montantTicket(ticket.monnaieRendue)) })
  }

  l.push({ texte: '' })
  for (const t of couper(entete.pied)) l.push({ texte: t, centre: true })
  if (options.duplicata) l.push({ texte: 'DUPLICATA', centre: true, gras: true })
  return l
}

/**
 * Octets ESC/POS du ticket. L'impulsion du tiroir part EN TÊTE, dans le même envoi : le tiroir
 * s'ouvre pendant l'impression (il est alimenté par l'imprimante, port RJ11).
 */
export function mettreEnPageTicket(
  ticket: TicketAImprimer,
  entete: EnteteTicket,
  pageDeCodes: PageDeCodes,
  options: { duplicata: boolean; tiroir: boolean }
): Buffer {
  return mettreEnPage(lignesTicket(ticket, entete, options), pageDeCodes, { tiroir: options.tiroir })
}

/** Lignes de texte → octets ESC/POS (ticket, rapports X et Z), puis avance et coupe. */
export function mettreEnPage(
  lignes: LigneImprimee[],
  pageDeCodes: PageDeCodes,
  options: { tiroir: boolean } = { tiroir: false }
): Buffer {
  const b = new Builder().init()
  if (options.tiroir) b.raw(...IMPULSION_TIROIR)
  b.codepage(pageDeCodes)
  for (const ligne of lignes) {
    b.align(ligne.centre ? 1 : 0)
      .bold(!!ligne.gras)
      .size(!!ligne.double)
      .line(ligne.texte, pageDeCodes)
  }
  return b.size(false).bold(false).feed(4).cut().buffer()
}
