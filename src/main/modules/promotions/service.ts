/**
 * Propriétaire : Dev A. Promotions programmées (A16, REGLES_METIER § 5.2).
 *
 * Une promotion est un prix de vente temporaire, calculé à chaque vente à partir de la date de
 * l'ordinateur : il n'y a rien à « lancer » ni à « terminer », seules les dates comptent. La vente
 * appelle `meilleurePromotion` ; l'écran de caisse ne fait que refléter `promotionsDuJour`.
 * Aucun contrôle de droit ici : `ipc.ts` exige le gérant pour la gestion.
 */
import type { UtilisateurConnecte } from '@shared/types'
import type { EtatPromotion, Promotion, PromotionEnCours, SaisiePromotion } from '@shared/ipc/promotions'
import {
  LIBELLES_TYPE_PROMOTION,
  libelleRegle,
  prixPromotionnel,
  type TypePromotion
} from '@shared/promotions'
import { formaterFCFA } from '@shared/format'
import type { Db } from '../../db/connexion'
import { avecTransaction, executer, toutes, une } from '../../db/requetes'
import { ErreurMetier } from '../../core/erreurs'
import { journaliser } from '../../core/audit'

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/
const TYPES = Object.keys(LIBELLES_TYPE_PROMOTION) as TypePromotion[]

const aujourdhui = (db: Db): string => une<{ j: string }>(db, "SELECT date('now','localtime') AS j")!.j

function dateValide(valeur: unknown): valeur is string {
  return (
    typeof valeur === 'string' &&
    DATE_ISO.test(valeur) &&
    new Date(`${valeur}T00:00:00Z`).toISOString().slice(0, 10) === valeur
  )
}

interface LignePromotion {
  id: number
  nom: string
  type: TypePromotion
  valeur: number
  produitId: number | null
  produit: string | null
  categorieId: number | null
  categorie: string | null
  dateDebut: string
  dateFin: string
  actif: number
}

const SELECT_PROMOTIONS = `
  SELECT pr.id, pr.nom, pr.type, pr.valeur, pr.produit_id AS produitId, p.nom AS produit,
         pr.categorie_id AS categorieId, c.nom AS categorie,
         pr.date_debut AS dateDebut, pr.date_fin AS dateFin, pr.actif
  FROM promotions pr
  LEFT JOIN produits p ON p.id = pr.produit_id
  LEFT JOIN categories c ON c.id = pr.categorie_id`

function etatDe(p: Pick<LignePromotion, 'actif' | 'dateDebut' | 'dateFin'>, jour: string): EtatPromotion {
  if (!p.actif) return 'arretee'
  if (p.dateFin < jour) return 'terminee'
  if (p.dateDebut > jour) return 'a_venir'
  return 'en_cours'
}

/** Toutes les promotions, les plus récentes d'abord, chacune avec son état d'aujourd'hui. */
export function listerPromotions(db: Db): Promotion[] {
  const jour = aujourdhui(db)
  return toutes<LignePromotion>(db, `${SELECT_PROMOTIONS} ORDER BY pr.date_debut DESC, pr.id DESC`).map(
    ({ actif, ...p }) => ({ ...p, etat: etatDe({ actif, ...p }, jour) })
  )
}

/** Les catégories d'un rayon : lui-même et tous ses sous-rayons. */
function categoriesDuRayon(db: Db, categorieId: number): number[] {
  return toutes<{ id: number }>(
    db,
    `WITH RECURSIVE r(id) AS (
       SELECT id FROM categories WHERE id = ?
       UNION
       SELECT c.id FROM categories c JOIN r ON c.parent_id = r.id
     ) SELECT id FROM r`,
    categorieId
  ).map((c) => c.id)
}

/** La catégorie d'un produit et tous ses rayons parents. */
function categoriesDuProduit(db: Db, produitId: number): number[] {
  return toutes<{ id: number }>(
    db,
    `WITH RECURSIVE r(id) AS (
       SELECT categorie_id FROM produits WHERE id = ? AND categorie_id IS NOT NULL
       UNION
       SELECT c.parent_id FROM categories c JOIN r ON c.id = r.id WHERE c.parent_id IS NOT NULL
     ) SELECT id FROM r`,
    produitId
  ).map((c) => c.id)
}

