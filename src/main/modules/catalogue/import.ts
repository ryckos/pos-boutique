/**
 * Import du catalogue depuis un fichier Excel (tâche B3). Propriétaire : Dev B.
 * Règles (REGLES_METIER § 2.6) : vérification d'abord (rien n'est écrit), puis import tout ou
 * rien ; une ligne dont le code est déjà en base est ignorée, une ligne en erreur bloque tout ;
 * rayon inconnu créé ; ligne sans code-barres = produit sans code ; prix d'achat gardé à titre
 * indicatif (jamais dans le CUMP).
 */
import * as XLSX from 'xlsx'
import { FORMAT_CODE_BARRES } from '@shared/catalogue'
import type { LigneRapportImport, RapportImport } from '@shared/ipc/catalogue'
import { normaliserRecherche } from '@shared/texte'
import type { Db } from '../../db/connexion'
import { avecTransaction, executer, toutes, une } from '../../db/requetes'
import { ErreurMetier } from '../../core/erreurs'
import { journaliser } from '../../core/audit'
import { lireParametres } from '../parametres/service'
import { creerCategorie } from './categories'
import { creerProduit } from './produits'

/** Au-delà, ce n'est plus le catalogue d'une boutique : on refuse avant d'occuper les 4 Go. */
export const TAILLE_MAX_OCTETS = 5 * 1024 * 1024
export const LIGNES_MAX = 5000

type Colonne = 'nom' | 'categorie' | 'codeBarres' | 'prixVente' | 'prixAchat' | 'tva' | 'seuil'

/** Titres du modèle, dans l'ordre. `*` = obligatoire. */
const TITRES: Record<Colonne, string> = {
  nom: 'Nom *',
  categorie: 'Catégorie',
  codeBarres: 'Code-barres',
  prixVente: 'Prix de vente *',
  prixAchat: "Prix d'achat",
  tva: 'TVA',
  seuil: "Seuil d'alerte"
}

/** Titres acceptés, après `cle()` : ceux du modèle et les variantes probables d'un fichier existant. */
const SYNONYMES: Record<Colonne, string[]> = {
  nom: ['nom', 'produit', 'designation', 'libelle', 'article'],
  categorie: ['categorie', 'rayon', 'famille'],
  codeBarres: [
    'code-barres',
    'code barres',
    'code barre',
    'code-barre',
    'codebarre',
    'codebarres',
    'code',
    'ean'
  ],
  prixVente: ['prix de vente', 'prix vente', 'pv', 'prix'],
  prixAchat: ["prix d'achat", 'prix achat', 'pa', 'cout', "cout d'achat"],
  tva: ['tva', 'taux tva', 'taux de tva'],
  seuil: ["seuil d'alerte", 'seuil', 'seuil alerte', 'stock minimum', 'stock mini']
}

/** Titre de colonne comparable : sans accents, casse, astérisque ni espaces superflus. */
const cle = (v: string): string =>
  normaliserRecherche(v)
    .replace(/[*’]/g, (c) => (c === '’' ? "'" : ''))
    .trim()
    .replace(/\s+/g, ' ')

const INDEX_SYNONYMES = new Map<string, Colonne>(
  (Object.keys(SYNONYMES) as Colonne[]).flatMap((col) =>
    SYNONYMES[col].map((s) => [s, col] as [string, Colonne])
  )
)

type Cellule = string | number | boolean | Date | null

/** Une ligne de données du fichier, telle que lue. */
export interface LigneFichier {
  ligne: number
  valeurs: Partial<Record<Colonne, Cellule>>
}

// ─── Lecture du fichier ───────────────────────────────────────────────────────

/**
 * Lit la première feuille : la première ligne non vide donne les titres, les suivantes les
 * produits. Les colonnes inconnues sont ignorées, les lignes entièrement vides sautées.
 */
