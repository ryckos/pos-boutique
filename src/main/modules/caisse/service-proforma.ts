/**
 * Propriétaire : Dev A.
 *
 * Proforma (devis) faite depuis le panier de la caisse (tâche A10, règle 6.13). Précisions validées par
 * Dev A (2026-10-15) :
 * - ni vente, ni mouvement de stock, ni paiement, pas besoin de caisse ouverte ; numéro PF-AAAA-NNNNNN ;
 * - prix, remises, désignations et TVA relus en base et recopiés, avec les mêmes contrôles que la vente
 *   (`preparerLignes`, remise sur le ticket, plafond de la caissière : l'accord du gérant n'est pas
 *   consommé, il servira à la vente) ; client facultatif ;
 * - valable 30 jours ;
 * - reprise dans la caisse : les lignes reviennent au panier et la vente se fait AUX PRIX DU JOUR
 *   (le service de vente relit toujours les prix) ; chaque ligne dont le prix a changé est signalée.
 * Journal `proforma`.
 */
import type {
  ClientDocument,
  LigneProformaReprise,
  ProformaCreee,
  ProformaReprise,
  RequeteProforma
} from '@shared/ipc/caisse'
import type { ParametresBoutique } from '@shared/ipc/parametres'
import type { UtilisateurConnecte } from '@shared/types'
import type { Db } from '../../db/connexion'
import { avecTransaction, executer, toutes, une } from '../../db/requetes'
import { prochainNumero } from '../../core/numerotation'
import { journaliser } from '../../core/audit'
import { ErreurMetier } from '../../core/erreurs'
import type { DonneesProforma } from '../../documents/proforma'
import { enteteDepuis } from '../../materiel/reglages'
import { conditionnementsProduit } from '../catalogue/service'
import { meilleurePromotion } from '../promotions/service'
import { ventilerTva } from './calculs'
import { controlerPlafond, controlerRemiseGlobale, preparerLignes } from './service-vente'

/** Durée de validité imprimée (REGLES_METIER § 6.13) ; à passer en paramètre si la cliente le souhaite. */
export const VALIDITE_PROFORMA_JOURS = 30
const LONGUEUR_MAX = 120

function champ(valeur: string | undefined, libelle: string): string | null {
  const t = String(valeur ?? '').trim()
  if (t.length > LONGUEUR_MAX)
    throw new ErreurMetier(`${libelle} trop long : ${LONGUEUR_MAX} caractères au plus.`)
  return t || null
}

