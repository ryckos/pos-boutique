/** Propriétaire : Dev A. Canaux promotions:* — gestion au gérant, promotions du jour à toute la caisse. */
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import {
  arreterPromotion,
  creerPromotion,
  listerPromotions,
  modifierPromotion,
  promotionsDuJour
} from './service'

export function enregistrerIpcPromotions(): void {
  gerer('promotions:lister', () => {
    session.exiger(['gerant'])
    return listerPromotions(base())
  })
  // La caissière en a besoin pour afficher les prix : elle ne voit que ce qui s'applique aujourd'hui.
  gerer('promotions:enCours', () => {
    session.exiger(['caissier', 'gerant'])
    return promotionsDuJour(base())
  })
  gerer('promotions:creer', (saisie) => creerPromotion(base(), session.exiger(['gerant']), saisie))
  gerer('promotions:modifier', ({ id, ...saisie }) =>
    modifierPromotion(base(), session.exiger(['gerant']), id, saisie)
  )
  gerer('promotions:arreter', ({ id }) => arreterPromotion(base(), session.exiger(['gerant']), id))
}
