/**
 * Fiches fournisseurs. Propriétaire : Dev B.
 * Règles (REGLES_METIER § 4.6) : nom unique parmi les actifs ; délai de paiement en jours entiers
 * (0 = comptant) ; jamais de suppression, désactivation avec motif, refusée tant qu'il reste une dette.
 */
import type { Fournisseur, SaisieFournisseur } from '@shared/ipc/fournisseurs'
import type { Db } from '../../db/connexion'
import { avecTransaction, executer, toutes, une } from '../../db/requetes'
import { ErreurMetier } from '../../core/erreurs'
import { journaliser } from '../../core/audit'
import { formaterFCFA } from '@shared/format'
import { resumeEcheances } from './reglements'

const DELAI_MAX = 365

// Même calcul que v_dettes_fournisseurs, mais aussi pour les désactivés (la vue les écarte).
// Un règlement annulé ne compte plus (B10). Les avoirs reçus (B11) viendront en déduction.
const SOLDE_DU = `COALESCE((SELECT SUM(r.total) FROM receptions r WHERE r.fournisseur_id = f.id), 0)
  - COALESCE((SELECT SUM(g.montant) FROM reglements_fournisseurs g
              WHERE g.fournisseur_id = f.id AND g.annule_le IS NULL), 0)`

interface LigneFournisseur extends Omit<Fournisseur, 'actif'> {
  actif: number
}

function lire(db: Db, id: number): LigneFournisseur {
  const f = une<LigneFournisseur>(
    db,
    `SELECT f.id, f.nom, f.contact, f.telephone, f.adresse, f.delai_paiement_jours AS delaiPaiementJours,
            f.actif, ${SOLDE_DU} AS soldeDu,
            (SELECT MAX(r.date_reception) FROM receptions r WHERE r.fournisseur_id = f.id) AS derniereReception
     FROM fournisseurs f WHERE f.id = ?`,
    id
  )
  if (!f) throw new ErreurMetier('Fournisseur introuvable : rechargez la liste')
  return f
}

/** Texte facultatif : espaces superflus retirés, vide = null. */
function facultatif(v: string | null | undefined): string | null {
  const t = (v ?? '').trim().replace(/\s+/g, ' ')
  return t === '' ? null : t
}

function valider(db: Db, s: SaisieFournisseur, saufId?: number): Required<SaisieFournisseur> {
  const nom = facultatif(s.nom)
  if (!nom) throw new ErreurMetier('Le nom du fournisseur est obligatoire')
  const cle = nom.toLocaleLowerCase('fr')
  const actifs = toutes<{ id: number; nom: string }>(db, 'SELECT id, nom FROM fournisseurs WHERE actif = 1')
  if (actifs.some((f) => f.id !== saufId && f.nom.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr') === cle)) {
    throw new ErreurMetier(`Le fournisseur « ${nom} » existe déjà`)
  }
  const delai = s.delaiPaiementJours
  if (!Number.isInteger(delai) || delai < 0 || delai > DELAI_MAX) {
    throw new ErreurMetier(`Le délai de paiement est un nombre de jours entre 0 (comptant) et ${DELAI_MAX}`)
  }
  return {
    nom,
    contact: facultatif(s.contact),
    telephone: facultatif(s.telephone),
    adresse: facultatif(s.adresse),
    delaiPaiementJours: delai
  }
}

/** Actifs puis désactivés, chacun par ordre alphabétique. */
export function listerFournisseurs(db: Db): Fournisseur[] {
  return toutes<LigneFournisseur>(
    db,
    `SELECT f.id, f.nom, f.contact, f.telephone, f.adresse, f.delai_paiement_jours AS delaiPaiementJours,
            f.actif, ${SOLDE_DU} AS soldeDu,
            (SELECT MAX(r.date_reception) FROM receptions r WHERE r.fournisseur_id = f.id) AS derniereReception
     FROM fournisseurs f`
  )
    .map((f) => ({
      ...f,
      actif: f.actif === 1,
      ...(f.soldeDu > 0 ? resumeEcheances(db, f.id) : { enRetard: 0, prochaineEcheance: null })
    }))
    .sort((a, b) => Number(b.actif) - Number(a.actif) || a.nom.localeCompare(b.nom, 'fr'))
}

export function creerFournisseur(db: Db, saisie: SaisieFournisseur): number {
  return avecTransaction(db, () => {
    const s = valider(db, saisie)
    return executer(
      db,
      `INSERT INTO fournisseurs (nom, contact, telephone, adresse, delai_paiement_jours) VALUES (?, ?, ?, ?, ?)`,
      s.nom, s.contact, s.telephone, s.adresse, s.delaiPaiementJours
    ).id
  })
}

/** Le nouveau délai ne vaut que pour les réceptions à venir : les échéances passées ne bougent pas. */
export function modifierFournisseur(db: Db, id: number, saisie: SaisieFournisseur): void {
  avecTransaction(db, () => {
    const f = lire(db, id)
    if (!f.actif) throw new ErreurMetier(`« ${f.nom} » est désactivé`)
    const s = valider(db, saisie, id)
    executer(
      db,
      `UPDATE fournisseurs SET nom = ?, contact = ?, telephone = ?, adresse = ?, delai_paiement_jours = ? WHERE id = ?`,
      s.nom, s.contact, s.telephone, s.adresse, s.delaiPaiementJours, id
    )
  })
}

/**
 * Refusée tant qu'il reste une dette : désactivé, le fournisseur sortirait de v_dettes_fournisseurs
 * et sa dette disparaîtrait des comptes.
 */
export function desactiverFournisseur(db: Db, utilisateurId: number, id: number, motif: string): void {
  const m = facultatif(motif)
  if (!m) throw new ErreurMetier('Indiquez le motif de la désactivation')
  avecTransaction(db, () => {
    const f = lire(db, id)
    if (!f.actif) throw new ErreurMetier(`« ${f.nom} » est déjà désactivé`)
    if (f.soldeDu > 0) {
      throw new ErreurMetier(`Vous devez encore ${formaterFCFA(f.soldeDu)} à « ${f.nom} » : réglez la dette d’abord`)
    }
    executer(db, 'UPDATE fournisseurs SET actif = 0 WHERE id = ?', id)
    journaliser(db, {
      utilisateurId,
      action: 'desactivation_fournisseur',
      entite: 'fournisseurs',
      entiteId: id,
      avant: { nom: f.nom },
      apres: { motif: m }
    })
  })
}
