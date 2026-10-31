/**
 * Propriétaire : Dev A.
 *
 * Avoirs en boutique (A11, REGLES_METIER § 7.2). Un retour client remboursé en avoir crée un crédit
 * nominatif (`avoirs`) que le client dépense ensuite à la caisse, en une ou plusieurs fois. Le solde
 * n'est jamais stocké : la vue `v_avoirs_clients` le calcule. Ces fonctions s'appellent DANS la
 * transaction du retour ou de la vente ; elles ne relisent pas les droits (c'est le rôle de l'appelant).
 */
import type { AvoirClient } from '@shared/ipc/clients'
import { formaterFCFA } from '@shared/format'
import type { Db } from '../../db/connexion'
import { executer, toutes, une } from '../../db/requetes'
import { ErreurMetier } from '../../core/erreurs'
import { prochainNumero } from '../../core/numerotation'

/** Solde total des avoirs d'un client, FCFA. */
export function soldeAvoirs(db: Db, clientId: number): number {
  return une<{ solde: number }>(
    db,
    'SELECT COALESCE(SUM(solde), 0) AS solde FROM v_avoirs_clients WHERE client_id = ?',
    clientId
  )!.solde
}

/** Les avoirs d'un client, les plus récents d'abord. */
export function avoirsDuClient(db: Db, clientId: number): AvoirClient[] {
  return toutes<AvoirClient>(
    db,
    `SELECT a.avoir_id AS id, a.numero, a.cree_le AS creeLe, a.montant_initial AS montantInitial,
            a.utilise, a.solde, r.numero_ticket AS numeroRetour
       FROM v_avoirs_clients a JOIN ventes r ON r.id = a.retour_id
      WHERE a.client_id = ?
      ORDER BY a.cree_le DESC, a.avoir_id DESC`,
    clientId
  )
}

/** Un client actif, ou le message qui dit quoi faire. */
function clientActif(db: Db, clientId: number): { nom: string } {
  const c = une<{ nom: string; actif: number }>(db, 'SELECT nom, actif FROM clients WHERE id = ?', clientId)
  if (!c) throw new ErreurMetier('Client introuvable : choisissez-le dans la liste.')
  if (!c.actif) throw new ErreurMetier(`« ${c.nom} » est désactivé : choisissez un autre client.`)
  return c
}

/** Crée l'avoir d'un retour. Le montant est un entier de francs strictement positif. */
export function creerAvoir(
  db: Db,
  p: { clientId: number; retourId: number; montant: number; utilisateurId: number }
): { id: number; numero: string; client: string; montant: number; soldeClient: number } {
  if (!Number.isInteger(p.montant) || p.montant <= 0) {
    throw new ErreurMetier('Le montant d’un avoir est un nombre entier de francs, supérieur à 0.')
  }
  const client = clientActif(db, p.clientId)
  const numero = prochainNumero(db, 'AV')
  const id = executer(
    db,
    'INSERT INTO avoirs (numero, client_id, montant, retour_id, utilisateur_id) VALUES (?, ?, ?, ?, ?)',
    numero,
    p.clientId,
    p.montant,
    p.retourId,
    p.utilisateurId
  ).id
  return { id, numero, client: client.nom, montant: p.montant, soldeClient: soldeAvoirs(db, p.clientId) }
}

/**
 * Dépense `montant` des avoirs du client pour une vente : les plus anciens d'abord. Refus si le solde
 * ne suffit pas. Renvoie le détail par avoir.
 */
export function depenserAvoirs(
  db: Db,
  p: { clientId: number; venteId: number; montant: number; utilisateurId: number }
): { avoirId: number; numero: string; montant: number }[] {
  clientActif(db, p.clientId)
  const solde = soldeAvoirs(db, p.clientId)
  if (p.montant > solde) {
    throw new ErreurMetier(
      `L’avoir du client est de ${formaterFCFA(solde)} : impossible d’en dépenser ${formaterFCFA(p.montant)}.`
    )
  }
  const ouverts = toutes<{ avoirId: number; numero: string; solde: number }>(
    db,
    `SELECT avoir_id AS avoirId, numero, solde FROM v_avoirs_clients
      WHERE client_id = ? AND solde > 0 ORDER BY cree_le, avoir_id`,
    p.clientId
  )
  const detail: { avoirId: number; numero: string; montant: number }[] = []
  let reste = p.montant
  for (const a of ouverts) {
    if (reste <= 0) break
    const prise = Math.min(a.solde, reste)
    executer(
      db,
      'INSERT INTO utilisations_avoir (avoir_id, vente_id, montant, utilisateur_id) VALUES (?, ?, ?, ?)',
      a.avoirId,
      p.venteId,
      prise,
      p.utilisateurId
    )
    detail.push({ avoirId: a.avoirId, numero: a.numero, montant: prise })
    reste -= prise
  }
  return detail
}

/**
 * Annulation d'un ticket payé en partie par avoir : chaque dépense est rétablie par une ligne négative
 * liée (jamais effacée). Renvoie le montant rétabli, 0 s'il n'y avait pas d'avoir.
 */
export function retablirAvoirs(db: Db, venteId: number, utilisateurId: number): number {
  const depenses = toutes<{ id: number; avoirId: number; montant: number }>(
    db,
    `SELECT u.id, u.avoir_id AS avoirId, u.montant FROM utilisations_avoir u
      WHERE u.vente_id = ? AND u.montant > 0
        AND NOT EXISTS (SELECT 1 FROM utilisations_avoir r WHERE r.utilisation_origine_id = u.id)`,
    venteId
  )
  for (const d of depenses) {
    executer(
      db,
      `INSERT INTO utilisations_avoir (avoir_id, vente_id, montant, utilisation_origine_id, utilisateur_id)
       VALUES (?, ?, ?, ?, ?)`,
      d.avoirId,
      venteId,
      -d.montant,
      d.id,
      utilisateurId
    )
  }
  return depenses.reduce((s, d) => s + d.montant, 0)
}
