/**
 * Rapport des pertes par cause (B14). Propriétaire : Dev B.
 * Règles (REGLES_METIER § 11, précisées par Dev B le 2026-10-09) : péremption, casse, dons (casse au
 * libellé « Don »), vol, démarque d'inventaire (écarts négatifs), chacun à son `cout_unitaire` ;
 * avoirs fournisseur refusés ou reçus en dessous de l'attendu. Une sortie annulée ne compte pas ; le
 * stock initial non plus. Les surplus d'inventaire sont rendus à part.
 */
import type { CausePerte, PerteProduit, PeriodeRapport, RapportPertes } from '@shared/ipc/rapports-gestion'
import { CAUSES_PERTE, manqueAvoir } from '@shared/rapports-gestion'
import { MOTIFS_SORTIE } from '@shared/stock'
import type { Db } from '../../db/connexion'
import { toutes } from '../../db/requetes'
import { DOCUMENT_INVENTAIRE } from '../inventaires/service'
import { dansPeriode, lirePeriode } from './periode'

interface MouvementLu {
  produitId: number
  produit: string
  unite: string
  type: string
  motif: string | null
  documentType: string | null
  quantite: number
  coutUnitaire: number
}

interface AvoirLu {
  produitId: number
  produit: string
  unite: string
  statut: 'recu' | 'refuse'
  attendu: number
  recu: number | null
}

// Un mouvement contre-passé (sortie annulée) n'a jamais eu lieu : on l'écarte avec son inverse.
const SQL_MOUVEMENTS = `
  SELECT m.produit_id AS produitId, p.nom AS produit, p.unite, m.type, m.motif,
         m.document_type AS documentType, m.quantite, m.cout_unitaire AS coutUnitaire
  FROM mouvements_stock m
  JOIN produits p ON p.id = m.produit_id
  WHERE ${dansPeriode('m.horodatage')}
    AND (m.type IN ('casse', 'vol', 'perte_peremption')
         OR (m.type = 'ajustement_inventaire' AND m.document_type = '${DOCUMENT_INVENTAIRE}'))
    AND NOT EXISTS (SELECT 1 FROM mouvements_stock c WHERE c.mouvement_origine_id = m.id)`

// Avoir reçu : daté du jour de l'avoir ; refusé : du jour du refus.
const SQL_AVOIRS = `
  SELECT a.produit_id AS produitId, p.nom AS produit, p.unite, a.statut,
         a.montant_attendu AS attendu, a.montant_recu AS recu
  FROM retours_fournisseur a
  JOIN produits p ON p.id = a.produit_id
  WHERE (a.statut = 'recu' AND ${dansPeriode('a.date_avoir')})
     OR (a.statut = 'refuse' AND ${dansPeriode('a.clos_le')})`

const LIBELLE_DON = MOTIFS_SORTIE.don.libelle

/** Le libellé d'une sortie est « Don » ou « Don : <commentaire> ». */
function estUnDon(motif: string | null): boolean {
  return motif === LIBELLE_DON || (motif?.startsWith(`${LIBELLE_DON} :`) ?? false)
}

function causeDe(m: MouvementLu): CausePerte | null {
  if (m.type === 'perte_peremption') return 'peremption'
  if (m.type === 'vol') return 'vol'
  if (m.type === 'casse') return estUnDon(m.motif) ? 'don' : 'casse'
  return m.quantite < 0 ? 'demarque_inventaire' : null
}

export function rapportPertes(db: Db, periode?: PeriodeRapport | null): RapportPertes {
  const { du, au } = lirePeriode(db, periode)

  // Valeur brute cumulée par cause et par produit, arrondie au franc une seule fois à la fin : un
  // manquant d'inventaire réparti sur plusieurs lots ne doit pas gagner ou perdre un franc.
  const parProduit = new Map<string, Omit<PerteProduit, 'valeur'> & { brut: number }>()
  const ajouter = (
    cause: CausePerte,
    l: { produitId: number; produit: string; unite: string },
    q: number | null,
    brut: number
  ) => {
    const cle = `${cause}:${l.produitId}`
    const p = parProduit.get(cle) ?? {
      cause,
      produitId: l.produitId,
      produit: l.produit,
      unite: l.unite,
      quantite: q === null ? null : 0,
      brut: 0
    }
    if (q !== null) p.quantite = (p.quantite ?? 0) + q
    p.brut += brut
    parProduit.set(cle, p)
  }

  let surplusBrut = 0
  for (const m of toutes<MouvementLu>(db, SQL_MOUVEMENTS, du, au)) {
    const cause = causeDe(m)
    if (cause === null) surplusBrut += m.quantite * m.coutUnitaire
    else ajouter(cause, m, -m.quantite, -m.quantite * m.coutUnitaire)
  }
  for (const a of toutes<AvoirLu>(db, SQL_AVOIRS, du, au, du, au)) {
    const manque = manqueAvoir(a.statut, a.attendu, a.recu)
    if (manque > 0) ajouter('avoir_fournisseur', a, null, manque)
  }

  const produits: PerteProduit[] = [...parProduit.values()]
    .map(({ brut, ...p }) => ({ ...p, valeur: Math.round(brut) }))
    .filter((p) => p.valeur !== 0 || (p.quantite ?? 0) !== 0)
  const ordre = Object.keys(CAUSES_PERTE) as CausePerte[]
  produits.sort(
    (a, b) =>
      ordre.indexOf(a.cause) - ordre.indexOf(b.cause) ||
      b.valeur - a.valeur ||
      a.produit.localeCompare(b.produit, 'fr')
  )
  const causes = ordre.map((cause) => ({
    cause,
    libelle: CAUSES_PERTE[cause],
    valeur: produits.filter((p) => p.cause === cause).reduce((s, p) => s + p.valeur, 0)
  }))

  return {
    du,
    au,
    causes,
    produits,
    total: causes.reduce((s, c) => s + c.valeur, 0),
    surplusInventaire: Math.round(surplusBrut)
  }
}
