/**
 * Authentification. Propriétaire : Dev B.
 * Connexion en deux gestes (D-17) : la personne touche son nom, puis tape son code à 4 chiffres.
 * - Verrouillage du compte après 5 codes faux consécutifs, avec un délai croissant.
 * - Un code fixé par l'administrateur est provisoire : la personne choisit le sien avant tout accès,
 *   l'administrateur ne connaît donc jamais le code définitif de quelqu'un d'autre.
 * La gestion des comptes (création, désactivation, rôle) est dans modules/utilisateurs.
 */
import type { Role, UtilisateurConnecte } from '@shared/types'
import type { CompteConnexion, ResultatConnexion } from '@shared/ipc/auth'
import { formaterDelai } from '@shared/format'
import type { Db } from '../../db/connexion'
import { avecTransaction, executer, toutes, une } from '../../db/requetes'
import { ErreurMetier } from '../../core/erreurs'
import { journaliser } from '../../core/audit'
import { hacherPin, verifierPin } from '../../core/securite'

/** Nombre de codes faux consécutifs qui verrouille un compte. */
export const ECHECS_AVANT_VERROUILLAGE = 5

/** Délai croissant des verrouillages successifs (ms), plafonné au dernier : 30 s, 1, 2, 5, 15 min. */
export const DELAIS_VERROUILLAGE = [30_000, 60_000, 120_000, 300_000, 900_000]

interface LigneCompte {
  id: number
  nom: string
  role: Role
  pinHash: string
  pinProvisoire: number
  echecs: number
  verrouillages: number
  jusquA: number
}

export function verifierFormatPin(pin: string): void {
  if (!/^\d{4}$/.test(pin)) throw new ErreurMetier('Le code doit comporter 4 chiffres')
}

function compteActif(db: Db, id: number): LigneCompte {
  const c = une<LigneCompte>(
    db,
    `SELECT id, nom, role, pin_hash AS pinHash, pin_provisoire AS pinProvisoire,
            echecs_consecutifs AS echecs, verrouillages, verrouille_jusqu_a AS jusquA
     FROM utilisateurs WHERE id = ? AND actif = 1`,
    id
  )
  if (!c) throw new ErreurMetier('Compte introuvable ou désactivé : touchez votre nom à nouveau')
  return c
}

function ecrireVerrou(db: Db, id: number, echecs: number, verrouillages: number, jusquA: number): void {
  executer(
    db,
    'UPDATE utilisateurs SET echecs_consecutifs = ?, verrouillages = ?, verrouille_jusqu_a = ? WHERE id = ?',
    echecs,
    verrouillages,
    jusquA,
    id
  )
}

/** Comptes proposés sur l'écran de connexion : actifs seulement, par ordre alphabétique. */
export function comptesConnexion(db: Db): CompteConnexion[] {
  return toutes<CompteConnexion>(db, 'SELECT id, nom FROM utilisateurs WHERE actif = 1 ORDER BY nom')
}

/** Temps restant avant de pouvoir retenter un code sur ce compte (0 si non verrouillé). */
export function etatVerrouillage(db: Db, id: number, maintenant: number = Date.now()): { resteMs: number } {
  return { resteMs: Math.max(0, compteActif(db, id).jusquA - maintenant) }
}

type Issue = { type: 'ok'; compte: LigneCompte } | { type: 'refuse' } | { type: 'verrouille'; resteMs: number }

/**
 * Vérifie le code d'un compte en appliquant le verrouillage : utilisée pour TOUTE saisie de code
 * (connexion, code provisoire, changement de son code), sinon on pourrait deviner un code par une
 * autre porte que l'écran de connexion. `maintenant` est injectable pour les tests.
 */
export function verifierCodeCompte(db: Db, id: number, pin: string, maintenant: number = Date.now()): LigneCompte {
  // Un code mal formé n'est pas une tentative : il ne compte pas pour le verrouillage.
  verifierFormatPin(pin)

  // Le compteur est écrit dans la transaction, l'erreur est levée après : lever dedans annulerait l'écriture.
  const issue = avecTransaction(db, (): Issue => {
    const c = compteActif(db, id)
    if (c.jusquA > maintenant) return { type: 'verrouille', resteMs: c.jusquA - maintenant }

    if (verifierPin(pin, c.pinHash)) {
      ecrireVerrou(db, id, 0, 0, 0)
      return { type: 'ok', compte: c }
    }

    const echecs = c.echecs + 1
    if (echecs < ECHECS_AVANT_VERROUILLAGE) {
      ecrireVerrou(db, id, echecs, c.verrouillages, 0)
      return { type: 'refuse' }
    }

    const verrouillages = c.verrouillages + 1
    const delai = DELAIS_VERROUILLAGE[Math.min(verrouillages, DELAIS_VERROUILLAGE.length) - 1]
    ecrireVerrou(db, id, 0, verrouillages, maintenant + delai)
    // Au nom du compte visé : c'est lui que le gérant doit pouvoir retrouver dans le journal.
    journaliser(db, {
      utilisateurId: id,
      action: 'echec_connexion_verrouillage',
      entite: 'utilisateurs',
      entiteId: id,
      apres: { verrouillage: verrouillages, delaiSecondes: delai / 1000 }
    })
    return { type: 'verrouille', resteMs: delai }
  })

  if (issue.type === 'ok') return issue.compte
  if (issue.type === 'refuse') throw new ErreurMetier('Code incorrect')
  throw new ErreurMetier(`Trop de codes faux. Réessayez dans ${formaterDelai(issue.resteMs)}.`)
}