function promotionsValables(db: Db, jour: string): LignePromotion[] {
  return toutes<LignePromotion>(
    db,
    `${SELECT_PROMOTIONS} WHERE pr.actif = 1 AND pr.date_debut <= ? AND pr.date_fin >= ? ORDER BY pr.id`,
    jour,
    jour
  )
}

/** Promotions valables aujourd'hui, avec les produits qu'elles touchent (pour la caisse). */
export function promotionsDuJour(db: Db): PromotionEnCours[] {
  return promotionsValables(db, aujourdhui(db)).map((p) => {
    const produitIds =
      p.produitId !== null
        ? [p.produitId]
        : toutes<{ id: number }>(
            db,
            `SELECT id FROM produits WHERE actif = 1 AND categorie_id IN (${categoriesDuRayon(db, p.categorieId!).join(',')})`
          ).map((x) => x.id)
    return { id: p.id, nom: p.nom, type: p.type, valeur: p.valeur, produitIds }
  })
}

export interface PromotionAppliquee {
  id: number
  nom: string
  /** Prix du conditionnement avec la promotion, TTC, FCFA. */
  prix: number
}

/**
 * La promotion la plus avantageuse pour un conditionnement (le prix le plus bas) ; jamais de cumul.
 * À prix égal, la plus récente. null si aucune ne s'applique. Appelée par la vente, dans sa transaction.
 */
export function meilleurePromotion(
  db: Db,
  produitId: number,
  quantiteBase: number,
  prixNormal: number
): PromotionAppliquee | null {
  const valables = promotionsValables(db, aujourdhui(db))
  if (valables.length === 0) return null
  const rayons = new Set(categoriesDuProduit(db, produitId))
  let meilleure: PromotionAppliquee | null = null
  for (const p of valables) {
    const concerne = p.produitId === produitId || (p.categorieId !== null && rayons.has(p.categorieId))
    if (!concerne) continue
    const prix = prixPromotionnel(p, prixNormal, quantiteBase)
    if (prix !== null && (meilleure === null || prix <= meilleure.prix)) {
      meilleure = { id: p.id, nom: p.nom, prix }
    }
  }
  return meilleure
}

function controler(db: Db, s: SaisiePromotion, ancienne?: LignePromotion): SaisiePromotion {
  const nom = typeof s.nom === 'string' ? s.nom.trim() : ''
  if (!nom) throw new ErreurMetier('Donnez un nom à la promotion (par exemple « Yaourt −20 % »).')
  if (nom.length > 80) throw new ErreurMetier('Le nom de la promotion est trop long : 80 caractères au plus.')
  if (!TYPES.includes(s.type)) throw new ErreurMetier('Choisissez le type de promotion.')
  if (!Number.isInteger(s.valeur) || s.valeur < 1) {
    throw new ErreurMetier('La valeur de la promotion doit être un nombre entier positif, sans virgule.')
  }
  if (s.type === 'remise_pourcent' && s.valeur > 99) {
    throw new ErreurMetier('Un pourcentage de remise va de 1 à 99.')
  }
  const produitId = s.produitId ?? null
  const categorieId = s.categorieId ?? null
  if ((produitId === null) === (categorieId === null)) {
    throw new ErreurMetier('Choisissez un produit ou un rayon, pas les deux.')
  }
  if (produitId !== null && !une(db, 'SELECT 1 AS x FROM produits WHERE id = ? AND actif = 1', produitId)) {
    throw new ErreurMetier('Ce produit n’existe plus ou est désactivé : choisissez-en un autre.')
  }
  if (
    categorieId !== null &&
    !une(db, 'SELECT 1 AS x FROM categories WHERE id = ? AND actif = 1', categorieId)
  ) {
    throw new ErreurMetier('Ce rayon n’existe plus ou est désactivé : choisissez-en un autre.')
  }
  if (!dateValide(s.dateDebut) || !dateValide(s.dateFin)) {
    throw new ErreurMetier('Les dates de la promotion sont invalides : choisissez-les dans le calendrier.')
  }
  if (s.dateDebut > s.dateFin) throw new ErreurMetier('Le début de la promotion doit précéder sa fin.')
  const jour = aujourdhui(db)
  if (s.dateFin < jour) throw new ErreurMetier('La fin de la promotion ne peut pas être déjà passée.')
  // Le début peut rester dans le passé quand on modifie une promotion déjà commencée, pas être reculé.
  if (s.dateDebut < jour && s.dateDebut !== ancienne?.dateDebut) {
    throw new ErreurMetier('Le début de la promotion ne peut pas être dans le passé : commencez aujourd’hui.')
  }
  return { ...s, nom, produitId, categorieId }
}

