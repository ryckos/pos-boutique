/**
 * Propriétaire : Dev A. Rapports de ventes et de caisse (A14, REGLES_METIER § 11.3).
 *
 * Même période que les rapports de gestion (mois en cours par défaut). Chaque document compte à sa
 * propre date et au nom de celui qui l'a saisi. Aucun contrôle de droit ici : `ipc.ts` exige le gérant.
 */
import type { PeriodeRapport } from '@shared/ipc/rapports-gestion'
import type {
  CritereClassement,
  ProduitClasse,
  RapportClassementProduits,
  RapportSessions,
  RapportVentesParCaissier,
  RapportVentesParHeure,
  RequeteClassementProduits,
  SessionHistorique,
  VentesCaissier,
  VentesHeure
} from '@shared/ipc/rapports-ventes'
import type { Db } from '../../db/connexion'
import { toutes } from '../../db/requetes'
import { dansPeriode, lirePeriode } from '../rapports-gestion/periode'

const moyenne = (total: number, n: number): number => (n > 0 ? Math.round(total / n) : 0)

/** Tranches d'une heure (heure locale) : tickets terminés seulement, un retour n'est pas une vente. */
export function ventesParHeure(db: Db, periode?: PeriodeRapport | null): RapportVentesParHeure {
  const { du, au } = lirePeriode(db, periode)
  const lignes = toutes<{ heure: number; nbTickets: number; chiffreAffaires: number }>(
    db,
    `SELECT CAST(strftime('%H', horodatage) AS INTEGER) AS heure,
            COUNT(*) AS nbTickets, COALESCE(SUM(total_ttc), 0) AS chiffreAffaires
       FROM ventes
      WHERE statut = 'terminee' AND type = 'ticket' AND ${dansPeriode('horodatage')}
      GROUP BY heure ORDER BY heure`,
    du,
    au
  ).map((l): VentesHeure => ({ ...l, panierMoyen: moyenne(l.chiffreAffaires, l.nbTickets) }))
  return {
    du,
    au,
    lignes,
    nbTickets: lignes.reduce((n, l) => n + l.nbTickets, 0),
    chiffreAffaires: lignes.reduce((n, l) => n + l.chiffreAffaires, 0)
  }
}

/** Une ligne par personne ayant vendu, repris ou annulé dans la période, le plus gros chiffre d'abord. */
export function ventesParCaissier(db: Db, periode?: PeriodeRapport | null): RapportVentesParCaissier {
  const { du, au } = lirePeriode(db, periode)
  const base = toutes<{
    utilisateurId: number
    caissier: string
    nbTickets: number
    ventesTtc: number
    retoursTtc: number
    nbAnnules: number
    montantAnnules: number
  }>(
    db,
    `SELECT v.utilisateur_id AS utilisateurId, u.nom AS caissier,
            COALESCE(SUM(v.statut = 'terminee' AND v.type = 'ticket'), 0) AS nbTickets,
            COALESCE(SUM(CASE WHEN v.statut = 'terminee' AND v.type = 'ticket' THEN v.total_ttc END), 0) AS ventesTtc,
            COALESCE(SUM(CASE WHEN v.statut = 'terminee' AND v.type = 'retour' THEN v.total_ttc END), 0) AS retoursTtc,
            COALESCE(SUM(v.statut = 'annulee' AND v.type = 'ticket'), 0) AS nbAnnules,
            COALESCE(SUM(CASE WHEN v.statut = 'annulee' AND v.type = 'ticket' THEN v.total_ttc END), 0) AS montantAnnules
       FROM ventes v
       JOIN utilisateurs u ON u.id = v.utilisateur_id
      WHERE v.type IN ('ticket', 'retour') AND ${dansPeriode('v.horodatage')}
      GROUP BY v.utilisateur_id`,
    du,
    au
  )
  // Remises des tickets terminés : celle du ticket entier plus celles de ses lignes.
  const remises = new Map<number, number>()
  const ajouter = (r: { utilisateurId: number; montant: number }): void => {
    remises.set(r.utilisateurId, (remises.get(r.utilisateurId) ?? 0) + r.montant)
  }
  toutes<{ utilisateurId: number; montant: number }>(
    db,
    `SELECT utilisateur_id AS utilisateurId, COALESCE(SUM(remise_globale), 0) AS montant
       FROM ventes
      WHERE statut = 'terminee' AND type = 'ticket' AND ${dansPeriode('horodatage')}
      GROUP BY utilisateur_id`,
    du,
    au
  ).forEach(ajouter)
  toutes<{ utilisateurId: number; montant: number }>(
    db,
    `SELECT v.utilisateur_id AS utilisateurId, COALESCE(SUM(l.remise_ligne), 0) AS montant
       FROM lignes_vente l JOIN ventes v ON v.id = l.vente_id
      WHERE v.statut = 'terminee' AND v.type = 'ticket' AND ${dansPeriode('v.horodatage')}
      GROUP BY v.utilisateur_id`,
    du,
    au
  ).forEach(ajouter)

  const lignes = base
    .map((b): VentesCaissier => ({
      ...b,
      chiffreAffaires: b.ventesTtc + b.retoursTtc,
      panierMoyen: moyenne(b.ventesTtc, b.nbTickets),
      remises: remises.get(b.utilisateurId) ?? 0
    }))
    .sort((a, b) => b.chiffreAffaires - a.chiffreAffaires || a.caissier.localeCompare(b.caissier, 'fr'))
  return { du, au, lignes }
}

