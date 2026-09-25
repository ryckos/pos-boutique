/**
 * Logique pure de la fiche produit : passage entre les champs de l'écran (du texte) et la saisie
 * envoyée au processus principal (des nombres). Propriétaire : Dev B. Testée dans
 * tests/saisie-produit.test.ts. Le principal revérifie tout.
 */
import { FORMAT_CODE_BARRES, FORMAT_CODE_PLU } from '@shared/catalogue'
import type {
  FicheProduit,
  SaisieConditionnement,
  SaisieProduit,
  SaisieUnite,
  UniteBase
} from '@shared/ipc/catalogue'

export const LIBELLES_UNITE: Record<UniteBase, string> = {
  piece: 'Pièce',
  kg: 'Kilogramme',
  g: 'Gramme',
  litre: 'Litre',
  ml: 'Millilitre',
  paquet: 'Paquet'
}

/** Champs de l'Unité, tels que tapés. */
export interface ChampsUnite {
  prix: string
  codeBarres: string
  codePlu: string
  bouton: boolean
  ordre: string
}

/** Une ligne du tableau des conditionnements. Sans `id` : nouvelle, pas encore enregistrée. */
export interface ChampsConditionnement extends ChampsUnite {
  cle: string
  id?: number
  nom: string
  quantite: string
  actif: boolean
}

export interface ChampsProduit {
  nom: string
  categorieId: number | null
  unite: UniteBase
  tauxTva: number
  suiviPeremption: boolean
  seuil: string
  uniteVente: ChampsUnite
  conditionnements: ChampsConditionnement[]
}

/** « 1 500 » → 1500, « 0,5 » → 0.5, « » ou « abc » → NaN. */
export function lireNombre(texte: string): number {
  const t = texte.replace(/\s/g, '').replace(',', '.')
  return t === '' ? NaN : Number(t)
}

let compteur = 0
const nouvelleCle = (): string => `n${++compteur}`

export function champsVides(): ChampsProduit {
  return {
    nom: '',
    categorieId: null,
    unite: 'piece',
    tauxTva: 18,
    suiviPeremption: false,
    seuil: '0',
    uniteVente: { prix: '', codeBarres: '', codePlu: '', bouton: false, ordre: '0' },
    conditionnements: []
  }
}

/**
 * Fiche vierge pré-remplie après le scan d'un code inconnu (UI_UX § 5.7) : le code devient celui de
 * l'Unité, en code-barres (8 à 14 chiffres) ou en code PLU (1 à 5 chiffres). Null si le code n'a
 * aucun de ces deux formats (REGLES_METIER § 2.3) : il ne peut pas servir à créer un produit.
 */
export function champsDepuisCodeScanne(code: string): ChampsProduit | null {
  const c = code.trim()
  const champs = champsVides()
  if (FORMAT_CODE_BARRES.test(c)) champs.uniteVente.codeBarres = c
  else if (FORMAT_CODE_PLU.test(c)) champs.uniteVente.codePlu = c
  else return null
  return champs
}

export function nouveauConditionnement(): ChampsConditionnement {
  return {
    cle: nouvelleCle(),
    nom: '',
    quantite: '',
    prix: '',
    codeBarres: '',
    codePlu: '',
    bouton: false,
    ordre: '0',
    actif: true
  }
}

const champsDe = (u: SaisieUnite): ChampsUnite => ({
  prix: String(u.prixVente),
  codeBarres: u.codeBarres ?? '',
  codePlu: u.codePlu ?? '',
  bouton: u.boutonTactile,
  ordre: String(u.ordreBouton)
})

export function champsDepuisFiche(f: FicheProduit): ChampsProduit {
  return {
    nom: f.nom,
    categorieId: f.categorieId,
    unite: f.unite,
    tauxTva: f.tauxTva,
    suiviPeremption: f.suiviPeremption,
    seuil: String(f.seuilAlerte).replace('.', ','),
    uniteVente: champsDe(f.uniteVente),
    conditionnements: f.conditionnements.map((c) => ({
      ...champsDe(c),
      cle: `c${c.id}`,
      id: c.id,
      nom: c.nom,
      quantite: String(c.quantiteBase).replace('.', ','),
      actif: c.actif
    }))
  }
}

const saisieUnite = (c: ChampsUnite): SaisieUnite => ({
  prixVente: lireNombre(c.prix),
  codeBarres: c.codeBarres.trim() || null,
  codePlu: c.codePlu.trim() || null,
  boutonTactile: c.bouton,
  ordreBouton: c.bouton ? Math.max(0, Math.trunc(lireNombre(c.ordre) || 0)) : 0
})

export function versSaisie(c: ChampsProduit): SaisieProduit {
  return {
    nom: c.nom,
    categorieId: c.categorieId,
    unite: c.unite,
    tauxTva: c.tauxTva,
    suiviPeremption: c.suiviPeremption,
    seuilAlerte: lireNombre(c.seuil),
    uniteVente: saisieUnite(c.uniteVente),
    conditionnements: c.conditionnements.map((l): SaisieConditionnement => ({
      ...saisieUnite(l),
      ...(l.id === undefined ? {} : { id: l.id }),
      nom: l.nom,
      quantiteBase: lireNombre(l.quantite),
      actif: l.actif
    }))
  }
}

/** Le bouton « Enregistrer » s'allume quand l'essentiel est saisi ; le principal fait le reste. */
export function saisieComplete(c: ChampsProduit): boolean {
  const s = versSaisie(c)
  const prixOk = (p: number): boolean => Number.isInteger(p) && p >= 0
  return (
    s.nom.trim() !== '' &&
    prixOk(s.uniteVente.prixVente) &&
    Number.isFinite(s.seuilAlerte) &&
    s.seuilAlerte >= 0 &&
    s.conditionnements.every((l) => l.nom.trim() !== '' && l.quantiteBase > 0 && prixOk(l.prixVente))
  )
}

/** Prix ramené à l'unité de base, pour comparer d'un coup d'œil : 7 500 F / 24 → 313. */
export function prixParUnite(prix: string, quantite: string): number | null {
  const p = lireNombre(prix)
  const q = lireNombre(quantite)
  return Number.isFinite(p) && q > 0 ? Math.round(p / q) : null
}
