/**
 * Propriétaire : Dev A.
 *
 * État de la fenêtre de paiement (UI_UX § 5.3), en fonctions pures (tests/paiement.test.ts).
 * Ces contrôles servent au confort de la caissière ; le service `enregistrerVente` refait tous
 * les contrôles en base et reste seul juge.
 *
 * Choix d'ergonomie validés par Dev A (2026-09-24), après essai :
 * - les ESPÈCES PRENNENT TOUJOURS LE RESTE : on ne saisit que les montants TMoney / Flooz, la part
 *   en espèces se calcule. Un seul champ lié aux espèces : le montant REÇU du client (monnaie) ;
 *   deux champs « payé » et « reçu » prêtaient à confusion ;
 * - sans espèces, avec TMoney et Flooz, l'un prend le reste de l'autre ;
 * - les billets rapides s'ADDITIONNENT (5 000 puis 2 000 = 7 000 reçus) ; un montant reçu laissé
 *   vide vaut le montant exact, pour que « Espèces » puis « Encaisser » suffise.
 */
import type { ModePaiementCaisse, RequeteVente } from '@shared/ipc/caisse'
import type { Client } from '@shared/ipc/clients'
import { resteDisponible } from '../clients/clients'
import { formaterFCFA } from '@shared/format'

export type ModeMobile = Exclude<ModePaiementCaisse, 'especes'>

export const LIBELLES_MODES: Record<ModePaiementCaisse, string> = {
  especes: 'Espèces',
  tmoney: 'TMoney',
  flooz: 'Flooz'
}

export const MODES_MOBILES: ModeMobile[] = ['tmoney', 'flooz']

export const BILLETS_RAPIDES = [1000, 2000, 5000, 10000] as const

export interface PaiementMobile {
  mode: ModeMobile
  montant: number
  /** Référence de la transaction, obligatoire. */
  reference: string
}

/** Le client à qui l'on vend à crédit, tel que le choix de client le renvoie. */
export type ClientCredit = Pick<Client, 'id' | 'nom' | 'plafondCredit' | 'encours' | 'enRetard'>

/** Part laissée à crédit (A11, REGLES_METIER § 7.1) : un montant saisi, comme TMoney et Flooz. */
export interface PartCredit {
  client: ClientCredit
  montant: number
  /** 'AAAA-MM-JJ' */
  echeance: string
}

/** Le client dont on dépense l'avoir en boutique (A11, REGLES_METIER § 7.2). */
export type ClientAvoir = Pick<Client, 'id' | 'nom' | 'soldeAvoir'>

/** Part payée par avoir : un montant, jamais au-delà du solde du client. */
export interface PartAvoir {
  client: ClientAvoir
  montant: number
}

export interface EtatPaiement {
  total: number
  /** Les espèces font partie du paiement ; leur montant est toujours le reste. */
  especes: boolean
  mobiles: PaiementMobile[]
  /** Espèces données par le client ; null = montant exact. */
  recu: number | null
  /** Part à crédit ; null = pas de crédit. */
  credit: PartCredit | null
  /** Part payée par avoir ; null = pas d'avoir. */
  avoir: PartAvoir | null
}

/** Montant saisi au clavier → entier FCFA ≥ 0 (tout ce qui n'est pas un chiffre est ignoré). */
export function lireMontant(saisie: string): number {
  const chiffres = saisie.replace(/\D/g, '')
  return chiffres ? Number.parseInt(chiffres, 10) : 0
}

/**
 * Ouvre le paiement. Un crédit demande le client et l'échéance et commence par tout le total. Un avoir
 * commence par le plus que le solde permet ; s'il ne couvre pas tout, les espèces prennent le reste.
 */
export function ouvrirPaiement(
  total: number,
  mode: ModePaiementCaisse,
  credit: Omit<PartCredit, 'montant'> | null = null,
  clientAvoir: ClientAvoir | null = null
): EtatPaiement {
  if (credit) {
    return { total, especes: false, mobiles: [], recu: null, credit: { ...credit, montant: total }, avoir: null }
  }
  if (clientAvoir) {
    const montant = Math.min(total, clientAvoir.soldeAvoir)
    return {
      total,
      especes: montant < total,
      mobiles: [],
      recu: null,
      credit: null,
      avoir: { client: clientAvoir, montant }
    }
  }
  return mode === 'especes'
    ? { total, especes: true, mobiles: [], recu: null, credit: null, avoir: null }
    : {
        total,
        especes: false,
        mobiles: [{ mode, montant: total, reference: '' }],
        recu: null,
        credit: null,
        avoir: null
      }
}