export function lireFichier(contenu: Uint8Array): LigneFichier[] {
  if (contenu.byteLength > TAILLE_MAX_OCTETS) {
    throw new ErreurMetier('Ce fichier dépasse 5 Mo : gardez seulement la feuille des produits')
  }
  let classeur: XLSX.WorkBook
  try {
    // Pas de formules ni de HTML : on ne lit que les valeurs affichées.
    classeur = XLSX.read(contenu, { type: 'array', cellFormula: false, cellHTML: false, dense: true })
  } catch {
    throw new ErreurMetier('Ce fichier ne se lit pas comme un classeur Excel : enregistrez-le en .xlsx')
  }
  const feuille = classeur.Sheets[classeur.SheetNames[0] ?? '']
  if (!feuille) throw new ErreurMetier('Ce classeur ne contient aucune feuille')
  const lignes = XLSX.utils.sheet_to_json<Cellule[]>(feuille, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true
  })

  const vide = (c: Cellule): boolean => c === null || (typeof c === 'string' && c.trim() === '')
  const iTitres = lignes.findIndex((l) => l.some((c) => !vide(c)))
  if (iTitres < 0) throw new ErreurMetier('Ce fichier est vide')

  const colonnes = new Map<number, Colonne>()
  lignes[iTitres].forEach((titre, i) => {
    const col = typeof titre === 'string' ? INDEX_SYNONYMES.get(cle(titre)) : undefined
    if (col && ![...colonnes.values()].includes(col)) colonnes.set(i, col)
  })
  const manquantes = (['nom', 'prixVente'] as Colonne[]).filter((c) => ![...colonnes.values()].includes(c))
  if (manquantes.length > 0) {
    throw new ErreurMetier(
      `Colonne ${manquantes.map((c) => `« ${TITRES[c].replace(' *', '')} »`).join(' et ')} introuvable : ` +
        'partez du modèle à télécharger'
    )
  }

  const donnees: LigneFichier[] = []
  for (let i = iTitres + 1; i < lignes.length; i++) {
    const brute = lignes[i]
    if (!brute.some((c) => !vide(c))) continue
    const valeurs: LigneFichier['valeurs'] = {}
    for (const [index, col] of colonnes) valeurs[col] = vide(brute[index] ?? null) ? null : brute[index]
    // Numéro de ligne tel qu'Excel l'affiche (la première ligne vaut 1).
    donnees.push({ ligne: i + 1, valeurs })
  }
  if (donnees.length === 0)
    throw new ErreurMetier('Ce fichier ne contient aucun produit sous la ligne des titres')
  if (donnees.length > LIGNES_MAX) {
    throw new ErreurMetier(
      `Ce fichier contient plus de ${LIGNES_MAX} produits : découpez-le en plusieurs fichiers`
    )
  }
  return donnees
}

// ─── Contrôle des valeurs ─────────────────────────────────────────────────────

/** Espaces, insécables et fines comprises (`\s` les couvre) : « 1 500 » s'écrit souvent ainsi dans Excel. */
const sansEspaces = (v: string): string => v.replace(/\s/g, '')

function texteDe(c: Cellule | undefined): string {
  if (c === null || c === undefined) return ''
  if (c instanceof Date) return ''
  return String(c).trim().replace(/\s+/g, ' ')
}

/** Montant en francs entiers, ou null si la case est vide. Lève un message si illisible. */
function montant(c: Cellule | undefined, quoi: string): number | null {
  if (c === null || c === undefined) return null
  const n = typeof c === 'number' ? c : typeof c === 'string' ? Number(sansEspaces(c)) : NaN
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    throw new ErreurMetier(`${quoi} : un montant en francs, sans virgule`)
  }
  return n
}

/** 18 ou 0. Une case au format pourcentage d'Excel contient 0,18 pour « 18 % ». */
function tva(c: Cellule | undefined, defaut: number): number {
  if (c === null || c === undefined) return defaut
  const n = typeof c === 'number' ? c : typeof c === 'string' ? Number(sansEspaces(c).replace('%', '')) : NaN
  if (n === 18 || n === 0.18) return 18
  if (n === 0) return 0
  throw new ErreurMetier('TVA : 18 ou 0 (exonéré)')
}

