/**
 * Logique pure de l'écran « Nouvelle réception » (B8, REGLES_METIER § 4.1 et 4.2). Propriétaire : Dev B.
 * Le brouillon ne vit que dans l'écran (gardé sur le poste contre les coupures) ; le principal revérifie
 * tout à la validation.
 */
import { UNITES_FRACTIONNAIRES, convertirLigne, type ConversionLigne } from '@shared/achats'
import type { ArticleReception, SaisieReception } from '@shared/ipc/achats'
import { formaterFCFA, formaterQuantite } from '@shared/format'

export interface LigneBrouillon {
  /** Identifiant d'affichage, stable pendant la saisie. */
  cle: number
  article: ArticleReception
  quantite: string
  prix: string
  numeroLot: string
  /** AAAA-MM-JJ (champ date). */
  datePeremption: string
}

export interface Brouillon {
  fournisseurId: number | null
  commentaire: string
  lignes: LigneBrouillon[]
  prochaineCle: number
}

export interface EtatLigne {
  conversion: ConversionLigne | null
  /** Ce qui empêche de valider cette ligne, null si elle est complète. */
  erreur: string | null
  /** Avertissements qui ne bloquent pas. */
  alertes: string[]
}

export function brouillonVide(): Brouillon {
  return { fournisseurId: null, commentaire: '', lignes: [], prochaineCle: 1 }
}

/** Nouvelle ligne en fin de tableau, prix pré-rempli par le dernier prix connu. */
export function ajouterArticle(b: Brouillon, article: ArticleReception): Brouillon {
  const ligne: LigneBrouillon = {
    cle: b.prochaineCle,
    article,
    quantite: '',
    prix: article.prixPropose !== null ? String(article.prixPropose) : '',
    numeroLot: '',
    datePeremption: ''
  }
  return { ...b, lignes: [...b.lignes, ligne], prochaineCle: b.prochaineCle + 1 }
}

export function modifierLigne(b: Brouillon, cle: number, champs: Partial<LigneBrouillon>): Brouillon {
  return { ...b, lignes: b.lignes.map((l) => (l.cle === cle ? { ...l, ...champs } : l)) }
}

export function retirerLigne(b: Brouillon, cle: number): Brouillon {
  return { ...b, lignes: b.lignes.filter((l) => l.cle !== cle) }
}

/** « 6 000 » ou « 2,5 » → nombre ; NaN si illisible, null si vide. */
export function lireNombre(texte: string): number | null {
  const t = texte.replace(/[\s  ]/g, '').replace(',', '.')
  if (t === '') return null
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN
}

/** AAAA-MM-JJ + n jours, sans fuseau horaire. */
export function ajouterJours(dateIso: string, jours: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + jours)
  return d.toISOString().slice(0, 10)
}

const LIBELLES_BASE: Record<string, [string, string]> = {
  piece: ['unité', 'unités'],
  paquet: ['paquet', 'paquets'],
  kg: ['kg', 'kg'],
  g: ['g', 'g'],
  litre: ['L', 'L'],
  ml: ['mL', 'mL']
}

/** « = 72 unités à 250 F l’unité » ; null pour l'Unité elle-même, où il n'y a rien à convertir. */
export function texteConversion(article: ArticleReception, c: ConversionLigne): string | null {
  if (article.quantiteBase === 1) return null
  const [un, plusieurs] = LIBELLES_BASE[article.unite] ?? LIBELLES_BASE.piece
  const nom = c.quantiteBase > 1 ? plusieurs : un
  const par = article.unite === 'piece' ? 'l’unité' : `le ${un}`
  return `= ${formaterQuantite(c.quantiteBase)} ${nom} à ${formaterFCFA(c.coutBase)} ${par}`
}

