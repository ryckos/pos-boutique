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

export interface EtatPaiement {
  total: number
  /** Les espèces font partie du paiement ; leur montant est toujours le reste. */
  especes: boolean
  mobiles: PaiementMobile[]
  /** Espèces données par le client ; null = montant exact. */
  recu: number | null
}

/** Montant saisi au clavier → entier FCFA ≥ 0 (tout ce qui n'est pas un chiffre est ignoré). */
export function lireMontant(saisie: string): number {
  const chiffres = saisie.replace(/\D/g, '')
  return chiffres ? Number.parseInt(chiffres, 10) : 0
}

export function ouvrirPaiement(total: number, mode: ModePaiementCaisse): EtatPaiement {
  return mode === 'especes'
    ? { total, especes: true, mobiles: [], recu: null }
    : { total, especes: false, mobiles: [{ mode, montant: total, reference: '' }], recu: null }
}

const totalMobiles = (etat: EtatPaiement): number => etat.mobiles.reduce((s, m) => s + m.montant, 0)

export function nombreDeModes(etat: EtatPaiement): number {
  return etat.mobiles.length + (etat.especes ? 1 : 0)
}

/** Part payée en espèces : ce que TMoney et Flooz ne couvrent pas. */
export function partEspeces(etat: EtatPaiement): number {
  return etat.especes ? Math.max(etat.total - totalMobiles(etat), 0) : 0
}

/** Positif : il manque ; négatif : TMoney et Flooz dépassent le total. */
export function resteAPayer(etat: EtatPaiement): number {
  return etat.total - totalMobiles(etat) - partEspeces(etat)
}

export function monnaieARendre(etat: EtatPaiement): number {
  return etat.recu === null ? 0 : Math.max(etat.recu - partEspeces(etat), 0)
}

/** Ajoute un mode (paiement mixte). Un mode mobile ajouté prend le reste s'il n'y a pas d'espèces. */
export function ajouterMode(etat: EtatPaiement, mode: ModePaiementCaisse): EtatPaiement {
  if (mode === 'especes') return etat.especes ? etat : { ...etat, especes: true }
  if (etat.mobiles.some((m) => m.mode === mode)) return etat
  const montant = etat.especes ? 0 : Math.max(etat.total - totalMobiles(etat), 0)
  return { ...etat, mobiles: [...etat.mobiles, { mode, montant, reference: '' }] }
}

/**
 * Retire un mode ; il en reste toujours un. Un mode mobile resté seul, sans espèces, reprend tout
 * le total (son montant n'est plus modifiable à l'écran).
 */
export function retirerMode(etat: EtatPaiement, mode: ModePaiementCaisse): EtatPaiement {
  if (nombreDeModes(etat) <= 1) return etat
  const especes = mode === 'especes' ? false : etat.especes
  let mobiles = etat.mobiles.filter((m) => m.mode !== mode)
  if (!especes && mobiles.length === 1) mobiles = [{ ...mobiles[0], montant: etat.total }]
  return { ...etat, especes, mobiles, recu: especes ? etat.recu : null }
}

/** Sans espèces, avec deux modes mobiles, l'autre prend le reste : 3 500 en TMoney → 5 000 en Flooz. */
export function changerMontant(etat: EtatPaiement, mode: ModeMobile, montant: number): EtatPaiement {
  const m = Math.max(Math.trunc(montant), 0)
  const equilibrer = !etat.especes && etat.mobiles.length === 2
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
  for (const m of etat.mobiles) {
    // Une ligne à 0 F ferait croire à un paiement TMoney ou Flooz qui n'existe pas.
    if (m.montant === 0)
      return `Saisissez le montant payé en ${LIBELLES_MODES[m.mode]}, ou retirez ce paiement.`
    if (!m.reference.trim()) return `Saisissez la référence de la transaction ${LIBELLES_MODES[m.mode]}.`
  }
  const especes = partEspeces(etat)
  if (etat.especes && especes === 0) {
    return 'TMoney et Flooz couvrent déjà tout : retirez les espèces ou baissez un montant.'
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
    ...etat.mobiles
      .filter((m) => m.montant > 0)
      .map((m) => ({ mode: m.mode, montant: m.montant, reference: m.reference.trim() }))
  ]
  return {
    lignes,
    paiements,
    ...(especes > 0 && etat.recu !== null ? { montantRecu: etat.recu } : {})
  }
}