const versUtilisateur = (c: LigneCompte): UtilisateurConnecte => ({ id: c.id, nom: c.nom, role: c.role })

/** Connexion. Avec un code provisoire, aucune session n'est ouverte : il faut d'abord choisir son code. */
export function connexion(db: Db, id: number, pin: string, maintenant: number = Date.now()): ResultatConnexion {
  const c = verifierCodeCompte(db, id, pin, maintenant)
  return c.pinProvisoire ? { codeProvisoire: true } : { utilisateur: versUtilisateur(c) }
}

function enregistrerCode(db: Db, id: number, pin: string): void {
  executer(db, 'UPDATE utilisateurs SET pin_hash = ?, pin_provisoire = 0 WHERE id = ?', hacherPin(pin), id)
  // Jamais la valeur du code dans le journal, même hachée.
  journaliser(db, { utilisateurId: id, action: 'modification_pin', entite: 'utilisateurs', entiteId: id })
}

/** Première connexion (ou après réinitialisation) : remplace le code provisoire, puis connecte. */
export function definirCodePersonnel(
  db: Db,
  id: number,
  codeProvisoire: string,
  nouveauCode: string,
  maintenant: number = Date.now()
): UtilisateurConnecte {
  verifierFormatPin(nouveauCode)
  const c = verifierCodeCompte(db, id, codeProvisoire, maintenant)
  if (!c.pinProvisoire) throw new ErreurMetier('Votre code est déjà personnel : connectez-vous normalement')
  if (nouveauCode === codeProvisoire) {
    throw new ErreurMetier('Choisissez un code différent de celui donné par l’administrateur')
  }
  avecTransaction(db, () => enregistrerCode(db, id, nouveauCode))
  return versUtilisateur(c)
}

/** « Mon code » : toute personne connectée change son code en donnant l'actuel. */
export function changerMonCode(
  db: Db,
  moi: UtilisateurConnecte,
  codeActuel: string,
  nouveauCode: string,
  maintenant: number = Date.now()
): void {
  verifierFormatPin(nouveauCode)
  verifierCodeCompte(db, moi.id, codeActuel, maintenant)
  if (nouveauCode === codeActuel) throw new ErreurMetier('Le nouveau code doit être différent de l’actuel')
  avecTransaction(db, () => enregistrerCode(db, moi.id, nouveauCode))
}

/**
 * Création brute d'un compte (sans journal) : utilisée par les données de démo et les services.
 * Les codes ne sont pas uniques (D-17) : c'est le nom touché qui identifie la personne.
 */
export function creerUtilisateur(db: Db, nom: string, pin: string, role: Role, provisoire = false): number {
  if (!nom.trim()) throw new ErreurMetier('Le nom est obligatoire')
  verifierFormatPin(pin)
  return executer(
    db,
    'INSERT INTO utilisateurs (nom, pin_hash, role, pin_provisoire) VALUES (?, ?, ?, ?)',
    nom.trim(),
    hacherPin(pin),
    role,
    provisoire ? 1 : 0
  ).id
}

function nombreDeComptes(db: Db): number {
  return une<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM utilisateurs')!.n
}

/** Premier démarrage : application installée (empaquetée) et aucun compte. */
export function etatDemarrage(db: Db, empaquetee: boolean): { premierDemarrage: boolean } {
  return { premierDemarrage: empaquetee && nombreDeComptes(db) === 0 }
}

/**
 * Assistant de premier démarrage : crée le compte administrateur, avec le code qu'il a choisi.
 * Refusé dès qu'un compte existe — sinon ce serait une porte d'entrée sans code.
 */
export function creerPremierAdmin(db: Db, nom: string, pin: string): UtilisateurConnecte {
  return avecTransaction(db, () => {
    if (nombreDeComptes(db) > 0) throw new ErreurMetier('Un compte existe déjà : connectez-vous avec votre code.')
    const id = creerUtilisateur(db, nom, pin, 'admin')
    journaliser(db, {
      utilisateurId: id,
      action: 'creation_utilisateur',
      entite: 'utilisateurs',
      entiteId: id,
      apres: { nom: nom.trim(), role: 'admin' }
    })
    return { id, nom: nom.trim(), role: 'admin' }
  })
}
