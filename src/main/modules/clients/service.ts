/**
 * Propriétaire : Dev A. Fiches clients et encours (A11, REGLES_METIER § 7).
 *
 * Règles validées par Dev A (2026-10-28) : la caissière crée un client avec un plafond de 0 et
 * corrige ses coordonnées ; seul le gérant fixe le plafond (journalisé). Téléphone obligatoire dès
 * que le plafond dépasse 0, pour pouvoir relancer. Jamais de suppression : désactivation avec motif,
 * refusée tant que le client doit de l'argent.
 */
import type { Client, CreanceClient, FicheClient, SaisieClient } from '@shared/ipc/clients'
import type { UtilisateurConnecte } from '@shared/types'
import { formaterFCFA } from '@shared/format'
import type { Db } from '../../db/connexion'
import { avecTransaction, executer, toutes, une } from '../../db/requetes'
import { ErreurMetier } from '../../core/erreurs'
import { journaliser } from '../../core/audit'

const RECHERCHE_MAX = 50

const estGerant = (u: UtilisateurConnecte): boolean => u.role === 'gerant' || u.role === 'admin'

// Restant dû des créances non annulées (la vue met 0 pour une annulée), et sa part échue.
const ENCOURS = `COALESCE((SELECT SUM(v.restant_du) FROM v_creances_clients v WHERE v.client_id = c.id), 0)`
const EN_RETARD = `COALESCE((SELECT SUM(v.restant_du) FROM v_creances_clients v
                             WHERE v.client_id = c.id AND v.date_echeance < date('now','localtime')), 0)`
const COLONNES = `c.id, c.nom, c.telephone, c.adresse, c.nif, c.plafond_credit AS plafondCredit, c.actif,
                  ${ENCOURS} AS encours, ${EN_RETARD} AS enRetard`

type LigneClient = Omit<Client, 'actif'> & { actif: number }

const versClient = (l: LigneClient): Client => ({ ...l, actif: l.actif === 1 })

function lire(db: Db, clientId: number): Client {
  const l = une<LigneClient>(db, `SELECT ${COLONNES} FROM clients c WHERE c.id = ?`, clientId)
  if (!l) throw new ErreurMetier('Client introuvable : rechargez la liste')
  return versClient(l)
}

/** Restant dû du client sur ses créances non annulées, FCFA. */
export function encoursClient(db: Db, clientId: number): number {
  return lire(db, clientId).encours
}

/** Texte facultatif : espaces superflus retirés, vide = null. */
function facultatif(v: string | null | undefined): string | null {
  const t = (v ?? '').trim().replace(/\s+/g, ' ')
  return t === '' ? null : t
}

/** Chiffres seuls, pour comparer deux numéros saisis différemment (« 90 00 00 00 », « 90000000 »). */
const chiffres = (t: string): string => t.replace(/\D/g, '')

function valider(
  db: Db,
  s: SaisieClient,
  plafond: number,
  saufId?: number
): { nom: string; telephone: string | null; adresse: string | null; nif: string | null } {
  const nom = facultatif(s.nom)
  if (!nom) throw new ErreurMetier('Le nom du client est obligatoire')
  if (!Number.isInteger(plafond) || plafond < 0) {
    throw new ErreurMetier('Le plafond de crédit est un montant entier en FCFA, 0 pour aucun crédit')
  }
  const telephone = facultatif(s.telephone)
  if (telephone !== null && chiffres(telephone).length < 8) {
    throw new ErreurMetier('Le numéro de téléphone est incomplet : 8 chiffres au moins')
  }
  if (plafond > 0 && telephone === null) {
    throw new ErreurMetier('Un client à crédit doit avoir un téléphone, pour pouvoir le relancer')
  }
  // Deux fiches pour la même personne doubleraient son plafond.
  if (telephone !== null) {
    const doublon = toutes<{ id: number; nom: string; telephone: string }>(
      db,
      'SELECT id, nom, telephone FROM clients WHERE actif = 1 AND telephone IS NOT NULL'
    ).find((c) => c.id !== saufId && chiffres(c.telephone) === chiffres(telephone))
    if (doublon) {
      throw new ErreurMetier(`Ce numéro est déjà celui de « ${doublon.nom} » : choisissez cette fiche`)
    }
  }
  return { nom, telephone, adresse: facultatif(s.adresse), nif: facultatif(s.nif) }
}

