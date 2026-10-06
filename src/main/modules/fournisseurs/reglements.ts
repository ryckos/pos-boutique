/**
 * Règlements et dettes fournisseurs (tâche B10). Propriétaire : Dev B.
 * Règles (REGLES_METIER § 4.5) : règlement lié à une réception ou global (imputé sur les plus
 * anciennes), hors caisse, jamais au-delà du reste dû ; correction par annulation avec motif.
 * Un avoir reçu (B11) s'impute comme un règlement global ; un excédent reste à valoir.
 */
import type {
  DettesFournisseur,
  EcheanceReception,
  ModeReglement,
  ReglementFournisseur,
  SaisieReglement
} from '@shared/ipc/fournisseurs'
import { imputerReglements, type Imputation } from '@shared/fournisseurs'
import { formaterFCFA } from '@shared/format'
import type { Db } from '../../db/connexion'
import { avecTransaction, executer, toutes, une } from '../../db/requetes'
import { ErreurMetier } from '../../core/erreurs'
import { journaliser } from '../../core/audit'
import { avoirsFournisseur, avoirsRecus } from './avoirs'

const MODES: ModeReglement[] = ['especes', 'tmoney', 'flooz', 'virement', 'autre']
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/
/** Soldées gardées dans l'échéancier, pour voir qu'une livraison récente est bien payée. */
const JOURS_SOLDEES = 90

interface ReceptionImputee extends Imputation {
  numero: string
  dateReception: string
  dateEcheance: string | null
  total: number
}

function aujourdhui(db: Db): string {
  return une<{ j: string }>(db, "SELECT date('now','localtime') AS j")!.j
}

/** Toutes les réceptions du fournisseur, dans l'ordre d'arrivée, avec ce qui en est réglé. */
function receptionsImputees(db: Db, fournisseurId: number, jour: string): ReceptionImputee[] {
  const receptions = toutes<Omit<ReceptionImputee, keyof Imputation> & { id: number }>(
    db,
    `SELECT id, numero, date_reception AS dateReception, date_echeance AS dateEcheance, total
     FROM receptions WHERE fournisseur_id = ? ORDER BY date_reception, id`,
    fournisseurId
  )
  const reglements = toutes<{ receptionId: number | null; montant: number }>(
    db,
    `SELECT reception_id AS receptionId, montant FROM reglements_fournisseurs
     WHERE fournisseur_id = ? AND annule_le IS NULL`,
    fournisseurId
  )
  // Un avoir reçu couvre les réceptions les plus anciennes, comme un règlement global (§ 8).
  for (const montant of avoirsRecus(db, fournisseurId)) reglements.push({ receptionId: null, montant })
  const imputations = imputerReglements(receptions, reglements, jour)
  return receptions.map((r, i) => ({
    ...imputations[i],
    numero: r.numero,
    dateReception: r.dateReception,
    dateEcheance: r.dateEcheance,
    total: r.total
  }))
}

/** Pour la liste des fournisseurs : montant en retard et plus proche échéance. */
export function resumeEcheances(
  db: Db,
  fournisseurId: number
): { enRetard: number; prochaineEcheance: string | null } {
  const dues = receptionsImputees(db, fournisseurId, aujourdhui(db)).filter((r) => r.reste > 0)
  const echeances = dues
    .map((r) => r.dateEcheance)
    .filter((d): d is string => d !== null)
    .sort()
  return {
    enRetard: dues.filter((r) => r.etat === 'en_retard').reduce((s, r) => s + r.reste, 0),
    prochaineEcheance: echeances[0] ?? null
  }
}

