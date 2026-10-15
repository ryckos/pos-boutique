/**
 * Propriétaire : Dev A.
 *
 * Facture A4 (tâche A10, règle 6.12). Précisions validées par Dev A (2026-10-15) :
 * - elle naît d'un ticket DÉJÀ encaissé : ni vente, ni mouvement de stock, ni paiement, pas besoin de
 *   caisse ouverte. Une seule facture par ticket, numéro F-AAAA-NNNNNN ;
 * - coordonnées du client saisies et recopiées (nom obligatoire ; téléphone, adresse, NIF facultatifs) ;
 * - refus : ticket annulé, document qui n'est pas un ticket de vente, ticket entièrement retourné,
 *   ticket déjà facturé. Un ticket avec des retours : section « Retours » et net payé ;
 * - caissière et gérant, n'importe quel ticket ; journal `facture` ;
 * - sortie en PDF (enregistré) ou imprimée, hors transaction (ipc.ts) : la première sortie réussie de
 *   chaque sorte est l'original, les suivantes portent « COPIE » (journal `edition_facture`).
 */
import type { ClientDocument, FactureCreee, SortieDocument } from '@shared/ipc/caisse'
import type { ParametresBoutique } from '@shared/ipc/parametres'
import { numeroTicketComplet } from '@shared/retour'
import type { UtilisateurConnecte } from '@shared/types'
import type { Db } from '../../db/connexion'
import { avecTransaction, executer, toutes, une } from '../../db/requetes'
import { prochainNumero } from '../../core/numerotation'
import { journaliser } from '../../core/audit'
import { ErreurMetier } from '../../core/erreurs'
import type { DonneesFacture } from '../../documents/facture'
import { enteteDepuis } from '../../materiel/reglages'
import { ventilerTva } from './calculs'
import { venteParNumero } from './service-ticket'

const LONGUEUR_MAX = 120

interface TicketAFacturer {
  id: number
  numeroTicket: string
  type: string
  statut: string
  totalTtc: number
  retourne: number
}

function lireTicket(db: Db, venteId: number): TicketAFacturer {
  return une<TicketAFacturer>(
    db,
    `SELECT v.id, v.numero_ticket AS numeroTicket, v.type, v.statut, v.total_ttc AS totalTtc,
            COALESCE((SELECT -SUM(r.total_ttc) FROM ventes r
                      WHERE r.vente_origine_id = v.id AND r.type = 'retour' AND r.statut = 'terminee'), 0) AS retourne
     FROM ventes v WHERE v.id = ?`,
    venteId
  )!
}

const factureDe = (db: Db, venteId: number): FactureCreee | undefined =>
  une<FactureCreee>(
    db,
    `SELECT f.id AS factureId, f.numero, v.numero_ticket AS numeroTicket
     FROM factures f JOIN ventes v ON v.id = f.vente_id WHERE f.vente_id = ?`,
    venteId
  )

const annee = (): number => new Date().getFullYear()

/** Champ facultatif : texte nettoyé, null si vide. */
function champ(valeur: string | undefined, libelle: string): string | null {
  const t = String(valeur ?? '').trim()
  if (t.length > LONGUEUR_MAX)
    throw new ErreurMetier(`${libelle} trop long : ${LONGUEUR_MAX} caractères au plus.`)
  return t || null
}