function seuil(c: Cellule | undefined): number {
  if (c === null || c === undefined) return 0
  const n = typeof c === 'number' ? c : typeof c === 'string' ? Number(sansEspaces(c).replace(',', '.')) : NaN
  if (!Number.isFinite(n) || n < 0) throw new ErreurMetier("Seuil d'alerte : un nombre positif ou zéro")
  return n
}

/**
 * Code-barres : 8 à 14 chiffres. Un code saisi comme nombre perd ses zéros de tête dans Excel :
 * le modèle met cette colonne au format Texte.
 */
function codeBarres(c: Cellule | undefined): string | null {
  if (c === null || c === undefined) return null
  const v = typeof c === 'number' ? (Number.isInteger(c) ? String(c) : '') : sansEspaces(texteDe(c))
  if (!FORMAT_CODE_BARRES.test(v)) throw new ErreurMetier('Code-barres : de 8 à 14 chiffres, sans lettre')
  return v
}

/** « Épicerie / Conserves » → rayon puis sous-rayon ; « › » et « > » acceptés aussi. */
function chemin(c: Cellule | undefined): string[] {
  const v = texteDe(c)
  if (!v) return []
  const parties = v.split(/[/›>]/).map((p) => p.trim())
  if (parties.some((p) => p === '')) throw new ErreurMetier('Catégorie : « Rayon » ou « Rayon / Sous-rayon »')
  if (parties.length > 2)
    throw new ErreurMetier('Catégorie : un seul niveau de sous-rayon (« Rayon / Sous-rayon »)')
  return parties
}

// ─── Analyse ──────────────────────────────────────────────────────────────────

interface ProduitAImporter {
  ligne: number
  nom: string
  categorie: string[]
  codeBarres: string | null
  prixVente: number
  prixAchat: number | null
  tauxTva: number
  seuilAlerte: number
}

interface Analyse {
  rapport: LigneRapportImport[]
  aCreer: ProduitAImporter[]
  nouvellesCategories: string[][]
}

/** Catégories actives : clé normalisée du chemin → id. */
function categoriesExistantes(db: Db): Map<string, number> {
  const lignes = toutes<{ id: number; nom: string; parentNom: string | null }>(
    db,
    `SELECT c.id, c.nom, p.nom AS parentNom
     FROM categories c LEFT JOIN categories p ON p.id = c.parent_id
     WHERE c.actif = 1 AND (p.id IS NULL OR p.actif = 1)`
  )
  return new Map(lignes.map((l) => [cleChemin(l.parentNom ? [l.parentNom, l.nom] : [l.nom]), l.id]))
}

const cleChemin = (parties: string[]): string => parties.map(cle).join('/')

/** Qui porte déjà ce code, en code-barres ou en PLU, conditionnements désactivés compris. */
function porteurDuCode(db: Db, code: string): string | undefined {
  return une<{ designation: string }>(
    db,
    `SELECT p.nom || ' — ' || c.nom AS designation
     FROM conditionnements c JOIN produits p ON p.id = c.produit_id
     WHERE c.code_barres = ? OR c.code_plu = ? LIMIT 1`,
    code,
    code
  )?.designation
}