function descriptionPour(db: Db, s: SaisiePromotion): Record<string, string> {
  const cible =
    s.produitId != null
      ? `Produit : ${une<{ nom: string }>(db, 'SELECT nom FROM produits WHERE id = ?', s.produitId)!.nom}`
      : `Rayon : ${une<{ nom: string }>(db, 'SELECT nom FROM categories WHERE id = ?', s.categorieId!)!.nom}`
  return {
    nom: s.nom,
    regle: libelleRegle(s, formaterFCFA),
    cible,
    du: s.dateDebut,
    au: s.dateFin
  }
}

export function creerPromotion(db: Db, u: UtilisateurConnecte, saisie: SaisiePromotion): { id: number } {
  const s = controler(db, saisie)
  return avecTransaction(db, () => {
    const { id } = executer(
      db,
      `INSERT INTO promotions (nom, type, valeur, produit_id, categorie_id, date_debut, date_fin)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      s.nom,
      s.type,
      s.valeur,
      s.produitId ?? null,
      s.categorieId ?? null,
      s.dateDebut,
      s.dateFin
    )
    journaliser(db, {
      utilisateurId: u.id,
      action: 'creation_promotion',
      entite: 'promotion',
      entiteId: id,
      apres: descriptionPour(db, s)
    })
    return { id }
  })
}

function lirePromotion(db: Db, id: number): LignePromotion {
  const p = une<LignePromotion>(db, `${SELECT_PROMOTIONS} WHERE pr.id = ?`, id)
  if (!p) throw new ErreurMetier('Cette promotion n’existe pas.')
  return p
}

export function modifierPromotion(db: Db, u: UtilisateurConnecte, id: number, saisie: SaisiePromotion): void {
  const avant = lirePromotion(db, id)
  const etat = etatDe(avant, aujourdhui(db))
  if (etat === 'terminee' || etat === 'arretee') {
    throw new ErreurMetier(
      `Cette promotion est ${etat === 'arretee' ? 'arrêtée' : 'terminée'} : créez-en une nouvelle plutôt que de la modifier.`
    )
  }
  const s = controler(db, saisie, avant)
  avecTransaction(db, () => {
    const ancienne = descriptionPour(db, {
      nom: avant.nom,
      type: avant.type,
      valeur: avant.valeur,
      produitId: avant.produitId,
      categorieId: avant.categorieId,
      dateDebut: avant.dateDebut,
      dateFin: avant.dateFin
    })
    executer(
      db,
      `UPDATE promotions SET nom = ?, type = ?, valeur = ?, produit_id = ?, categorie_id = ?,
                             date_debut = ?, date_fin = ? WHERE id = ?`,
      s.nom,
      s.type,
      s.valeur,
      s.produitId ?? null,
      s.categorieId ?? null,
      s.dateDebut,
      s.dateFin,
      id
    )
    journaliser(db, {
      utilisateurId: u.id,
      action: 'modification_promotion',
      entite: 'promotion',
      entiteId: id,
      avant: ancienne,
      apres: descriptionPour(db, s)
    })
  })
}

/** La promotion cesse tout de suite (actif = 0) ; les tickets déjà faits gardent son nom. */
export function arreterPromotion(db: Db, u: UtilisateurConnecte, id: number): void {
  const p = lirePromotion(db, id)
  const etat = etatDe(p, aujourdhui(db))
  if (etat === 'arretee') throw new ErreurMetier('Cette promotion est déjà arrêtée.')
  if (etat === 'terminee')
    throw new ErreurMetier('Cette promotion est déjà terminée : il n’y a rien à arrêter.')
  avecTransaction(db, () => {
    executer(db, 'UPDATE promotions SET actif = 0 WHERE id = ?', id)
    journaliser(db, {
      utilisateurId: u.id,
      action: 'arret_promotion',
      entite: 'promotion',
      entiteId: id,
      avant: { nom: p.nom, du: p.dateDebut, au: p.dateFin }
    })
  })
}
