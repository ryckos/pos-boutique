/**
 * Historique des achats d'un fournisseur (tâche B7, partie 2). Propriétaire : Dev B.
 * Règles (REGLES_METIER § 4.6) : livraisons sur une période, 90 derniers jours par défaut ; derniers
 * prix d'achat sur toute l'histoire, comparés au prix de la réception précédente chez CE fournisseur.
 */
import type { AchatsFournisseur, PrixAchatFournisseur } from '@shared/ipc/fournisseurs'
import type { ResumeReception } from '@shared/ipc/achats'
import type { Db } from '../../db/connexion'
import { toutes, une } from '../../db/requetes'
import { ErreurMetier } from '../../core/erreurs'

export const JOURS_ACHATS_PAR_DEFAUT = 90

const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/

function lireDate(valeur: string | null | undefined, nom: string): string | null {
  const v = valeur?.trim()
  if (!v) return null
  if (!FORMAT_DATE.test(v) || Number.isNaN(Date.parse(v))) {
    throw new ErreurMetier(`La date de ${nom} est invalide : choisissez-la dans le calendrier`)
  }
  return v
}

interface LigneAchat {
  cle: string
  receptionId: number
  dateReception: string
  produitId: number
  produit: string
  conditionnement: string
  quantiteBase: number
  prix: number
}

export function achatsFournisseur(
  db: Db,
  fournisseurId: number,
  periode: { du?: string | null; au?: string | null } = {}
): AchatsFournisseur {
  const f = une<{ nom: string }>(db, 'SELECT nom FROM fournisseurs WHERE id = ?', fournisseurId)
  if (!f) throw new ErreurMetier('Fournisseur introuvable : rechargez la liste')

  const aujourdhui = une<{ d: string }>(db, "SELECT date('now','localtime') AS d")!.d
  const au = lireDate(periode.au, 'fin') ?? aujourdhui
  const du =
    lireDate(periode.du, 'début') ??
    une<{ d: string }>(db, 'SELECT date(?, ?) AS d', au, `-${JOURS_ACHATS_PAR_DEFAUT} days`)!.d
  if (du > au) throw new ErreurMetier('La date de début doit précéder la date de fin')

  const receptions = toutes<ResumeReception>(
    db,
    `SELECT r.id, r.numero, f.nom AS fournisseur, r.date_reception AS dateReception,
            r.date_echeance AS dateEcheance, r.total, u.nom AS utilisateur,
            (SELECT COUNT(*) FROM lignes_reception l WHERE l.reception_id = r.id) AS nbLignes
     FROM receptions r
     JOIN fournisseurs f ON f.id = r.fournisseur_id
     JOIN utilisateurs u ON u.id = r.utilisateur_id
     WHERE r.fournisseur_id = ? AND r.date_reception >= ? AND r.date_reception < date(?, '+1 day')
     ORDER BY r.id DESC`,
    fournisseurId,
    du,
    au
  )

  // Toutes les lignes achetées chez ce fournisseur, de la plus ancienne à la plus récente.
  const lignes = toutes<LigneAchat>(
    db,
    `SELECT COALESCE('c' || l.conditionnement_id, 'p' || l.produit_id) AS cle, r.id AS receptionId,
            r.date_reception AS dateReception, l.produit_id AS produitId, p.nom AS produit,
            COALESCE(c.nom, 'Unité') AS conditionnement, COALESCE(c.quantite_base, 1) AS quantiteBase,
            l.prix_achat_unitaire AS prix
     FROM lignes_reception l
     JOIN receptions r ON r.id = l.reception_id
     JOIN produits p ON p.id = l.produit_id
     LEFT JOIN conditionnements c ON c.id = l.conditionnement_id
     WHERE r.fournisseur_id = ?
     ORDER BY r.id, l.id`,
    fournisseurId
  )
  const parConditionnement = new Map<string, LigneAchat[]>()
  for (const l of lignes) parConditionnement.set(l.cle, [...(parConditionnement.get(l.cle) ?? []), l])

  const prix: PrixAchatFournisseur[] = [...parConditionnement.values()].map((achats) => {
    const dernier = achats[achats.length - 1]
    // Prix précédent : celui d'une réception antérieure (deux lots de la même livraison ne comptent pas).
    const precedent = [...achats].reverse().find((a) => a.receptionId !== dernier.receptionId)
    const ecart = precedent ? dernier.prix - precedent.prix : null
    return {
      produitId: dernier.produitId,
      produit: dernier.produit,
      conditionnement: dernier.conditionnement,
      quantiteBase: dernier.quantiteBase,
      dernierPrix: dernier.prix,
      dateDernierPrix: dernier.dateReception,
      prixPrecedent: precedent?.prix ?? null,
      ecart,
      ecartPourcent: precedent && ecart !== null ? Math.round((ecart / precedent.prix) * 1000) / 10 : null,
      coutBase: dernier.prix / dernier.quantiteBase,
      nbReceptions: new Set(achats.map((a) => a.receptionId)).size
    }
  })
  prix.sort((a, b) => a.produit.localeCompare(b.produit, 'fr') || a.quantiteBase - b.quantiteBase)

  return {
    fournisseurId,
    nom: f.nom,
    du,
    au,
    receptions,
    totalPeriode: receptions.reduce((t, r) => t + r.total, 0),
    prix
  }
}
