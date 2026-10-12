/**
 * Sauvegardes déclenchées par l'application (clôture, démarrage, mise à jour) et par le bouton.
 * Propriétaire : Dev B. Une seule sauvegarde à la fois : chaque demande attend la fin de la
 * précédente, pour ne jamais écrire deux copies en même temps ni tourner pendant une rotation.
 */
import type { MotifSauvegarde, ResultatSauvegarde } from '@shared/ipc/sauvegardes'
import { base, type Db } from '../../db/connexion'
import { lireParametres } from '../parametres/service'
import { dossierSauvegardes, listeSauvegardes, sauvegarder, sauvegardeEnRetard } from './service'

let dossier: string | null = null
let file: Promise<unknown> = Promise.resolve()
let dernierEchec: string | null = null

/** À appeler une fois au démarrage, avec le chemin de la base ouverte. */
export function configurerSauvegardes(cheminBase: string): void {
  dossier = dossierSauvegardes(cheminBase)
}

export function dossierCourant(): string {
  if (!dossier) throw new Error('Sauvegardes non configurées')
  return dossier
}

export function dernierEchecSauvegarde(): string | null {
  return dernierEchec
}

/** Met la sauvegarde dans la file et attend son résultat. Lève l'erreur en cas d'échec. */
export function sauvegarderEnFile(db: Db, motif: MotifSauvegarde): Promise<ResultatSauvegarde> {
  const tache = file.then(() =>
    sauvegarder(db, {
      dossier: dossierCourant(),
      motif,
      dossierExterne: lireParametres(db).sauvegardeDossierExterne
    })
  )
  // La file continue même si cette sauvegarde échoue.
  file = tache.then(
    () => {
      dernierEchec = null
    },
    (e: unknown) => {
      dernierEchec = e instanceof Error ? e.message : 'La sauvegarde a échoué'
      console.error('[SAUVEGARDE]', motif, e)
    }
  )
  return tache
}

/**
 * Sauvegarde sans attendre ni jamais lever d'erreur : pour la clôture de caisse, qui ne doit
 * jamais être bloquée. À appeler APRÈS la transaction, jamais dedans. Un échec est noté et
 * l'écran Sauvegardes le signale.
 */
export function sauvegarderEnFond(motif: MotifSauvegarde): void {
  try {
    sauvegarderEnFile(base(), motif).catch(() => undefined)
  } catch (e) {
    console.error('[SAUVEGARDE]', motif, e)
  }
}

/** Au démarrage : sauvegarde du jour si la dernière a plus de 24 heures (journées sans clôture). */
export function sauvegardeDuDemarrage(maintenant = new Date()): void {
  try {
    if (sauvegardeEnRetard(listeSauvegardes(dossierCourant())[0] ?? null, maintenant, 24)) {
      sauvegarderEnFond('demarrage')
    }
  } catch (e) {
    console.error('[SAUVEGARDE] démarrage', e)
  }
}
