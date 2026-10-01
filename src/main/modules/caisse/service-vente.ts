/**
 * Propriétaire : Dev A.
 *
 * Enregistrement d'une vente (règle 6.3) — le modèle de transaction du projet, lu par Dev B.
 *
 * Tout se fait dans UNE transaction : la vente, ses lignes, ses mouvements de stock et ses
 * paiements existent ensemble ou pas du tout. L'écran n'envoie que des identifiants, des
 * quantités et des paiements : prix, coûts et TVA sont relus en base. L'impression et le tiroir
 * viennent APRÈS, hors transaction (tâche A3).
 *
 * Remises (règle 6.6, A5) : montants contrôlés ici, plafond de la caissière relu dans les
 * paramètres, chaque remise journalisée dans la même transaction que la vente.
 */
import type { ModePaiementCaisse, RequeteVente, VenteEnregistree } from '@shared/ipc/caisse'
import type { Role } from '@shared/types'
import { formaterFCFA } from '@shared/format'
import type { Db } from '../../db/connexion'
import { avecTransaction, executer, une } from '../../db/requetes'
import { enregistrerMouvement, stockProduit } from '../../core/mouvements'
import { prochainNumero } from '../../core/numerotation'
import { journaliser } from '../../core/audit'
import { ErreurMetier } from '../../core/erreurs'
import { verifierCodeCompte } from '../auth/service'
import { lireParametres } from '../parametres/service'
import { ventilerTva } from './calculs'
import { sessionOuverte } from './service-session'

const MODES: Record<ModePaiementCaisse, string> = { especes: 'Espèces', tmoney: 'TMoney', flooz: 'Flooz' }
const MOBILE_MONEY: ModePaiementCaisse[] = ['tmoney', 'flooz']

/** Un conditionnement tel que la base le connaît au moment de la vente. */
interface ConditionnementEnBase {
  conditionnementId: number
  produitId: number
  designation: string
  quantiteBase: number
  prixVente: number
  tauxTva: number
  /** CUMP par unité de base. */
  cump: number
}

/** Une ligne préparée, prête à être photocopiée dans lignes_vente. */
interface LignePreparee extends ConditionnementEnBase {
  quantite: number
  remise: number
  /** Quantité × prix − remise. */
  totalLigne: number
  quantiteBaseTotale: number
}

const estMontant = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0

function lireConditionnement(db: Db, conditionnementId: number): ConditionnementEnBase {
  const c = une<ConditionnementEnBase>(
    db,
    `SELECT v.conditionnement_id AS conditionnementId, v.produit_id AS produitId, v.designation,
            v.quantite_base AS quantiteBase, v.prix_vente AS prixVente, v.taux_tva AS tauxTva,
            p.cout_moyen_pondere AS cump
     FROM v_catalogue_vente v JOIN produits p ON p.id = v.produit_id
     WHERE v.conditionnement_id = ?`,
    conditionnementId
  )
  if (!c) {
    throw new ErreurMetier(
      'Un article du ticket n’est plus en vente (désactivé ou supprimé du catalogue). Retirez-le du ticket.'
    )
  }
  return c
}

function preparerLignes(db: Db, lignes: RequeteVente['lignes']): LignePreparee[] {
  if (!Array.isArray(lignes) || lignes.length === 0) {
    throw new ErreurMetier('Le ticket est vide : scannez un article avant d’encaisser.')
  }
  return lignes.map(({ conditionnementId, quantite, remise = 0 }) => {
    if (!Number.isInteger(quantite) || quantite < 1) {
      throw new ErreurMetier('Quantité invalide sur une ligne : saisissez un nombre entier d’au moins 1.')
    }
    const c = lireConditionnement(db, conditionnementId)
    if (!estMontant(remise)) {
      throw new ErreurMetier(
        `Remise invalide sur « ${c.designation} » : saisissez un montant en francs, sans virgule.`
      )
    }
    const brut = quantite * c.prixVente
    if (remise > brut) {
      throw new ErreurMetier(
        `La remise sur « ${c.designation} » (${formaterFCFA(remise)}) dépasse le montant de la ligne (${formaterFCFA(brut)}).`
      )
    }
    return {
      ...c,
      quantite,
      remise,
      totalLigne: brut - remise,
      quantiteBaseTotale: quantite * c.quantiteBase
    }
  })
}

/** Remise sur le ticket : entière, au plus le total des lignes (règle 6.6). */
function controlerRemiseGlobale(remiseGlobale: unknown, totalLignes: number): number {
  if (remiseGlobale === undefined) return 0
  if (!estMontant(remiseGlobale)) {
    throw new ErreurMetier('Remise sur le ticket invalide : saisissez un montant en francs, sans virgule.')
  }
  if (remiseGlobale > totalLignes) {
    throw new ErreurMetier(
      `La remise sur le ticket (${formaterFCFA(remiseGlobale)}) dépasse le total des articles (${formaterFCFA(totalLignes)}).`
    )
  }
  return remiseGlobale
}