export function facturer(
  db: Db,
  u: UtilisateurConnecte,
  demande: { numeroTicket: string; client: ClientDocument }
): FactureCreee {
  const nom = champ(demande.client?.nom, 'Nom du client')
  if (!nom) throw new ErreurMetier('Saisissez le nom du client (ou de l’entreprise) à facturer.')
  const client = {
    nom,
    telephone: champ(demande.client.telephone, 'Téléphone'),
    adresse: champ(demande.client.adresse, 'Adresse'),
    nif: champ(demande.client.nif, 'NIF')
  }
  const venteId = venteParNumero(db, numeroTicketComplet(String(demande.numeroTicket ?? ''), annee()))

  return avecTransaction(db, () => {
    const t = lireTicket(db, venteId)
    if (t.type !== 'ticket') {
      throw new ErreurMetier(
        `Le document ${t.numeroTicket} n’est pas un ticket de vente : facturez le ticket d’origine.`
      )
    }
    if (t.statut !== 'terminee')
      throw new ErreurMetier(`Le ticket ${t.numeroTicket} est annulé : il ne se facture pas.`)
    if (t.totalTtc - t.retourne <= 0) {
      throw new ErreurMetier(`Tout le ticket ${t.numeroTicket} a été retourné : il n’y a rien à facturer.`)
    }
    const existante = factureDe(db, venteId)
    if (existante) {
      throw new ErreurMetier(
        `Le ticket ${t.numeroTicket} a déjà la facture ${existante.numero} : rééditez-la au lieu d’en créer une autre.`
      )
    }

    const numero = prochainNumero(db, 'F')
    const factureId = executer(
      db,
      `INSERT INTO factures (numero, vente_id, client_nom, client_telephone, client_adresse, client_nif, utilisateur_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      numero,
      venteId,
      client.nom,
      client.telephone,
      client.adresse,
      client.nif,
      u.id
    ).id
    journaliser(db, {
      utilisateurId: u.id,
      action: 'facture',
      entite: 'factures',
      entiteId: factureId,
      apres: { numero, numeroTicket: t.numeroTicket, client: client.nom, montant: t.totalTtc - t.retourne }
    })
    return { factureId, numero, numeroTicket: t.numeroTicket }
  })
}

/** Par le numéro de la facture (F-…) ou par celui du ticket (complet ou court). */
export function trouverFacture(db: Db, numero: string): FactureCreee | null {
  const saisie = String(numero ?? '')
    .trim()
    .toUpperCase()
  if (saisie.startsWith('F-')) {
    return (
      une<FactureCreee>(
        db,
        `SELECT f.id AS factureId, f.numero, v.numero_ticket AS numeroTicket
         FROM factures f JOIN ventes v ON v.id = f.vente_id WHERE f.numero = ?`,
        saisie
      ) ?? null
    )
  }
  return factureDe(db, venteParNumero(db, numeroTicketComplet(saisie, annee()))) ?? null
}

/** Tout ce qui s'imprime, relu en base : la facture ne garde que le lien et le client. */
/**
 * Une demande de sortie venue de l'écran : identifiant entier et sorte connue, sinon refus clair.
 * Sert aussi à la proforma (`document` = 'Proforma').
 */
export function verifierEdition(id: unknown, sortie: unknown, document = 'Facture'): void {
  if (!Number.isInteger(id)) throw new ErreurMetier(`${document} introuvable : rouvrez-la par son numéro.`)
  if (sortie !== 'enregistrer' && sortie !== 'imprimer') {
    throw new ErreurMetier('Choisissez « Enregistrer le PDF » ou « Imprimer ».')
  }
}

export function lireFacture(db: Db, factureId: number, parametres: ParametresBoutique): DonneesFacture {
  if (!Number.isInteger(factureId)) throw new ErreurMetier('Facture introuvable : rouvrez-la par son numéro.')
  const f = une<{
    numero: string
    horodatage: string
    venteId: number
    nom: string
    telephone: string | null
    adresse: string | null
    nif: string | null
    numeroTicket: string
    dateTicket: string
    caissier: string
    totalTtc: number
    remiseGlobale: number
  }>(
    db,
    `SELECT f.numero, f.horodatage, f.vente_id AS venteId, f.client_nom AS nom, f.client_telephone AS telephone,
            f.client_adresse AS adresse, f.client_nif AS nif, v.numero_ticket AS numeroTicket,
            v.horodatage AS dateTicket, u.nom AS caissier, v.total_ttc AS totalTtc, v.remise_globale AS remiseGlobale
     FROM factures f JOIN ventes v ON v.id = f.vente_id JOIN utilisateurs u ON u.id = v.utilisateur_id
     WHERE f.id = ?`,
    factureId
  )
  if (!f) throw new ErreurMetier('Facture introuvable.')

  const lignes = toutes<DonneesFacture['lignes'][number]>(
    db,
    `SELECT designation, quantite, prix_unitaire AS prixUnitaire, remise_ligne AS remise,
            total_ligne AS totalLigne, taux_tva AS tauxTva
     FROM lignes_vente WHERE vente_id = ? ORDER BY id`,
    f.venteId
  )
  const retours = toutes<{ id: number; numero: string; horodatage: string; total: number }>(
    db,
    `SELECT id, numero_ticket AS numero, horodatage, total_ttc AS total FROM ventes
     WHERE vente_origine_id = ? AND type = 'retour' AND statut = 'terminee' ORDER BY id`,
    f.venteId
  ).map((r) => ({
    numero: r.numero,
    horodatage: r.horodatage,
    total: r.total,
    lignes: toutes<{ designation: string; quantite: number; totalLigne: number }>(
      db,
      'SELECT designation, quantite, total_ligne AS totalLigne FROM lignes_vente WHERE vente_id = ? ORDER BY id',
      r.id
    )
  }))
  const entete = enteteDepuis(parametres)

  return {
    numero: f.numero,
    horodatage: f.horodatage,
    numeroTicket: f.numeroTicket,
    dateTicket: f.dateTicket,
    caissier: f.caissier,
    boutique: { nom: entete.nom, adresse: entete.adresse, nif: parametres.boutiqueNif },
    client: { nom: f.nom, telephone: f.telephone, adresse: f.adresse, nif: f.nif },
    lignes,
    remiseGlobale: f.remiseGlobale,
    totalTtc: f.totalTtc,
    // TVA ventilée comme à la vente (règle 6.4) : mêmes chiffres que sur le ticket.
    parTaux: ventilerTva(
      lignes.map((l) => ({ totalTtc: l.totalLigne, tauxTva: l.tauxTva })),
      f.remiseGlobale
    ).parTaux,
    paiements: toutes(
      db,
      'SELECT mode, montant, reference FROM paiements WHERE vente_id = ? AND montant > 0 ORDER BY id',
      f.venteId
    ),
    retours,
    netPaye: f.totalTtc + retours.reduce((s, r) => s + r.total, 0)
  }
}

/** Original ou COPIE : une sortie réussie de cette sorte a-t-elle déjà eu lieu ? */
export function dejaEditee(db: Db, factureId: number, sortie: SortieDocument): boolean {
  return toutes<{ apres: string }>(
    db,
    "SELECT nouvelle_valeur AS apres FROM journal_audit WHERE action = 'edition_facture' AND entite = 'factures' AND entite_id = ?",
    factureId
  ).some((e) => JSON.parse(e.apres)?.sortie === sortie)
}

/** À appeler seulement APRÈS une sortie réussie (PDF enregistré ou impression lancée). */
export function noterEdition(
  db: Db,
  utilisateurId: number,
  factureId: number,
  sortie: SortieDocument,
  copie: boolean
): void {
  journaliser(db, {
    utilisateurId,
    action: 'edition_facture',
    entite: 'factures',
    entiteId: factureId,
    apres: { sortie, copie }
  })
}
