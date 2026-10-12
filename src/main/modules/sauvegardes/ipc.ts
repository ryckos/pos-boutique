/** Propriétaire : Dev B. */
import { existsSync } from 'node:fs'
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import { lireParametres } from '../parametres/service'
import { dernierEchecSauvegarde, dossierCourant, sauvegarderEnFile } from './automatique'
import { listeSauvegardes, sauvegardeEnRetard } from './service'

// REGLES_METIER § 14 : consulter et « Sauvegarder maintenant » = gérant ; restaurer = admin (PR 2).
export function enregistrerIpcSauvegardes(): void {
  gerer('sauvegardes:etat', () => {
    session.exiger(['gerant'])
    const derniere = listeSauvegardes(dossierCourant())[0] ?? null
    const dossierExterne = lireParametres(base()).sauvegardeDossierExterne
    return {
      derniere,
      enRetard: sauvegardeEnRetard(derniere, new Date()),
      dossierExterne,
      dossierExternePresent: dossierExterne !== null && existsSync(dossierExterne),
      dernierEchec: dernierEchecSauvegarde()
    }
  })
  gerer('sauvegardes:liste', () => {
    session.exiger(['gerant'])
    return listeSauvegardes(dossierCourant())
  })
  gerer('sauvegardes:creer', () => {
    session.exiger(['gerant'])
    return sauvegarderEnFile(base(), 'manuelle')
  })
}