const VALEUR: Record<CritereClassement, (p: ProduitClasse) => number> = {
  chiffreAffaires: (p) => p.chiffreAffaires,
  marge: (p) => p.marge,
  quantite: (p) => p.quantiteBase
}

/**
 * Top et flop par produit, tous conditionnements confondus (quantités en unités de base), retours
 * déduits. Seuls les produits qui ont au moins une vente dans la période sont classés : les produits
 * qui ne se vendent plus sont l'affaire du rapport de stock dormant (Dev B).
 * Le chiffre d'affaires est celui des lignes : la remise sur le ticket entier n'est pas répartie par
 * produit, la somme des produits peut donc dépasser le chiffre d'affaires de `ventesPeriode`.
 */
export function classementProduits(
  db: Db,
  requete?: RequeteClassementProduits | null
): RapportClassementProduits {
  const { du, au } = lirePeriode(db, requete)
  const critere = requete?.critere ?? 'chiffreAffaires'
  const limite = Math.min(100, Math.max(1, Math.trunc(requete?.limite ?? 10)))
  const produits = toutes<{
    produitId: number
    produit: string
    quantiteBase: number
    chiffreAffaires: number
    cout: number
  }>(
    db,
    `SELECT l.produit_id AS produitId, p.nom AS produit,
            SUM(CASE WHEN v.type = 'retour' THEN -l.quantite_base_totale ELSE l.quantite_base_totale END) AS quantiteBase,
            SUM(l.total_ligne) AS chiffreAffaires,
            SUM(CASE WHEN v.type = 'retour' THEN -1 ELSE 1 END * l.quantite * l.cout_unitaire) AS cout
       FROM lignes_vente l
       JOIN ventes v ON v.id = l.vente_id
       JOIN produits p ON p.id = l.produit_id
      WHERE v.statut = 'terminee' AND v.type IN ('ticket', 'retour') AND ${dansPeriode('v.horodatage')}
      GROUP BY l.produit_id
     HAVING SUM(v.type = 'ticket') > 0`,
    du,
    au
  ).map((r): ProduitClasse => ({
    produitId: r.produitId,
    produit: r.produit,
    quantiteBase: r.quantiteBase,
    chiffreAffaires: r.chiffreAffaires,
    marge: r.chiffreAffaires - Math.round(r.cout)
  }))
  const valeur = VALEUR[critere]
  const parNom = (a: ProduitClasse, b: ProduitClasse): number => a.produit.localeCompare(b.produit, 'fr')
  const top = [...produits].sort((a, b) => valeur(b) - valeur(a) || parNom(a, b)).slice(0, limite)
  const flop = [...produits].sort((a, b) => valeur(a) - valeur(b) || parNom(a, b)).slice(0, limite)
  return { du, au, critere, top, flop, nbProduits: produits.length }
}

/** Sessions ouvertes dans la période, avec l'écart figé à la clôture ; une session en cours n'en a pas. */
export function historiqueSessions(db: Db, periode?: PeriodeRapport | null): RapportSessions {
  const { du, au } = lirePeriode(db, periode)
  const lignes = toutes<SessionHistorique>(
    db,
    `SELECT s.id, u.nom AS caissier, s.date_ouverture AS dateOuverture, s.date_fermeture AS dateFermeture,
            s.fond_ouverture AS fondOuverture, s.montant_theorique AS montantTheorique,
            s.montant_compte AS montantCompte, s.ecart, s.commentaire
       FROM sessions_caisse s JOIN utilisateurs u ON u.id = s.utilisateur_id
      WHERE ${dansPeriode('s.date_ouverture')}
      ORDER BY s.id DESC`,
    du,
    au
  )
  const cloturees = lignes.filter((l) => l.dateFermeture !== null)
  return {
    du,
    au,
    lignes,
    totalEcarts: cloturees.reduce((n, l) => n + (l.ecart ?? 0), 0),
    nbCloturees: cloturees.length
  }
}