const totalMobiles = (etat: EtatPaiement): number => etat.mobiles.reduce((s, m) => s + m.montant, 0)

/** Ce que TMoney, Flooz, le crédit et l'avoir couvrent déjà : les espèces prennent le reste. */
const dejaCouvert = (etat: EtatPaiement): number =>
  totalMobiles(etat) + (etat.credit?.montant ?? 0) + (etat.avoir?.montant ?? 0)

export function nombreDeModes(etat: EtatPaiement): number {
  return etat.mobiles.length + (etat.especes ? 1 : 0) + (etat.credit ? 1 : 0) + (etat.avoir ? 1 : 0)
}

/** Part payée en espèces : ce que TMoney, Flooz et le crédit ne couvrent pas. */
export function partEspeces(etat: EtatPaiement): number {
  return etat.especes ? Math.max(etat.total - dejaCouvert(etat), 0) : 0
}

/** Positif : il manque ; négatif : les modes saisis dépassent le total. */
export function resteAPayer(etat: EtatPaiement): number {
  return etat.total - dejaCouvert(etat) - partEspeces(etat)
}

export function monnaieARendre(etat: EtatPaiement): number {
  return etat.recu === null ? 0 : Math.max(etat.recu - partEspeces(etat), 0)
}

/** Ajoute un mode (paiement mixte). Un mode mobile ajouté prend le reste s'il n'y a pas d'espèces. */
export function ajouterMode(etat: EtatPaiement, mode: ModePaiementCaisse): EtatPaiement {
  const base = limiterCredit(etat)
  if (mode === 'especes') return base.especes ? base : { ...base, especes: true }
  if (base.mobiles.some((m) => m.mode === mode)) return base
  const montant = base.especes ? 0 : Math.max(base.total - dejaCouvert(base), 0)
  return { ...base, mobiles: [...base.mobiles, { mode, montant, reference: '' }] }
}

/**
 * Un crédit seul couvre tout le total : dès qu'on ajoute un autre mode, il se limite à ce que le client
 * peut encore emprunter, pour que le reste se règle tout de suite (8 500 F, 5 000 F disponibles →
 * 5 000 F à crédit, 3 500 F à payer).
 */
function limiterCredit(etat: EtatPaiement): EtatPaiement {
  const c = etat.credit
  if (!c || etat.especes || etat.mobiles.length > 0) return etat
  return { ...etat, credit: { ...c, montant: Math.min(c.montant, resteDisponible(c.client)) } }
}

/**
 * Retire un mode ; il en reste toujours un. Un mode mobile resté seul, sans espèces, reprend tout
 * le total (son montant n'est plus modifiable à l'écran).
 */
export function retirerMode(etat: EtatPaiement, mode: ModePaiementCaisse | 'credit' | 'avoir'): EtatPaiement {
  if (nombreDeModes(etat) <= 1) return etat
  const especes = mode === 'especes' ? false : etat.especes
  const credit = mode === 'credit' ? null : etat.credit
  const avoir = mode === 'avoir' ? null : etat.avoir
  let mobiles = etat.mobiles.filter((m) => m.mode !== mode)
  if (!especes && !credit && !avoir && mobiles.length === 1) mobiles = [{ ...mobiles[0], montant: etat.total }]
  return { ...etat, especes, mobiles, credit, avoir, recu: especes ? etat.recu : null }
}

export function changerAvoir(etat: EtatPaiement, montant: number): EtatPaiement {
  if (!etat.avoir) return etat
  return { ...etat, avoir: { ...etat.avoir, montant: Math.max(Math.trunc(montant), 0) } }
}

export function changerCredit(etat: EtatPaiement, montant: number): EtatPaiement {
  if (!etat.credit) return etat
  return { ...etat, credit: { ...etat.credit, montant: Math.max(Math.trunc(montant), 0) } }
}

export function changerEcheance(etat: EtatPaiement, echeance: string): EtatPaiement {
  return etat.credit ? { ...etat, credit: { ...etat.credit, echeance } } : etat
}

/** Sans espèces, avec deux modes mobiles, l'autre prend le reste : 3 500 en TMoney → 5 000 en Flooz. */
export function changerMontant(etat: EtatPaiement, mode: ModeMobile, montant: number): EtatPaiement {
  const m = Math.max(Math.trunc(montant), 0)
  const equilibrer = !etat.especes && !etat.credit && !etat.avoir && etat.mobiles.length === 2
  const mobiles = etat.mobiles.map((p) => {
    if (p.mode === mode) return { ...p, montant: m }
    return equilibrer ? { ...p, montant: Math.max(etat.total - m, 0) } : p
  })
  return { ...etat, mobiles }
}

