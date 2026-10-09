/**
 * Journal des opérations (B14). Propriétaire : Dev B.
 * Lecture seule du `journal_audit` (immuable), réservée à l'admin (matrice des droits). Chaque entrée
 * est rendue lisible par `detailsAudit` : aucun code ni JSON n'arrive à l'écran.
 */
import type { ChoixJournal, EntreeJournal, FiltreJournal, PageJournal } from '@shared/ipc/audit'
import { detailsAudit, libelleAction, lireJson } from '@shared/audit'
import type { Db } from '../../db/connexion'
import { toutes, une } from '../../db/requetes'
import { ErreurMetier } from '../../core/erreurs'
import { dansPeriode } from '../rapports-gestion/periode'

export const JOURS_JOURNAL_PAR_DEFAUT = 7
export const TAILLE_PAGE_JOURNAL = 200

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/

function lireDate(valeur: string | null | undefined, nom: string): string | null {
  const v = valeur?.trim()
  if (!v) return null
  const valide = DATE_ISO.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v
  if (!valide) throw new ErreurMetier(`La date de ${nom} est invalide : choisissez-la dans le calendrier`)
  return v
}

interface LigneLue {
  id: number
  horodatage: string
  utilisateur: string
  action: string
  entite: string | null
  avant: string | null
  apres: string | null
}

export function lireJournal(db: Db, filtre: FiltreJournal | null | undefined): PageJournal {
  const jour = une<{ j: string }>(db, "SELECT date('now','localtime') AS j")!.j
  const au = lireDate(filtre?.au, 'fin') ?? jour
  const du =
    lireDate(filtre?.du, 'début') ??
    une<{ d: string }>(db, 'SELECT date(?, ?) AS d', au, `-${JOURS_JOURNAL_PAR_DEFAUT - 1} days`)!.d
  if (au > jour) throw new ErreurMetier('La fin de la période ne peut pas être dans le futur')
  if (du > au) throw new ErreurMetier('Le début de la période doit précéder sa fin')

  const utilisateurId = filtre?.utilisateurId ?? null
  const action = filtre?.action?.trim() || null
  const avantId = filtre?.avantId ?? null
  // Une ligne de plus que la page : savoir s'il y a une suite sans tout compter.
  const lignes = toutes<LigneLue>(
    db,
    `SELECT j.id, j.horodatage, u.nom AS utilisateur, j.action, j.entite,
            j.ancienne_valeur AS avant, j.nouvelle_valeur AS apres
     FROM journal_audit j
     JOIN utilisateurs u ON u.id = j.utilisateur_id
     WHERE ${dansPeriode('j.horodatage')}
       AND (? IS NULL OR j.utilisateur_id = ?)
       AND (? IS NULL OR j.action = ?)
       AND (? IS NULL OR j.id < ?)
     ORDER BY j.id DESC
     LIMIT ?`,
    du,
    au,
    utilisateurId,
    utilisateurId,
    action,
    action,
    avantId,
    avantId,
    TAILLE_PAGE_JOURNAL + 1
  )

  const noms = new Map(
    toutes<{ id: number; nom: string }>(db, 'SELECT id, nom FROM utilisateurs').map((u) => [u.id, u.nom])
  )
  const nomDe = (id: number): string => noms.get(id) ?? 'Compte inconnu'

  const entrees: EntreeJournal[] = lignes.slice(0, TAILLE_PAGE_JOURNAL).map((l) => ({
    id: l.id,
    horodatage: l.horodatage,
    utilisateur: l.utilisateur,
    action: l.action,
    libelle: libelleAction(l.action),
    ...detailsAudit(
      { action: l.action, entite: l.entite, avant: lireJson(l.avant), apres: lireJson(l.apres) },
      nomDe
    )
  }))
  return { du, au, entrees, suite: lignes.length > TAILLE_PAGE_JOURNAL }
}

export function choixJournal(db: Db): ChoixJournal {
  const utilisateurs = toutes<{ id: number; nom: string; actif: number }>(
    db,
    'SELECT id, nom, actif FROM utilisateurs ORDER BY nom COLLATE NOCASE'
  ).map((u) => ({ ...u, actif: u.actif === 1 }))
  const actions = toutes<{ action: string }>(db, 'SELECT DISTINCT action FROM journal_audit')
    .map(({ action }) => ({ action, libelle: libelleAction(action) }))
    .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'))
  return { utilisateurs, actions }
}
