/**
 * Propriétaire : Dev A.
 *
 * Raccourcis clavier de la caisse (docs/UI_UX.md § 3). La douchette n'envoie que des chiffres et
 * Entrée. Mais elle est réglée en QWERTY : sur le Windows AZERTY de la boutique, la touche du chiffre 6
 * produit « - », qui retirait un article du ticket à chaque 6 d'un code scanné. On ignore donc toute
 * touche de la rangée des chiffres (`Digit…`) : « - » reste au pavé numérique.
 */
export type ActionClavier =
  'rechercher' | 'encaisser' | 'mettreEnAttente' | 'supprimerLigne' | 'fermer' | 'plus' | 'moins'

const RACCOURCIS: Record<string, ActionClavier> = {
  F2: 'rechercher',
  F4: 'encaisser',
  F8: 'mettreEnAttente',
  Delete: 'supprimerLigne',
  Escape: 'fermer',
  '+': 'plus',
  '-': 'moins'
}

/** `touche` et `codePhysique` sont KeyboardEvent.key et KeyboardEvent.code. */
export function actionClavier(touche: string, codePhysique = ''): ActionClavier | null {
  if (codePhysique.startsWith('Digit')) return null
  return RACCOURCIS[touche] ?? null
}