export function etatLigne(l: LigneBrouillon, aujourdhui: string, seuilPeremptionJours: number): EtatLigne {
  const a = l.article
  const alertes: string[] = []
  const quantite = lireNombre(l.quantite)
  const prix = lireNombre(l.prix)

  let erreur: string | null = null
  const fractionnaire = UNITES_FRACTIONNAIRES.includes(a.unite)
  if (quantite === null) erreur = 'indiquez la quantité reçue'
  else if (Number.isNaN(quantite) || quantite <= 0 || (!fractionnaire && !Number.isInteger(quantite))) {
    erreur = fractionnaire ? 'quantité illisible' : 'la quantité reçue est un nombre entier'
  } else if (prix === null) erreur = 'indiquez le prix d’achat'
  else if (Number.isNaN(prix) || prix <= 0 || !Number.isInteger(prix)) {
    erreur = 'le prix d’achat est un montant en francs, sans virgule'
  }

  if (a.suiviPeremption) {
    if (erreur === null && l.numeroLot.trim() === '') erreur = 'indiquez le numéro de lot'
    else if (erreur === null && l.datePeremption === '') erreur = 'indiquez la date de péremption'
    else if (erreur === null && l.datePeremption < aujourdhui)
      erreur = 'la date de péremption est déjà passée'
    if (l.datePeremption !== '' && l.datePeremption >= aujourdhui) {
      if (l.datePeremption <= ajouterJours(aujourdhui, seuilPeremptionJours)) {
        alertes.push('périme bientôt : à vendre en priorité')
      }
    }
  }

  const conversion =
    quantite !== null &&
    prix !== null &&
    !Number.isNaN(quantite) &&
    !Number.isNaN(prix) &&
    quantite > 0 &&
    prix > 0
      ? convertirLigne(quantite, prix, a.quantiteBase)
      : null
  if (conversion && a.prixUnite > 0 && conversion.coutBase >= a.prixUnite) {
    alertes.push(
      `coût par unité (${formaterFCFA(conversion.coutBase)}) égal ou supérieur au prix de vente (${formaterFCFA(a.prixUnite)})`
    )
  }
  return { conversion, erreur, alertes }
}

export function totalBrouillon(b: Brouillon, aujourdhui: string, seuil: number): number {
  return b.lignes.reduce((t, l) => t + (etatLigne(l, aujourdhui, seuil).conversion?.total ?? 0), 0)
}

/** Ce qui manque avant de pouvoir valider, null si tout est prêt. */
export function manque(b: Brouillon, aujourdhui: string, seuil: number): string | null {
  if (b.fournisseurId === null) return 'Choisissez le fournisseur qui livre.'
  if (b.lignes.length === 0) return 'Scannez ou cherchez le premier article reçu.'
  for (const l of b.lignes) {
    const { erreur } = etatLigne(l, aujourdhui, seuil)
    if (erreur) return `${l.article.produit} — ${l.article.conditionnement} : ${erreur}.`
  }
  return null
}

export function versSaisie(b: Brouillon): SaisieReception {
  return {
    fournisseurId: b.fournisseurId ?? 0,
    commentaire: b.commentaire.trim() || null,
    lignes: b.lignes.map((l) => ({
      conditionnementId: l.article.conditionnementId,
      quantite: lireNombre(l.quantite) ?? 0,
      prix: lireNombre(l.prix) ?? 0,
      numeroLot: l.article.suiviPeremption ? l.numeroLot.trim() : null,
      datePeremption: l.article.suiviPeremption ? l.datePeremption : null
    }))
  }
}

/** Relit un brouillon gardé sur le poste ; null s'il est absent ou abîmé. */
export function lireBrouillon(texte: string | null): Brouillon | null {
  if (!texte) return null
  try {
    const b = JSON.parse(texte) as Brouillon
    const valide =
      (b.fournisseurId === null || typeof b.fournisseurId === 'number') &&
      typeof b.commentaire === 'string' &&
      Array.isArray(b.lignes) &&
      typeof b.prochaineCle === 'number' &&
      b.lignes.every((l) => typeof l.cle === 'number' && typeof l.article?.conditionnementId === 'number')
    return valide ? b : null
  } catch {
    return null
  }
}

/** Un brouillon vaut la peine d'être gardé dès qu'il contient un article. */
export function brouillonUtile(b: Brouillon): boolean {
  return b.lignes.length > 0
}
