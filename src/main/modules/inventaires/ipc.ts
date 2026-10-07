/** Propriétaire : Dev B. */
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import {
  annulerInventaire,
  compterProduit,
  detailInventaire,
  inventaireEnCours,
  listerInventaires,
  ouvrirInventaire,
  validerInventaire
} from './service'

export function enregistrerIpcInventaires(): void {
  // Inventaires : gérant seul, du comptage à la validation (validé par Dev B le 2026-10-07).
  gerer('inventaires:ouvrir', (demande) => {
    const u = session.exiger(['gerant'])
    return ouvrirInventaire(base(), u.id, demande)
  })
  gerer('inventaires:enCours', () => {
    session.exiger(['gerant'])
    return inventaireEnCours(base())
  })
  gerer('inventaires:detail', ({ id }) => {
    session.exiger(['gerant'])
    return detailInventaire(base(), id)
  })
  gerer('inventaires:liste', () => {
    session.exiger(['gerant'])
    return listerInventaires(base())
  })
  gerer('inventaires:compter', (saisie) => {
    session.exiger(['gerant'])
    return compterProduit(base(), saisie)
  })
  gerer('inventaires:valider', ({ id }) => {
    const u = session.exiger(['gerant'])
    return validerInventaire(base(), u.id, id)
  })
  gerer('inventaires:annuler', ({ id, motif }) => {
    const u = session.exiger(['gerant'])
    annulerInventaire(base(), u.id, id, motif)
  })
}
