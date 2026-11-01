/**
 * Ouverture de l'application au démarrage de Windows (B-P5, REGLES_METIER § 13). Propriétaire : Dev B.
 * Règle pure, testée ; l'appel à Windows est dans `src/main/demarrage.ts`.
 */

/**
 * `true` / `false` = inscrire ou retirer l'application du démarrage de Windows ; `null` = ne rien
 * toucher. En développement, Windows lancerait l'Electron de développement. Sur une base d'essai
 * (`POS_DB`), c'est le paramètre de la copie qui serait lu : il ne doit pas changer le vrai poste.
 */
export function reglageDemarrage(o: { installee: boolean; baseEssai: boolean; parametre: boolean }): boolean | null {
  if (!o.installee || o.baseEssai) return null
  return o.parametre
}
