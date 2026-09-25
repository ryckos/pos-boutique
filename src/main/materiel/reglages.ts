/**
 * Propriétaire : Dev A.
 *
 * Réglages de l'imprimante et en-tête du ticket, lus et écrits dans les PARAMÈTRES de la boutique
 * (service de Dev B, B5 ; clés imprimante_* et boutique_*, REGLES_METIER § 13). Ce module ne fait
 * que traduire : les droits (le gérant ne modifie que les clés imprimante_*), les contrôles, la
 * transaction et le journal (`modification_parametre`) sont ceux du service de Dev B.
 * Remplace le fichier local `materiel.json` des débuts d'A3.
 */
import type { CibleImprimante, PageDeCodes } from '@shared/ipc/materiel'
import type { ParametresBoutique } from '@shared/ipc/parametres'
import type { UtilisateurConnecte } from '@shared/types'
import type { Db } from '../db/connexion'
import { ErreurMetier } from '../core/erreurs'
import { ecrireParametres, lireParametres } from '../modules/parametres/service'
import type { EnteteTicket } from './ticket'

export type ReglagesImprimante = CibleImprimante

const PAGES: PageDeCodes[] = ['cp858', 'cp1252', 'cp437']

/**
 * Page de codes tant qu'aucune n'est renseignée. PROVISOIRE (décision en attente D-A2) : la page
 * gagnante du test T2 n'a pas été reportée ; elle sera déterminée sur le terminal.
 */
export const PAGE_DE_CODES_PAR_DEFAUT: PageDeCodes = 'cp858'

/** Nom imprimé si la boutique n'a pas encore renseigné le sien (écran Paramètres de Dev B). */
export const NOM_BOUTIQUE_PAR_DEFAUT = 'Ma Boutique'

export function reglagesDepuis(p: ParametresBoutique): ReglagesImprimante {
  const page = p.imprimantePageCodes as PageDeCodes | null
  return {
    methode: p.imprimanteMethode,
    cible: p.imprimanteCible ?? '',
    pageDeCodes: page && PAGES.includes(page) ? page : PAGE_DE_CODES_PAR_DEFAUT
  }
}

/** En-tête et pied du ticket ; une adresse sur plusieurs lignes s'imprime sur plusieurs lignes. */
export function enteteDepuis(p: ParametresBoutique): EnteteTicket {
  return {
    nom: p.boutiqueNom ?? NOM_BOUTIQUE_PAR_DEFAUT,
    adresse: (p.boutiqueAdresse ?? '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
    pied: p.ticketPied
  }
}

export function lireReglages(db: Db): ReglagesImprimante {
  return reglagesDepuis(lireParametres(db))
}

export function lireEntete(db: Db): EnteteTicket {
  return enteteDepuis(lireParametres(db))
}

/** Contrôles propres à l'imprimante, puis écriture par le service des paramètres (droits, journal). */
export function ecrireReglages(
  db: Db,
  auteur: UtilisateurConnecte,
  r: ReglagesImprimante
): ReglagesImprimante {
  if (!PAGES.includes(r.pageDeCodes)) throw new ErreurMetier('Page de codes inconnue.')
  if (!r.cible?.trim()) {
    throw new ErreurMetier('Choisissez l’imprimante dans la liste ou saisissez son nom exact.')
  }
  return reglagesDepuis(
    ecrireParametres(db, auteur, {
      imprimanteMethode: r.methode,
      imprimanteCible: r.cible,
      imprimantePageCodes: r.pageDeCodes
    })
  )
}