export function enregistrerReglement(db: Db, utilisateurId: number, s: SaisieReglement): number {
  if (!Number.isInteger(s.montant) || s.montant <= 0) {
    throw new ErreurMetier('Le montant est un nombre de francs, sans virgule, supérieur à zéro')
  }
  if (!MODES.includes(s.mode)) throw new ErreurMetier('Choisissez le mode de paiement')

  return avecTransaction(db, () => {
    const f = une<{ nom: string; actif: number }>(
      db,
      'SELECT nom, actif FROM fournisseurs WHERE id = ?',
      s.fournisseurId
    )
    if (!f) throw new ErreurMetier('Fournisseur introuvable : rechargez la liste')
    if (!f.actif) throw new ErreurMetier(`« ${f.nom} » est désactivé`)

    const jour = aujourdhui(db)
    const date = s.date?.trim() || jour
    const valide = DATE_ISO.test(date) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date
    if (!valide) throw new ErreurMetier('Indiquez la date du règlement')
    if (date > jour) throw new ErreurMetier('La date du règlement ne peut pas être dans le futur')

    // Le reste dû est relu en base : l'écran a pu afficher un état dépassé.
    const receptions = receptionsImputees(db, s.fournisseurId, jour)
    const solde = receptions.reduce((t, r) => t + r.reste, 0)
    const receptionId = s.receptionId ?? null
    if (receptionId !== null) {
      const rc = receptions.find((r) => r.receptionId === receptionId)
      if (!rc) throw new ErreurMetier(`Cette réception n’est pas une livraison de « ${f.nom} »`)
      if (rc.reste <= 0) throw new ErreurMetier(`La réception ${rc.numero} est déjà payée`)
      if (s.montant > rc.reste) {
        throw new ErreurMetier(
          `Il reste ${formaterFCFA(rc.reste)} à payer sur ${rc.numero} : indiquez au plus ce montant`
        )
      }
    } else {
      if (solde <= 0) throw new ErreurMetier(`Vous ne devez rien à « ${f.nom} »`)
      if (s.montant > solde) {
        throw new ErreurMetier(
          `Vous devez ${formaterFCFA(solde)} à « ${f.nom} » : indiquez au plus ce montant`
        )
      }
    }

    return executer(
      db,
      `INSERT INTO reglements_fournisseurs (fournisseur_id, reception_id, montant, mode, reference, date_reglement, utilisateur_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      s.fournisseurId,
      receptionId,
      s.montant,
      s.mode,
      s.reference?.trim() || null,
      date,
      utilisateurId
    ).id
  })
}

/** Le règlement reste visible, marqué annulé, et ne compte plus dans la dette. */
export function annulerReglement(db: Db, utilisateurId: number, id: number, motif: string): void {
  const m = motif?.trim().replace(/\s+/g, ' ')
  if (!m) throw new ErreurMetier('Indiquez le motif de l’annulation')
  avecTransaction(db, () => {
    const r = une<{
      fournisseurId: number
      fournisseur: string
      montant: number
      annuleLe: string | null
      date: string
    }>(
      db,
      `SELECT g.fournisseur_id AS fournisseurId, f.nom AS fournisseur, g.montant, g.annule_le AS annuleLe,
              g.date_reglement AS date
       FROM reglements_fournisseurs g JOIN fournisseurs f ON f.id = g.fournisseur_id WHERE g.id = ?`,
      id
    )
    if (!r) throw new ErreurMetier('Règlement introuvable : rechargez la liste')
    if (r.annuleLe) throw new ErreurMetier('Ce règlement est déjà annulé')
    executer(
      db,
      `UPDATE reglements_fournisseurs SET annule_le = datetime('now','localtime'), annule_par = ?, motif_annulation = ?
       WHERE id = ?`,
      utilisateurId,
      m,
      id
    )
    journaliser(db, {
      utilisateurId,
      action: 'annulation_reglement_fournisseur',
      entite: 'reglements_fournisseurs',
      entiteId: id,
      avant: { fournisseur: r.fournisseur, montant: r.montant, date: r.date },
      apres: { motif: m }
    })
  })
}

export function dettesFournisseur(db: Db, fournisseurId: number): DettesFournisseur {
  const f = une<{ nom: string; actif: number }>(
    db,
    'SELECT nom, actif FROM fournisseurs WHERE id = ?',
    fournisseurId
  )
  if (!f) throw new ErreurMetier('Fournisseur introuvable : rechargez la liste')
  const jour = aujourdhui(db)
  const receptions = receptionsImputees(db, fournisseurId, jour)

  const versEcheance = (r: ReceptionImputee): EcheanceReception => ({
    receptionId: r.receptionId,
    numero: r.numero,
    dateReception: r.dateReception,
    dateEcheance: r.dateEcheance,
    total: r.total,
    regle: r.regle,
    reste: r.reste,
    etat: r.etat,
    joursRetard: r.joursRetard
  })
  const dues = receptions
    .filter((r) => r.reste > 0)
    .sort(
      (a, b) => (a.dateEcheance ?? '').localeCompare(b.dateEcheance ?? '') || a.receptionId - b.receptionId
    )
  const limite = new Date(Date.parse(`${jour}T00:00:00Z`) - JOURS_SOLDEES * 86_400_000)
    .toISOString()
    .slice(0, 10)
  const soldees = receptions.filter((r) => r.reste <= 0 && r.dateReception.slice(0, 10) >= limite).reverse()

  const reglements = toutes<ReglementFournisseur>(
    db,
    `SELECT g.id, g.date_reglement AS date, g.montant, g.mode, g.reference, r.numero AS reception,
            u.nom AS utilisateur, g.annule_le AS annuleLe, a.nom AS annulePar, g.motif_annulation AS motifAnnulation
     FROM reglements_fournisseurs g
     JOIN utilisateurs u ON u.id = g.utilisateur_id
     LEFT JOIN utilisateurs a ON a.id = g.annule_par
     LEFT JOIN receptions r ON r.id = g.reception_id
     WHERE g.fournisseur_id = ?
     ORDER BY g.date_reglement DESC, g.id DESC`,
    fournisseurId
  )

  const avoirs = avoirsFournisseur(db, fournisseurId)
  // Même formule que v_dettes_fournisseurs : négatif quand un avoir dépasse ce qui restait dû.
  const totalRegle = reglements.filter((r) => !r.annuleLe).reduce((t, r) => t + r.montant, 0)
  const totalAvoirs = avoirs.reduce((t, a) => t + (a.statut === 'recu' ? (a.montantRecu ?? 0) : 0), 0)

  return {
    fournisseurId,
    nom: f.nom,
    actif: f.actif === 1,
    soldeDu: receptions.reduce((t, r) => t + r.total, 0) - totalRegle - totalAvoirs,
    enRetard: dues.filter((r) => r.etat === 'en_retard').reduce((t, r) => t + r.reste, 0),
    echeances: [...dues, ...soldees].map(versEcheance),
    reglements,
    avoirs,
    avoirsAttendus: avoirs.reduce((t, a) => t + (a.statut === 'attendu' ? a.montantAttendu : 0), 0)
  }
}
