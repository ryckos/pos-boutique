/**
 * Exports Excel (B15). Propriétaire : Dev B.
 * Construit le classeur d'un export (REGLES_METIER § 11.2) : ligne de titre avec l'auteur et l'heure,
 * une ligne vide, les en-têtes, puis les lignes. Montants et quantités en vrais nombres, dates en vraies
 * dates : la patronne peut trier et additionner dans Excel. Fonction pure, sans fenêtre ni fichier.
 */
import * as XLSX from 'xlsx'
import type { ColonneExport, DemandeExport, FeuilleExport } from '@shared/ipc/exports'
import { ErreurMetier } from '../../core/erreurs'

const FORMAT_MONTANT = '#,##0 "F"'
const FORMAT_NOMBRE = '#,##0.###'
const FORMAT_DATE = 'dd/mm/yyyy'
const FORMAT_DATE_HEURE = 'dd/mm/yyyy hh:mm'
const DATE_SQL = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/
/** Ligne des en-têtes (0 = titre, 1 = vide). */
const LIGNE_ENTETES = 2

/** Caractères refusés par Excel dans un nom d'onglet, et dans un nom de fichier par Windows. */
const INTERDITS_FEUILLE = /[[\]:*?/\\]/g
const INTERDITS_FICHIER = /[\\/:*?"<>|]/g

export function nomFichierExport(nom: string): string {
  const propre = nom.replace(INTERDITS_FICHIER, '-').replace(/\s+/g, ' ').trim() || 'Export'
  return /\.xlsx$/i.test(propre) ? propre : `${propre}.xlsx`
}

function nomFeuille(nom: string, dejaPris: Set<string>): string {
  const base = nom.replace(INTERDITS_FEUILLE, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Feuille'
  let resultat = base
  for (let n = 2; dejaPris.has(resultat.toLowerCase()); n++) {
    const suffixe = ` (${n})`
    resultat = `${base.slice(0, 31 - suffixe.length)}${suffixe}`
  }
  dejaPris.add(resultat.toLowerCase())
  return resultat
}

/** « 2026-10-09 » ou « 2026-10-09 14:05:00 » → numéro de série Excel ; null si ce n'est pas une date. */
function serieExcel(texte: string): { serie: number; avecHeure: boolean } | null {
  const m = DATE_SQL.exec(texte.trim())
  if (!m) return null
  const [, a, mo, j, h, mi, s] = m
  const jour = Date.UTC(Number(a), Number(mo) - 1, Number(j)) / 86_400_000
  // Excel compte les jours depuis le 30/12/1899.
  const serie = jour + 25_569 + (Number(h ?? 0) * 3600 + Number(mi ?? 0) * 60 + Number(s ?? 0)) / 86_400
  return { serie, avecHeure: h !== undefined }
}

function cellule(valeur: string | number | null, type: ColonneExport['type']): XLSX.CellObject | null {
  if (valeur === null || valeur === '') return null
  if (type === 'texte' || typeof valeur === 'string') {
    if (type === 'date' && typeof valeur === 'string') {
      const d = serieExcel(valeur)
      if (d) return { t: 'n', v: d.serie, z: d.avecHeure ? FORMAT_DATE_HEURE : FORMAT_DATE }
    }
    // Type « s » : Excel l'affiche tel quel, jamais comme une formule.
    return { t: 's', v: String(valeur) }
  }
  if (type === 'montant') return { t: 'n', v: Math.round(valeur), z: FORMAT_MONTANT }
  return { t: 'n', v: valeur, z: FORMAT_NOMBRE }
}

function largeurTexte(c: XLSX.CellObject | null, type: ColonneExport['type']): number {
  if (!c) return 0
  if (type === 'date') return c.z === FORMAT_DATE_HEURE ? 16 : 10
  if (type === 'montant') return String(c.v).length + 4
  return String(c.v).length
}

function feuilleExcel(f: FeuilleExport, titre: string, sousTitre: string): XLSX.WorkSheet {
  if (f.colonnes.length === 0) throw new Error(`Export : la feuille « ${f.nom} » n’a aucune colonne`)
  const feuille: XLSX.WorkSheet = {}
  feuille[XLSX.utils.encode_cell({ r: 0, c: 0 })] = { t: 's', v: `${titre} — ${sousTitre}` }
  const largeurs = f.colonnes.map((c) => c.titre.length)
  f.colonnes.forEach((c, i) => {
    feuille[XLSX.utils.encode_cell({ r: LIGNE_ENTETES, c: i })] = { t: 's', v: c.titre }
  })
  f.lignes.forEach((ligne, r) => {
    // Une ligne de la mauvaise longueur décalerait toutes les colonnes : c'est un bug de l'écran.
    if (ligne.length !== f.colonnes.length) {
      throw new Error(`Export : la ligne ${r + 1} de « ${f.nom} » n’a pas ${f.colonnes.length} valeurs`)
    }
    ligne.forEach((v, i) => {
      const type = f.colonnes[i].type
      const c = cellule(v, type)
      if (c) feuille[XLSX.utils.encode_cell({ r: LIGNE_ENTETES + 1 + r, c: i })] = c
      largeurs[i] = Math.max(largeurs[i], largeurTexte(c, type))
    })
  })
  feuille['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: LIGNE_ENTETES + Math.max(f.lignes.length, 0), c: f.colonnes.length - 1 }
  })
  feuille['!cols'] = f.colonnes.map((c, i) => ({ wch: c.largeur ?? Math.min(60, largeurs[i] + 2) }))
  return feuille
}

/**
 * @param auteur nom de la personne connectée (lu dans la session par le principal).
 * @param maintenant « JJ/MM/AAAA à HH h MM », heure de la boutique.
 */
export function classeurExcel(demande: DemandeExport, auteur: string, maintenant: string): Uint8Array {
  if (!demande.feuilles?.length) throw new ErreurMetier('Rien à exporter : la liste est vide')
  const sousTitre = `exporté le ${maintenant} par ${auteur}`
  const classeur = XLSX.utils.book_new()
  const pris = new Set<string>()
  for (const f of demande.feuilles) {
    XLSX.utils.book_append_sheet(
      classeur,
      feuilleExcel(f, demande.titre.trim(), sousTitre),
      nomFeuille(f.nom, pris)
    )
  }
  return XLSX.write(classeur, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array
}

/** « 09/10/2026 à 10 h 52 », heure locale du terminal. */
export function horodatageExport(d: Date = new Date()): string {
  const deux = (n: number): string => String(n).padStart(2, '0')
  return `${deux(d.getDate())}/${deux(d.getMonth() + 1)}/${d.getFullYear()} à ${deux(d.getHours())} h ${deux(d.getMinutes())}`
}