export function changerReference(etat: EtatPaiement, mode: ModeMobile, reference: string): EtatPaiement {
  return { ...etat, mobiles: etat.mobiles.map((p) => (p.mode === mode ? { ...p, reference } : p)) }
}

export function ajouterBillet(etat: EtatPaiement, billet: number): EtatPaiement {
  return { ...etat, recu: (etat.recu ?? 0) + billet }
}

export function montantExact(etat: EtatPaiement): EtatPaiement {
  return { ...etat, recu: partEspeces(etat) }
}

export function changerRecu(etat: EtatPaiement, recu: number | null): EtatPaiement {
  return { ...etat, recu: recu === null ? null : Math.max(Math.trunc(recu), 0) }
}

/**
 * Ce qui empêche d'encaisser, dans l'ordre où la caissière doit le corriger, ou null.
 * Mêmes messages que le service, pour ne jamais surprendre.
 */
export function blocage(etat: EtatPaiement): string | null {
  const reste = resteAPayer(etat)
  if (reste > 0) return `Reste à payer : ${formaterFCFA(reste)}.`
  if (reste < 0) {
    return `Paiement supérieur au total de ${formaterFCFA(-reste)} : baissez le montant ${etat.mobiles
      .map((m) => LIBELLES_MODES[m.mode])
      .join(' ou ')}.`
  }
  const c = etat.credit
  if (c) {
    if (c.montant === 0) return 'Saisissez le montant laissé à crédit, ou retirez le crédit.'
    const dispo = resteDisponible(c.client)
    if (c.montant > dispo) {
      return `Ce crédit dépasse le plafond de ${c.client.nom} : il peut encore prendre ${formaterFCFA(dispo)}. Baissez le montant, ou demandez au gérant de relever le plafond.`
    }
    if (!c.echeance) return 'Choisissez la date d’échéance du crédit.'
  }
  const a = etat.avoir
  if (a) {
    if (a.montant === 0) return 'Saisissez le montant payé par avoir, ou retirez l’avoir.'
    if (a.montant > a.client.soldeAvoir) {
      return `L’avoir de ${a.client.nom} est de ${formaterFCFA(a.client.soldeAvoir)} : baissez le montant payé par avoir.`
    }
  }
  for (const m of etat.mobiles) {
    // Une ligne à 0 F ferait croire à un paiement TMoney ou Flooz qui n'existe pas.
    if (m.montant === 0)
      return `Saisissez le montant payé en ${LIBELLES_MODES[m.mode]}, ou retirez ce paiement.`
    if (!m.reference.trim()) return `Saisissez la référence de la transaction ${LIBELLES_MODES[m.mode]}.`
  }
  const especes = partEspeces(etat)
  if (etat.especes && especes === 0) {
    return 'TMoney, Flooz et le crédit couvrent déjà tout : retirez les espèces ou baissez un montant.'
  }
  if (etat.recu !== null && etat.recu < especes) {
    return `Espèces reçues insuffisantes : il manque ${formaterFCFA(especes - etat.recu)}.`
  }
  return null
}

/** Requête envoyée au service : espèces (le reste) puis TMoney / Flooz, jamais de ligne à 0 F. */
export function versRequete(etat: EtatPaiement, lignes: RequeteVente['lignes']): RequeteVente {
  const especes = partEspeces(etat)
  const paiements: RequeteVente['paiements'] = [
    ...(especes > 0 ? [{ mode: 'especes' as const, montant: especes }] : []),
    ...(etat.credit ? [{ mode: 'credit' as const, montant: etat.credit.montant }] : []),
    ...(etat.avoir ? [{ mode: 'avoir' as const, montant: etat.avoir.montant }] : []),
    ...etat.mobiles
      .filter((m) => m.montant > 0)
      .map((m) => ({ mode: m.mode, montant: m.montant, reference: m.reference.trim() }))
  ]
  return {
    lignes,
    paiements,
    ...(etat.credit ? { clientId: etat.credit.client.id, echeance: etat.credit.echeance } : {}),
    ...(etat.avoir ? { clientId: etat.avoir.client.id } : {}),
    ...(especes > 0 && etat.recu !== null ? { montantRecu: etat.recu } : {})
  }
}
