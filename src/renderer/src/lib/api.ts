/**
 * Appel typé d'un canal IPC. ZONE PARTAGÉE.
 *
 *   const article = await appel('catalogue:rechercherCode', { code })
 *
 * TypeScript vérifie le nom du canal, la requête et le type de la réponse.
 * En cas d'échec, lève une Error dont le message est affichable à l'utilisateur.
 */
import type { Canal, Reponse, Requete, Resultat } from '@shared/ipc'

export async function appel<C extends Canal>(
  canal: C,
  ...args: Requete<C> extends void ? [] : [Requete<C>]
): Promise<Reponse<C>> {
  const r = (await window.pos.invoke(canal, args[0])) as Resultat<Reponse<C>>
  if (!r.ok) throw new Error(r.erreur)
  return r.donnees
}