export function rechercherClients(db: Db, texte?: string, inclureInactifs = false): Client[] {
  const t = facultatif(texte)
  const conditions: string[] = []
  const params: string[] = []
  if (!inclureInactifs) conditions.push('c.actif = 1')
  if (t) {
    const numero = chiffres(t)
    // Le téléphone se compare chiffres seuls, quelle que soit la façon dont il a été saisi.
    conditions.push(
      numero.length >= 2
        ? `(c.nom LIKE ? OR REPLACE(REPLACE(REPLACE(c.telephone, ' ', ''), '-', ''), '.', '') LIKE ?)`
        : 'c.nom LIKE ?'
    )
    params.push(`%${t}%`)
    if (numero.length >= 2) params.push(`%${numero}%`)
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  return toutes<LigneClient>(db, `SELECT ${COLONNES} FROM clients c ${where}`, ...params)
    .map(versClient)
    .sort((a, b) => Number(b.actif) - Number(a.actif) || a.nom.localeCompare(b.nom, 'fr'))
    .slice(0, RECHERCHE_MAX)
}

export function ficheClient(db: Db, clientId: number): FicheClient {
  const client = lire(db, clientId)
  const creances = toutes<Omit<CreanceClient, 'enRetard'> & { enRetard: number }>(
    db,
    `SELECT v.creance_id AS id, v.vente_id AS venteId, ve.numero_ticket AS numeroTicket, v.cree_le AS creeLe,
            v.montant_initial AS montantInitial, v.total_encaisse AS encaisse, v.restant_du AS restantDu,
            v.date_echeance AS dateEcheance, v.statut,
            (v.restant_du > 0 AND v.date_echeance < date('now','localtime')) AS enRetard
       FROM v_creances_clients v
       JOIN ventes ve ON ve.id = v.vente_id
      WHERE v.client_id = ?
      ORDER BY v.cree_le DESC, v.creance_id DESC`,
    clientId
  ).map((c) => ({ ...c, enRetard: c.enRetard === 1 }))
  return { ...client, creances }
}

export function creerClient(db: Db, u: UtilisateurConnecte, saisie: SaisieClient): Client {
  const plafond = saisie.plafondCredit ?? 0
  if (plafond !== 0 && !estGerant(u)) {
    throw new ErreurMetier('Seul le gérant fixe un plafond de crédit : créez le client sans plafond')
  }
  return avecTransaction(db, () => {
    const s = valider(db, saisie, plafond)
    const id = executer(
      db,
      'INSERT INTO clients (nom, telephone, adresse, nif, plafond_credit) VALUES (?, ?, ?, ?, ?)',
      s.nom,
      s.telephone,
      s.adresse,
      s.nif,
      plafond
    ).id
    journaliser(db, {
      utilisateurId: u.id,
      action: 'creation_client',
      entite: 'clients',
      entiteId: id,
      apres: { nom: s.nom, telephone: s.telephone, plafond }
    })
    return lire(db, id)
  })
}

export function modifierClient(
  db: Db,
  u: UtilisateurConnecte,
  clientId: number,
  saisie: SaisieClient
): Client {
  return avecTransaction(db, () => {
    const avant = lire(db, clientId)
    if (!avant.actif) throw new ErreurMetier(`« ${avant.nom} » est désactivé`)
    const plafond = saisie.plafondCredit ?? avant.plafondCredit
    if (plafond !== avant.plafondCredit && !estGerant(u)) {
      throw new ErreurMetier('Seul le gérant change le plafond de crédit')
    }
    const s = valider(db, saisie, plafond, clientId)
    executer(
      db,
      'UPDATE clients SET nom = ?, telephone = ?, adresse = ?, nif = ?, plafond_credit = ? WHERE id = ?',
      s.nom,
      s.telephone,
      s.adresse,
      s.nif,
      plafond,
      clientId
    )
    const coordonnees = (c: {
      nom: string
      telephone: string | null
      adresse: string | null
      nif: string | null
    }) => ({
      nom: c.nom,
      telephone: c.telephone,
      adresse: c.adresse,
      nif: c.nif
    })
    if (JSON.stringify(coordonnees(avant)) !== JSON.stringify(coordonnees(s))) {
      journaliser(db, {
        utilisateurId: u.id,
        action: 'modification_client',
        entite: 'clients',
        entiteId: clientId,
        avant: coordonnees(avant),
        apres: coordonnees(s)
      })
    }
    if (plafond !== avant.plafondCredit) {
      journaliser(db, {
        utilisateurId: u.id,
        action: 'plafond_credit',
        entite: 'clients',
        entiteId: clientId,
        avant: { client: avant.nom, plafond: avant.plafondCredit },
        apres: { client: s.nom, plafond }
      })
    }
    return lire(db, clientId)
  })
}

export function desactiverClient(db: Db, u: UtilisateurConnecte, clientId: number, motif: string): void {
  const m = facultatif(motif)
  if (!m) throw new ErreurMetier('Indiquez le motif de la désactivation')
  avecTransaction(db, () => {
    const c = lire(db, clientId)
    if (!c.actif) throw new ErreurMetier(`« ${c.nom} » est déjà désactivé`)
    if (c.encours > 0) {
      throw new ErreurMetier(
        `« ${c.nom} » doit encore ${formaterFCFA(c.encours)} : encaissez la dette d’abord`
      )
    }
    executer(db, 'UPDATE clients SET actif = 0 WHERE id = ?', clientId)
    journaliser(db, {
      utilisateurId: u.id,
      action: 'desactivation_client',
      entite: 'clients',
      entiteId: clientId,
      avant: { client: c.nom },
      apres: { motif: m }
    })
  })
}