export function creerProforma(db: Db, u: UtilisateurConnecte, demande: RequeteProforma): ProformaCreee {
  const client = {
    nom: champ(demande.client?.nom, 'Nom du client'),
    telephone: champ(demande.client?.telephone, 'Téléphone'),
    adresse: champ(demande.client?.adresse, 'Adresse'),
    nif: champ(demande.client?.nif, 'NIF')
  }

  return avecTransaction(db, () => {
    const lignes = preparerLignes(db, demande.lignes)
    const remiseGlobale = controlerRemiseGlobale(
      demande.remiseGlobale,
      lignes.reduce((s, l) => s + l.totalLigne, 0)
    )
    const totaux = ventilerTva(
      lignes.map((l) => ({ totalTtc: l.totalLigne, tauxTva: l.tauxTva })),
      remiseGlobale
    )
    if (totaux.totalTtc === 0) throw new ErreurMetier('Une proforma ne peut pas être gratuite.')
    controlerPlafond(db, u.id, remiseGlobale + lignes.reduce((s, l) => s + l.remise, 0), demande.jetonRemise)

    const numero = prochainNumero(db, 'PF')
    const { id: proformaId } = executer(
      db,
      `INSERT INTO proformas (numero, client_nom, client_telephone, client_adresse, client_nif, total_ht, total_tva,
                              total_ttc, remise_globale, valide_jusqu_au, utilisateur_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, date('now','localtime', ?), ?)`,
      numero,
      client.nom,
      client.telephone,
      client.adresse,
      client.nif,
      totaux.totalHt,
      totaux.totalTva,
      totaux.totalTtc,
      remiseGlobale,
      `+${VALIDITE_PROFORMA_JOURS} days`,
      u.id
    )
    for (const l of lignes) {
      executer(
        db,
        `INSERT INTO lignes_proforma (proforma_id, produit_id, conditionnement_id, designation, quantite, prix_unitaire,
                                      remise_ligne, taux_tva, total_ligne)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        proformaId,
        l.produitId,
        l.conditionnementId,
        l.designation,
        l.quantite,
        l.prixVente,
        l.remise,
        l.tauxTva,
        l.totalLigne
      )
    }
    journaliser(db, {
      utilisateurId: u.id,
      action: 'proforma',
      entite: 'proformas',
      entiteId: proformaId,
      apres: { numero, montant: totaux.totalTtc, ...(client.nom && { client: client.nom }) }
    })
    const { valideJusquAu } = une<{ valideJusquAu: string }>(
      db,
      'SELECT valide_jusqu_au AS valideJusquAu FROM proformas WHERE id = ?',
      proformaId
    )!
    return { proformaId, numero, totalTtc: totaux.totalTtc, valideJusquAu }
  })
}

interface ProformaEnBase {
  id: number
  numero: string
  horodatage: string
  valideJusquAu: string
  expiree: number
  nom: string | null
  telephone: string | null
  adresse: string | null
  nif: string | null
  remiseGlobale: number
  totalTtc: number
  auteur: string
}

function lireEnTete(db: Db, where: string, valeur: string | number): ProformaEnBase | undefined {
  return une<ProformaEnBase>(
    db,
    `SELECT p.id, p.numero, p.horodatage, p.valide_jusqu_au AS valideJusquAu,
            p.valide_jusqu_au < date('now','localtime') AS expiree, p.client_nom AS nom,
            p.client_telephone AS telephone, p.client_adresse AS adresse, p.client_nif AS nif,
            p.remise_globale AS remiseGlobale, p.total_ttc AS totalTtc, u.nom AS auteur
     FROM proformas p JOIN utilisateurs u ON u.id = p.utilisateur_id WHERE ${where}`,
    valeur
  )
}

const clientDe = (p: ProformaEnBase): ClientDocument | null =>
  p.nom
    ? {
        nom: p.nom,
        ...(p.telephone && { telephone: p.telephone }),
        ...(p.adresse && { adresse: p.adresse }),
        ...(p.nif && { nif: p.nif })
      }
    : null

/** « 12 » → PF-<année>-000012 ; un numéro complet reste tel quel. */
export function numeroProformaComplet(saisie: string, annee: number): string {
  const s = String(saisie ?? '')
    .trim()
    .toUpperCase()
  return /^\d{1,6}$/.test(s) ? `PF-${annee}-${s.padStart(6, '0')}` : s
}

/** La proforma et, pour chaque ligne, l'article tel qu'il se vend aujourd'hui (prix du jour). */
export function lireProforma(db: Db, numero: string): ProformaReprise {
  const complet = numeroProformaComplet(numero, new Date().getFullYear())
  const p = lireEnTete(db, 'p.numero = ?', complet)
  if (!p) throw new ErreurMetier(`Proforma ${complet} introuvable : vérifiez le numéro.`)

  const lignes = toutes<{
    produitId: number
    conditionnementId: number
    designation: string
    quantite: number
    remise: number
    prixProforma: number
  }>(
    db,
    `SELECT produit_id AS produitId, conditionnement_id AS conditionnementId, designation, quantite,
            remise_ligne AS remise, prix_unitaire AS prixProforma
     FROM lignes_proforma WHERE proforma_id = ? ORDER BY id`,
    p.id
  ).map<LigneProformaReprise>((l) => {
    const article =
      conditionnementsProduit(db, l.produitId).find((a) => a.conditionnementId === l.conditionnementId) ??
      null
    // Le prix du jour tient compte des promotions (A16) : le devis fait pendant une promotion, repris
    // pendant la même promotion, n'a pas changé de prix.
    const prixDuJour =
      article === null
        ? null
        : (meilleurePromotion(db, article.produitId, article.quantiteBase, article.prixVente)?.prix ??
          article.prixVente)
    return {
      conditionnementId: l.conditionnementId,
      designation: l.designation,
      quantite: l.quantite,
      remise: l.remise,
      prixProforma: l.prixProforma,
      article,
      prixChange: prixDuJour !== null && prixDuJour !== l.prixProforma
    }
  })

  return {
    proformaId: p.id,
    numero: p.numero,
    horodatage: p.horodatage,
    valideJusquAu: p.valideJusquAu,
    expiree: p.expiree === 1,
    client: clientDe(p),
    remiseGlobale: p.remiseGlobale,
    totalTtc: p.totalTtc,
    lignes
  }
}

/** Tout ce qui s'imprime sur la proforma, tel qu'il a été recopié à sa création. */
export function donneesProforma(db: Db, proformaId: number, parametres: ParametresBoutique): DonneesProforma {
  if (!Number.isInteger(proformaId))
    throw new ErreurMetier('Proforma introuvable : rouvrez-la par son numéro.')
  const p = lireEnTete(db, 'p.id = ?', proformaId)
  if (!p) throw new ErreurMetier('Proforma introuvable : rouvrez-la par son numéro.')
  const lignes = toutes<DonneesProforma['lignes'][number]>(
    db,
    `SELECT designation, quantite, prix_unitaire AS prixUnitaire, remise_ligne AS remise,
            total_ligne AS totalLigne, taux_tva AS tauxTva
     FROM lignes_proforma WHERE proforma_id = ? ORDER BY id`,
    p.id
  )
  const entete = enteteDepuis(parametres)
  return {
    numero: p.numero,
    horodatage: p.horodatage,
    valideJusquAu: p.valideJusquAu,
    auteur: p.auteur,
    boutique: { nom: entete.nom, adresse: entete.adresse, nif: parametres.boutiqueNif },
    client: { nom: p.nom, telephone: p.telephone, adresse: p.adresse, nif: p.nif },
    lignes,
    remiseGlobale: p.remiseGlobale,
    totalTtc: p.totalTtc,
    // Même ventilation qu'à la création : les totaux enregistrés et imprimés concordent.
    parTaux: ventilerTva(
      lignes.map((l) => ({ totalTtc: l.totalLigne, tauxTva: l.tauxTva })),
      p.remiseGlobale
    ).parTaux
  }
}