export function analyserFichier(db: Db, lignes: LigneFichier[]): Analyse {
  const { tvaDefaut } = lireParametres(db)
  const categories = categoriesExistantes(db)
  const nomsSansCode = new Set(
    toutes<{ nom: string }>(
      db,
      `SELECT p.nom FROM produits p WHERE p.actif = 1 AND NOT EXISTS (
         SELECT 1 FROM conditionnements c WHERE c.produit_id = p.id AND c.code_barres IS NOT NULL)`
    ).map((p) => cle(p.nom))
  )

  const rapport: LigneRapportImport[] = []
  const valides: ProduitAImporter[] = []
  for (const { ligne, valeurs: v } of lignes) {
    const nom = texteDe(v.nom)
    const problemes: string[] = []
    const lire = <T>(fn: () => T, defaut: T): T => {
      try {
        return fn()
      } catch (e) {
        if (!(e instanceof ErreurMetier)) throw e
        problemes.push(e.message)
        return defaut
      }
    }
    if (!nom) problemes.push('Nom manquant')
    const prixVente = lire(() => montant(v.prixVente, 'Prix de vente'), null)
    if (prixVente === null && !problemes.some((p) => p.startsWith('Prix de vente'))) {
      problemes.push('Prix de vente manquant')
    }
    const produit: ProduitAImporter = {
      ligne,
      nom,
      categorie: lire(() => chemin(v.categorie), []),
      codeBarres: lire(() => codeBarres(v.codeBarres), null),
      prixVente: prixVente ?? 0,
      prixAchat: lire(() => montant(v.prixAchat, "Prix d'achat"), null),
      tauxTva: lire(() => tva(v.tva, tvaDefaut), tvaDefaut),
      seuilAlerte: lire(() => seuil(v.seuil), 0)
    }
    if (problemes.length > 0) {
      rapport.push({ ligne, nom, etat: 'erreur', motif: problemes.join(' ; ') })
      continue
    }
    const porteur = produit.codeBarres ? porteurDuCode(db, produit.codeBarres) : undefined
    if (porteur !== undefined) {
      rapport.push({ ligne, nom, etat: 'ignoree', motif: `Code déjà au catalogue (« ${porteur} »)` })
    } else if (!produit.codeBarres && nomsSansCode.has(cle(nom))) {
      rapport.push({ ligne, nom, etat: 'ignoree', motif: 'Produit sans code déjà au catalogue sous ce nom' })
    } else {
      rapport.push({ ligne, nom, etat: 'a_creer', motif: null })
      valides.push(produit)
    }
  }

  // Doublons à l'intérieur du fichier : on ne choisit pas à la place de la cliente, les deux
  // lignes passent en erreur.
  const repeter = (
    cleDe: (p: ProduitAImporter) => string | null,
    motif: (p: ProduitAImporter) => string
  ): void => {
    const groupes = new Map<string, ProduitAImporter[]>()
    for (const p of valides) {
      const k = cleDe(p)
      if (k !== null) groupes.set(k, [...(groupes.get(k) ?? []), p])
    }
    for (const groupe of groupes.values()) {
      if (groupe.length < 2) continue
      for (const p of groupe) {
        const autres = groupe
          .filter((a) => a !== p)
          .map((a) => a.ligne)
          .join(', ')
        const r = rapport.find((l) => l.ligne === p.ligne)!
        r.etat = 'erreur'
        r.motif = `${motif(p)} (aussi ligne ${autres})`
      }
    }
  }
  repeter(
    (p) => p.codeBarres,
    (p) => `Code ${p.codeBarres} présent deux fois dans le fichier`
  )
  repeter(
    (p) => (p.codeBarres ? null : cle(p.nom)),
    () => 'Produit sans code présent deux fois dans le fichier'
  )

  const aCreer = valides.filter((p) => rapport.find((l) => l.ligne === p.ligne)!.etat === 'a_creer')

  // Rayons d'abord, puis sous-rayons, chacun une seule fois même s'il revient sur plusieurs lignes.
  const nouvelles = new Map<string, string[]>()
  for (const p of aCreer) {
    for (let n = 1; n <= p.categorie.length; n++) {
      const partie = p.categorie.slice(0, n)
      const k = cleChemin(partie)
      if (!categories.has(k) && !nouvelles.has(k)) nouvelles.set(k, partie)
    }
  }
  const nouvellesCategories = [...nouvelles.values()].sort((a, b) => a.length - b.length)

  return { rapport, aCreer, nouvellesCategories }
}

function versRapport(nomFichier: string, a: Analyse, importe: boolean): RapportImport {
  const compter = (etat: LigneRapportImport['etat']): number =>
    a.rapport.filter((l) => l.etat === etat).length
  return {
    nomFichier,
    lignes: importe ? a.rapport.map((l) => (l.etat === 'a_creer' ? { ...l, etat: 'cree' } : l)) : a.rapport,
    nbCrees: a.aCreer.length,
    nbIgnorees: compter('ignoree'),
    nbErreurs: compter('erreur'),
    nouvellesCategories: a.nouvellesCategories.map((c) => c.join(' › ')),
    importe
  }
}

