/**
 * Catégories de produits (rayons et sous-rayons). Propriétaire : Dev B.
 * Règles (REGLES_METIER § 2.5) : un seul niveau de sous-catégorie ; nom unique parmi les
 * catégories actives du même niveau ; jamais de suppression, désactivation d'une catégorie vide.
 */
import type { Categorie } from '@shared/ipc/catalogue'
import type { Db } from '../../db/connexion'
import { executer, toutes, une } from '../../db/requetes'
import { ErreurMetier } from '../../core/erreurs'

interface LigneCategorie {
  id: number
  nom: string
  parentId: number | null
  actif: number
}

function lire(db: Db, id: number): LigneCategorie {
  const c = une<LigneCategorie>(db, 'SELECT id, nom, parent_id AS parentId, actif FROM categories WHERE id = ?', id)
  if (!c) throw new ErreurMetier('Catégorie introuvable : rechargez la liste')
  return c
}

function exigerNom(nom: string): string {
  const n = nom.trim().replace(/\s+/g, ' ')
  if (!n) throw new ErreurMetier('Le nom de la catégorie est obligatoire')
  return n
}

/** Pas deux catégories actives de même nom au même niveau (casse et espaces ignorés). */
function exigerNomLibre(db: Db, nom: string, parentId: number | null, saufId?: number): void {
  const voisines = toutes<{ id: number; nom: string }>(
    db,
    'SELECT id, nom FROM categories WHERE actif = 1 AND parent_id IS ?',
    parentId
  )
  const cle = nom.toLocaleLowerCase('fr')
  if (voisines.some((v) => v.id !== saufId && v.nom.trim().toLocaleLowerCase('fr') === cle)) {
    throw new ErreurMetier(`La catégorie « ${nom} » existe déjà à cet endroit`)
  }
}

/** Rayons puis leurs sous-rayons, chacun par ordre alphabétique ; actives et désactivées. */
export function listerCategories(db: Db): Categorie[] {
  const lignes = toutes<LigneCategorie & { nbProduits: number }>(
    db,
    `SELECT c.id, c.nom, c.parent_id AS parentId, c.actif,
            (SELECT COUNT(*) FROM produits p WHERE p.categorie_id = c.id AND p.actif = 1) AS nbProduits
     FROM categories c`
  ).map((l) => ({ ...l, actif: l.actif === 1 }))
  const parNom = (a: { nom: string }, b: { nom: string }): number => a.nom.localeCompare(b.nom, 'fr')
  return lignes
    .filter((l) => l.parentId === null)
    .sort(parNom)
    .flatMap((rayon) => [rayon, ...lignes.filter((l) => l.parentId === rayon.id).sort(parNom)])
}

export function creerCategorie(db: Db, nom: string, parentId: number | null = null): number {
  const n = exigerNom(nom)
  if (parentId !== null) {
    const parent = lire(db, parentId)
    if (!parent.actif) throw new ErreurMetier(`Le rayon « ${parent.nom} » est désactivé`)
    if (parent.parentId !== null) {
      throw new ErreurMetier('Une sous-catégorie ne peut pas contenir d’autres catégories : choisissez un rayon')
    }
  }
  exigerNomLibre(db, n, parentId)
  return executer(db, 'INSERT INTO categories (nom, parent_id) VALUES (?, ?)', n, parentId).id
}

export function renommerCategorie(db: Db, id: number, nom: string): void {
  const n = exigerNom(nom)
  const c = lire(db, id)
  if (!c.actif) throw new ErreurMetier(`La catégorie « ${c.nom} » est désactivée`)
  exigerNomLibre(db, n, c.parentId, id)
  executer(db, 'UPDATE categories SET nom = ? WHERE id = ?', n, id)
}

/** Refusée tant que la catégorie contient des produits ou des sous-catégories actifs. */
export function desactiverCategorie(db: Db, id: number): void {
  const c = lire(db, id)
  if (!c.actif) throw new ErreurMetier(`La catégorie « ${c.nom} » est déjà désactivée`)
  const produits = une<{ n: number }>(
    db,
    'SELECT COUNT(*) AS n FROM produits WHERE categorie_id = ? AND actif = 1',
    id
  )!.n
  if (produits > 0) {
    throw new ErreurMetier(
      `« ${c.nom} » contient ${produits} produit${produits > 1 ? 's' : ''} : déplacez-les d’abord vers une autre catégorie`
    )
  }
  const sous = une<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM categories WHERE parent_id = ? AND actif = 1', id)!.n
  if (sous > 0) {
    throw new ErreurMetier(
      `« ${c.nom} » contient ${sous} sous-catégorie${sous > 1 ? 's' : ''} : désactivez-les d’abord`
    )
  }
  executer(db, 'UPDATE categories SET actif = 0 WHERE id = ?', id)
}
