/**
 * Gestion des comptes (écran admin). Propriétaire : Dev B.
 * Un compte n'est jamais supprimé (il est référencé par l'historique) : il est désactivé.
 * Chaque changement est journalisé ; l'auteur vient de la session, jamais de l'interface.
 * Un code donné par l'admin (création, réinitialisation) est PROVISOIRE : la personne choisit le
 * sien à sa connexion suivante (D-17). L'admin ne connaît donc aucun code définitif.
 */
import type { Role, UtilisateurConnecte } from '@shared/types'
import type { CompteUtilisateur } from '@shared/ipc/utilisateurs'
import type { Db } from '../../db/connexion'
import { avecTransaction, executer, toutes, une } from '../../db/requetes'
import { ErreurMetier } from '../../core/erreurs'
import { journaliser } from '../../core/audit'
import { hacherPin } from '../../core/securite'
import { creerUtilisateur, verifierFormatPin } from '../auth/service'

const ROLES: Role[] = ['caissier', 'gerant', 'admin']

interface LigneCompte {
  id: number
  nom: string
  role: Role
  actif: number
}

function exigerRole(role: Role): void {
  // L'interface n'est pas digne de confiance : le rôle est revérifié ici.
  if (!ROLES.includes(role)) throw new ErreurMetier('Rôle inconnu : choisissez caissier, gérant ou admin')
}

/** Relit le compte en base : l'interface ne fournit que l'identifiant. */
function compte(db: Db, id: number): LigneCompte {
  const c = une<LigneCompte>(db, 'SELECT id, nom, role, actif FROM utilisateurs WHERE id = ?', id)
  if (!c) throw new ErreurMetier('Compte introuvable : rechargez la liste')
  return c
}

function compteActif(db: Db, id: number): LigneCompte {
  const c = compte(db, id)
  if (!c.actif) throw new ErreurMetier(`Le compte de ${c.nom} est désactivé`)
  return c
}

function adminsActifs(db: Db): number {
  return une<{ n: number }>(db, "SELECT COUNT(*) AS n FROM utilisateurs WHERE role = 'admin' AND actif = 1")!.n
}

/** Garde-fou : le dernier administrateur actif ne peut ni être désactivé ni perdre son rôle. */
function exigerAutreAdmin(db: Db, c: LigneCompte): void {
  if (c.role === 'admin' && adminsActifs(db) <= 1) {
    throw new ErreurMetier('Il doit rester au moins un administrateur actif : nommez-en un autre avant')
  }
}

export function listerComptes(db: Db): CompteUtilisateur[] {
  return toutes<Omit<CompteUtilisateur, 'actif' | 'codeProvisoire'> & { actif: number; codeProvisoire: number }>(
    db,
    `SELECT id, nom, role, actif, pin_provisoire AS codeProvisoire, cree_le AS creeLe
     FROM utilisateurs ORDER BY actif DESC, nom`
  ).map((c) => ({ ...c, actif: c.actif === 1, codeProvisoire: c.codeProvisoire === 1 }))
}

export function creerCompte(db: Db, auteur: UtilisateurConnecte, nom: string, pin: string, role: Role): number {
  exigerRole(role)
  return avecTransaction(db, () => {
    const id = creerUtilisateur(db, nom, pin, role, true)
    journaliser(db, {
      utilisateurId: auteur.id,
      action: 'creation_utilisateur',
      entite: 'utilisateurs',
      entiteId: id,
      apres: { nom: nom.trim(), role, codeProvisoire: true }
    })
    return id
  })
}

/**
 * Code oublié : l'admin donne un code provisoire, et débloque le compte s'il était verrouillé.
 * La personne s'en aperçoit forcément (son ancien code ne marche plus) : une réinitialisation
 * faite à son insu devient visible, en plus d'être journalisée.
 */
export function reinitialiserCode(db: Db, auteur: UtilisateurConnecte, id: number, pin: string): void {
  if (id === auteur.id) throw new ErreurMetier('Pour votre propre code, utilisez « Mon code »')
  verifierFormatPin(pin)
  avecTransaction(db, () => {
    compteActif(db, id)
    executer(
      db,
      `UPDATE utilisateurs SET pin_hash = ?, pin_provisoire = 1,
         echecs_consecutifs = 0, verrouillages = 0, verrouille_jusqu_a = 0
       WHERE id = ?`,
      hacherPin(pin),
      id
    )
    // Jamais la valeur du code dans le journal, même hachée.
    journaliser(db, { utilisateurId: auteur.id, action: 'reinitialisation_pin', entite: 'utilisateurs', entiteId: id })
  })
}

export function changerRole(db: Db, auteur: UtilisateurConnecte, id: number, role: Role): void {
  exigerRole(role)
  avecTransaction(db, () => {
    const c = compteActif(db, id)
    if (c.role === role) return
    if (role !== 'admin') exigerAutreAdmin(db, c)
    executer(db, 'UPDATE utilisateurs SET role = ? WHERE id = ?', role, id)
    journaliser(db, {
      utilisateurId: auteur.id,
      action: 'modification_role',
      entite: 'utilisateurs',
      entiteId: id,
      avant: { role: c.role },
      apres: { role }
    })
  })
}

export function desactiverCompte(db: Db, auteur: UtilisateurConnecte, id: number, motif: string): void {
  if (!motif.trim()) throw new ErreurMetier('Indiquez le motif de la désactivation')
  if (id === auteur.id) throw new ErreurMetier('Vous ne pouvez pas désactiver votre propre compte')
  avecTransaction(db, () => {
    const c = compteActif(db, id)
    exigerAutreAdmin(db, c)
    executer(db, 'UPDATE utilisateurs SET actif = 0 WHERE id = ?', id)
    journaliser(db, {
      utilisateurId: auteur.id,
      action: 'desactivation_utilisateur',
      entite: 'utilisateurs',
      entiteId: id,
      avant: { actif: true },
      apres: { actif: false, motif: motif.trim() }
    })
  })
}
