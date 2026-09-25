/**
 * Logique pure de l'écran Paramètres : champs texte du formulaire ↔ valeurs envoyées.
 * Le processus principal revérifie tout ; ici on ne fait que convertir la saisie.
 */
import type { ParametresBoutique } from '@shared/ipc/parametres'

/** Les trois blocs de l'écran ; chacun s'enregistre à part. */
export type Groupe = 'boutique' | 'stock' | 'caisse'

export type ChampsParametres = Record<string, string>

/** « 1 500 » → 1500 ; tout ce qui n'est pas un entier positif → NaN (refusé par le principal). */
export function lireEntier(texte: string): number {
  const t = texte.replace(/\s/g, '')
  return /^\d+$/.test(t) ? Number(t) : NaN
}

export function champsDuGroupe(groupe: Groupe, p: ParametresBoutique): ChampsParametres {
  switch (groupe) {
    case 'boutique':
      return {
        boutiqueNom: p.boutiqueNom ?? '',
        boutiqueAdresse: p.boutiqueAdresse ?? '',
        boutiqueNif: p.boutiqueNif ?? '',
        ticketPied: p.ticketPied
      }
    case 'stock':
      return { peremptionSeuilJours: String(p.peremptionSeuilJours), dormantJours: String(p.dormantJours) }
    case 'caisse':
      return {
        tvaDefaut: String(p.tvaDefaut),
        plafondRemiseCaissier: p.plafondRemiseCaissier === null ? '' : String(p.plafondRemiseCaissier)
      }
  }
}

export function versModifications(groupe: Groupe, c: ChampsParametres): Partial<ParametresBoutique> {
  switch (groupe) {
    case 'boutique':
      return {
        boutiqueNom: c.boutiqueNom,
        boutiqueAdresse: c.boutiqueAdresse,
        boutiqueNif: c.boutiqueNif,
        ticketPied: c.ticketPied
      }
    case 'stock':
      return {
        peremptionSeuilJours: lireEntier(c.peremptionSeuilJours),
        dormantJours: lireEntier(c.dormantJours)
      }
    case 'caisse':
      return {
        tvaDefaut: Number(c.tvaDefaut),
        // Champ vide = pas de plafond fixé.
        plafondRemiseCaissier:
          c.plafondRemiseCaissier.trim() === '' ? null : lireEntier(c.plafondRemiseCaissier)
      }
  }
}
