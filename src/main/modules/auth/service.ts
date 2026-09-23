/**
 * Authentification par code PIN. Propriétaire : Dev B.
 * Version initiale : connexion + création. Dev B ajoute (tâche B1) :
 * verrouillage après échecs, changement de PIN, désactivation de compte.
 */
import type { Role, UtilisateurConnecte } from '@shared/types'
import type { Db } from '../../db/connexion'
import { executer, toutes } from '../../db/requetes'
import { ErreurMetier } from '../../core/erreurs'
import { hacherPin, verifierPin } from '../../core/securite'

interface LigneUtilisateur {
  id: number
  nom: string
  role: Role
  pin_hash: string
}

function utilisateursActifs(db: Db): LigneUtilisateur[] {
  return toutes<LigneUtilisateur>(db, 'SELECT id, nom, role, pin_hash FROM utilisateurs WHERE actif = 1')
}

/** Connexion par PIN seul : les PIN sont donc uniques parmi les comptes actifs. */
export function connexion(db: Db, pin: string): UtilisateurConnecte {
  if (!/^\d{4}$/.test(pin)) throw new ErreurMetier('Le code doit comporter 4 chiffres')
  const u = utilisateursActifs(db).find((x) => verifierPin(pin, x.pin_hash))
  if (!u) throw new ErreurMetier('Code incorrect')
  return { id: u.id, nom: u.nom, role: u.role }
}

export function creerUtilisateur(db: Db, nom: string, pin: string, role: Role): number {
  if (!nom.trim()) throw new ErreurMetier('Le nom est obligatoire')
  if (!/^\d{4}$/.test(pin)) throw new ErreurMetier('Le code doit comporter 4 chiffres')
  if (utilisateursActifs(db).some((x) => verifierPin(pin, x.pin_hash))) {
    throw new ErreurMetier('Ce code est déjà utilisé par un autre compte')
  }
  return executer(db, 'INSERT INTO utilisateurs (nom, pin_hash, role) VALUES (?, ?, ?)', nom.trim(), hacherPin(pin), role).id
}