/** Vérification : lit et analyse, n'écrit rien. */
export function verifierImport(db: Db, contenu: Uint8Array, nomFichier: string): RapportImport {
  return versRapport(nomFichier, analyserFichier(db, lireFichier(contenu)), false)
}

/**
 * Import tout ou rien : le fichier est relu et revérifié (la base a pu changer depuis la
 * vérification), puis rayons et produits sont créés dans une seule transaction.
 */
export function importerCatalogue(
  db: Db,
  utilisateurId: number,
  contenu: Uint8Array,
  nomFichier: string
): RapportImport {
  const lignes = lireFichier(contenu)
  return avecTransaction(db, () => {
    const a = analyserFichier(db, lignes)
    const erreurs = a.rapport.filter((l) => l.etat === 'erreur').length
    if (erreurs > 0) {
      throw new ErreurMetier(
        `${erreurs} ligne${erreurs > 1 ? 's' : ''} en erreur : corrigez le fichier, puis vérifiez-le à nouveau. ` +
          'Rien n’a été importé.'
      )
    }
    if (a.aCreer.length === 0)
      throw new ErreurMetier('Aucun nouveau produit dans ce fichier : rien à importer')

    const categories = categoriesExistantes(db)
    for (const partie of a.nouvellesCategories) {
      const parentId = partie.length === 2 ? categories.get(cleChemin(partie.slice(0, 1)))! : null
      categories.set(cleChemin(partie), creerCategorie(db, partie[partie.length - 1], parentId))
    }
    for (const p of a.aCreer) {
      const { id } = creerProduit(db, {
        nom: p.nom,
        categorieId: p.categorie.length > 0 ? categories.get(cleChemin(p.categorie))! : null,
        unite: 'piece',
        tauxTva: p.tauxTva,
        suiviPeremption: false,
        seuilAlerte: p.seuilAlerte,
        uniteVente: {
          prixVente: p.prixVente,
          codeBarres: p.codeBarres,
          codePlu: null,
          boutonTactile: false,
          ordreBouton: 0
        },
        conditionnements: []
      })
      if (p.prixAchat !== null) {
        executer(db, 'UPDATE produits SET prix_achat_indicatif = ? WHERE id = ?', p.prixAchat, id)
      }
    }
    const rapport = versRapport(nomFichier, a, true)
    journaliser(db, {
      utilisateurId,
      action: 'import_catalogue',
      entite: 'produits',
      apres: {
        fichier: nomFichier,
        crees: rapport.nbCrees,
        ignorees: rapport.nbIgnorees,
        nouvellesCategories: rapport.nouvellesCategories
      }
    })
    return rapport
  })
}

// ─── Modèle ───────────────────────────────────────────────────────────────────

/** Classeur modèle : titres, deux exemples, colonne des codes au format Texte. */
export function modeleImport(): Uint8Array {
  const colonnes = Object.keys(TITRES) as Colonne[]
  const feuille = XLSX.utils.aoa_to_sheet([
    colonnes.map((c) => TITRES[c]),
    ['Riz parfumé 5 kg', 'Alimentation', '6181000000011', 4500, 3200, 18, 5],
    ['Baguette', 'Boulangerie', '', 150, 110, 0, 0]
  ])
  feuille['!cols'] = [
    { wch: 32 },
    { wch: 26 },
    { wch: 16 },
    { wch: 15 },
    { wch: 13 },
    { wch: 6 },
    { wch: 14 }
  ]
  // Format Texte (@) sur la colonne des codes : Excel garde les zéros de tête et n'écrit pas 6,18E+12.
  const iCode = colonnes.indexOf('codeBarres')
  for (let r = 0; r <= 2000; r++) {
    const adresse = XLSX.utils.encode_cell({ r, c: iCode })
    const cellule = feuille[adresse] as XLSX.CellObject | undefined
    feuille[adresse] = cellule
      ? { ...cellule, t: 's', v: String(cellule.v ?? ''), z: '@' }
      : { t: 's', v: '', z: '@' }
  }
  feuille['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 2000, c: colonnes.length - 1 } })
  const classeur = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(classeur, feuille, 'Produits')
  return XLSX.write(classeur, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array
}