const roleDe = (db: Db, utilisateurId: number): Role | undefined =>
  une<{ role: Role }>(db, 'SELECT role FROM utilisateurs WHERE id = ? AND actif = 1', utilisateurId)?.role

const estGerant = (role: Role | undefined): boolean => role === 'gerant' || role === 'admin'

/**
 * Plafond de la caissière (règle 6.6) : il porte sur le total des remises du ticket. Non renseigné
 * (D-A3 en attente) = aucune remise sans gérant. Renvoie le gérant qui a autorisé, quand il en a
 * fallu un.
 */
function controlerPlafond(
  db: Db,
  utilisateurId: number,
  totalRemises: number,
  autoriseeParId: number | undefined
): number | undefined {
  if (totalRemises === 0 || estGerant(roleDe(db, utilisateurId))) return undefined
  const plafond = lireParametres(db).plafondRemiseCaissier ?? 0
  if (totalRemises <= plafond) return undefined
  // Rôle relu en base : un identifiant seul ne prouve rien.
  if (autoriseeParId !== undefined && estGerant(roleDe(db, autoriseeParId))) return autoriseeParId
  throw new ErreurMetier(
    plafond === 0
      ? `Une remise de ${formaterFCFA(totalRemises)} demande l’accord du gérant : faites-lui taper son code.`
      : `Remise de ${formaterFCFA(totalRemises)} au-delà de votre plafond (${formaterFCFA(plafond)}) : faites taper le code du gérant.`
  )
}

/**
 * Vérifie le code tapé par le gérant sur la caisse (même verrouillage que la connexion) et renvoie
 * son identifiant. À appeler AVANT la transaction de vente : un code faux doit rester compté même
 * si la vente échoue ensuite.
 */
export function verifierAutorisationGerant(
  db: Db,
  autorisation: NonNullable<RequeteVente['autorisationGerant']>
): number {
  if (!Number.isInteger(autorisation.utilisateurId))
    throw new ErreurMetier('Choisissez le gérant qui autorise.')
  if (!estGerant(roleDe(db, autorisation.utilisateurId))) {
    throw new ErreurMetier('Seul un gérant peut autoriser cette remise : choisissez un compte de gérant.')
  }
  return verifierCodeCompte(db, autorisation.utilisateurId, String(autorisation.code ?? '')).id
}

/** Contrôle des paiements (règle 6.5). Renvoie les espèces reçues et la monnaie à rendre. */
function controlerPaiements(
  requete: RequeteVente,
  totalTtc: number
): { montantRecu: number; monnaieRendue: number } {
  const paiements = requete.paiements ?? []
  if (paiements.length === 0) throw new ErreurMetier('Choisissez un mode de paiement avant d’encaisser.')

  for (const p of paiements) {
    // hasOwn et non « in » : un mode forgé comme 'constructor' ne doit pas passer.
    if (!Object.hasOwn(MODES, p.mode)) throw new ErreurMetier('Mode de paiement non accepté à la caisse.')
    if (!estMontant(p.montant) || p.montant === 0) {
      throw new ErreurMetier(
        `Montant ${MODES[p.mode]} invalide : saisissez un montant en francs, sans virgule.`
      )
    }
    if (MOBILE_MONEY.includes(p.mode) && !p.reference?.trim()) {
      throw new ErreurMetier(`Saisissez la référence de la transaction ${MODES[p.mode]}.`)
    }
  }

  const paye = paiements.reduce((s, p) => s + p.montant, 0)
  if (paye < totalTtc)
    throw new ErreurMetier(`Paiement incomplet : il manque ${formaterFCFA(totalTtc - paye)}.`)
  if (paye > totalTtc) {
    throw new ErreurMetier(
      `Paiement supérieur au total de ${formaterFCFA(paye - totalTtc)} : corrigez les montants.`
    )
  }

  const especes = paiements.filter((p) => p.mode === 'especes').reduce((s, p) => s + p.montant, 0)
  if (especes === 0) return { montantRecu: 0, monnaieRendue: 0 }
  const montantRecu = requete.montantRecu ?? especes
  if (!estMontant(montantRecu)) {
    throw new ErreurMetier('Montant reçu invalide : saisissez un montant en francs, sans virgule.')
  }
  if (montantRecu < especes) {
    throw new ErreurMetier(`Espèces reçues insuffisantes : il manque ${formaterFCFA(especes - montantRecu)}.`)
  }
  return { montantRecu, monnaieRendue: montantRecu - especes }
}

