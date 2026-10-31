/**
 * Placement de l'écran client (A13). Propriétaire : Dev A.
 * Fonction pure, sans Electron, pour être testée : fenetres.ts lui passe les écrans de Windows.
 */

export interface EcranSysteme {
  id: number
  bounds: { x: number; y: number; width: number; height: number }
}

/**
 * Le second écran (le 11,6″ du client) = le premier écran qui n'est pas l'écran principal.
 * null s'il n'y en a pas : la fenêtre client n'est alors ouverte que sur demande, jamais d'office.
 */
export function choisirEcranClient<T extends EcranSysteme>(ecrans: T[], principalId: number): T | null {
  return ecrans.find((e) => e.id !== principalId) ?? null
}
