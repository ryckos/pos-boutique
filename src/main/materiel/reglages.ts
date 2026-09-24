/**
 * Propriétaire : Dev A.
 *
 * Réglages de l'imprimante (méthode, cible, page de codes), gardés dans un fichier local en
 * attendant `parametres:lire` / `parametres:ecrire` (Dev B, B5) : on basculera alors sur les clés
 * imprimante_methode, imprimante_cible et imprimante_page_codes (REGLES_METIER § 13).
 * Le chemin du fichier est reçu en paramètre : ce module n'importe pas Electron et se teste.
 */
import { existsSync, readFileSync, writeFileSync } from 'fs'
import type { CibleImprimante, MethodeImpression, PageDeCodes } from '@shared/ipc/materiel'
import { ErreurMetier } from '../core/erreurs'

export type ReglagesImprimante = CibleImprimante

const METHODES: MethodeImpression[] = ['spooler', 'share']
const PAGES: PageDeCodes[] = ['cp858', 'cp1252', 'cp437']

/**
 * `cp858` est PROVISOIRE (décision en attente D-A2) : la page gagnante du test T2 n'a pas été
 * reportée ; elle sera déterminée sur le terminal avec le ticket de test.
 */
export const REGLAGES_PAR_DEFAUT: ReglagesImprimante = { methode: 'spooler', cible: '', pageDeCodes: 'cp858' }

/** Fichier absent ou abîmé : valeurs par défaut, champ par champ. Jamais d'exception. */
export function lireReglages(chemin: string): ReglagesImprimante {
  if (!existsSync(chemin)) return { ...REGLAGES_PAR_DEFAUT }
  try {
    const lu = JSON.parse(readFileSync(chemin, 'utf8')) as Partial<ReglagesImprimante>
    return {
      methode: METHODES.includes(lu.methode as MethodeImpression)
        ? (lu.methode as MethodeImpression)
        : REGLAGES_PAR_DEFAUT.methode,
      cible: typeof lu.cible === 'string' ? lu.cible : REGLAGES_PAR_DEFAUT.cible,
      pageDeCodes: PAGES.includes(lu.pageDeCodes as PageDeCodes)
        ? (lu.pageDeCodes as PageDeCodes)
        : REGLAGES_PAR_DEFAUT.pageDeCodes
    }
  } catch {
    return { ...REGLAGES_PAR_DEFAUT }
  }
}

export function ecrireReglages(chemin: string, r: ReglagesImprimante): ReglagesImprimante {
  if (!METHODES.includes(r.methode)) throw new ErreurMetier('Méthode d’impression inconnue.')
  if (!PAGES.includes(r.pageDeCodes)) throw new ErreurMetier('Page de codes inconnue.')
  const propres: ReglagesImprimante = {
    methode: r.methode,
    cible: r.cible.trim(),
    pageDeCodes: r.pageDeCodes
  }
  if (!propres.cible) {
    throw new ErreurMetier('Choisissez l’imprimante dans la liste ou saisissez son nom exact.')
  }
  writeFileSync(chemin, JSON.stringify(propres, null, 2), 'utf8')
  return propres
}