/**
 * `autoriseeParId` : le gérant dont le code a été vérifié par `verifierAutorisationGerant`, quand les
 * remises dépassent le plafond de la caissière.
 */
export function enregistrerVente(
  db: Db,
  utilisateurId: number,
  requete: RequeteVente,
  autoriseeParId?: number
): VenteEnregistree {
  return avecTransaction(db, () => {
    const session = sessionOuverte(db, utilisateurId)
    if (!session) throw new ErreurMetier('Ouvrez la caisse (fond de caisse) avant d’encaisser.')

    const lignes = preparerLignes(db, requete.lignes)
    const remiseGlobale = controlerRemiseGlobale(
      requete.remiseGlobale,
      lignes.reduce((s, l) => s + l.totalLigne, 0)
    )
    const totaux = ventilerTva(
      lignes.map((l) => ({ totalTtc: l.totalLigne, tauxTva: l.tauxTva })),
      remiseGlobale
    )
    if (totaux.totalTtc === 0) {
      throw new ErreurMetier('Un ticket ne peut pas être gratuit : pour un don, faites une sortie de stock.')
    }
    const totalRemises = remiseGlobale + lignes.reduce((s, l) => s + l.remise, 0)
    const autorisePar = controlerPlafond(db, utilisateurId, totalRemises, autoriseeParId)
    const { montantRecu, monnaieRendue } = controlerPaiements(requete, totaux.totalTtc)

    // Le numéro n'est pris qu'une fois tout contrôlé ; en cas d'échec plus loin, le rollback le rend.
    const numeroTicket = prochainNumero(db, 'T')
    const venteId = executer(
      db,
      `INSERT INTO ventes (numero_ticket, session_caisse_id, utilisateur_id, total_ht, total_tva, total_ttc,
                           remise_globale, montant_recu, monnaie_rendue)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      numeroTicket,
      session.id,
      utilisateurId,
      totaux.totalHt,
      totaux.totalTva,
      totaux.totalTtc,
      remiseGlobale,
      montantRecu,
      monnaieRendue
    ).id

    for (const l of lignes) {
      // Photocopie au moment T : l'historique ne bouge plus si le catalogue change.
      executer(
        db,
        `INSERT INTO lignes_vente (vente_id, produit_id, conditionnement_id, designation, quantite, prix_unitaire,
                                   remise_ligne, taux_tva, cout_unitaire, quantite_base_totale, total_ligne)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        venteId,
        l.produitId,
        l.conditionnementId,
        l.designation,
        l.quantite,
        l.prixVente,
        l.remise,
        l.tauxTva,
        l.cump * l.quantiteBase,
        l.quantiteBaseTotale,
        l.totalLigne
      )
      // Lot : null jusqu'au FEFO (A9, allouerFefo de Dev B).
      enregistrerMouvement(db, {
        produitId: l.produitId,
        type: 'vente',
        quantite: -l.quantiteBaseTotale,
        coutUnitaire: l.cump,
        documentType: 'vente',
        documentId: venteId,
        utilisateurId
      })
    }

    for (const p of requete.paiements) {
      executer(
        db,
        'INSERT INTO paiements (vente_id, mode, montant, reference) VALUES (?, ?, ?, ?)',
        venteId,
        p.mode,
        p.montant,
        p.reference?.trim() || null
      )
    }

    // Chaque remise est journalisée (règle 6.6), au nom de la caissière, avec le gérant qui l'a autorisée.
    const remises = [
      ...lignes
        .filter((l) => l.remise > 0)
        .map((l) => ({ portee: 'ligne', designation: l.designation, montant: l.remise })),
      ...(remiseGlobale > 0 ? [{ portee: 'ticket', montant: remiseGlobale }] : [])
    ]
    for (const r of remises) {
      journaliser(db, {
        utilisateurId,
        action: 'remise',
        entite: 'ventes',
        entiteId: venteId,
        apres: { numeroTicket, ...r, ...(autorisePar !== undefined && { autoriseeParId: autorisePar }) }
      })
    }

    // Stock négatif : jamais bloquant (D-A1 en attente), signalé à l'écran.
    const alertesStock = [...new Set(lignes.map((l) => l.produitId))]
      .map((produitId) => ({ produitId, stockApres: stockProduit(db, produitId) }))
      .filter((a) => a.stockApres < 0)
      .map((a) => ({
        ...a,
        designation: une<{ nom: string }>(db, 'SELECT nom FROM produits WHERE id = ?', a.produitId)!.nom
      }))

    return { venteId, numeroTicket, totalTtc: totaux.totalTtc, monnaieRendue, alertesStock }
  })
}
