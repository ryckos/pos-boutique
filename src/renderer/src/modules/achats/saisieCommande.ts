/**
 * Logique pure des écrans de commande fournisseur (B8 partie 3, REGLES_METIER § 4.7).
 * Propriétaire : Dev B. On commande dans le conditionnement (3 cartons), une ligne par produit, prix
 * prévu facultatif ; le principal revérifie tout à l'enregistrement.
 */
import { UNITES_FRACTIONNAIRES } from '@shared/achats'
import type { ArticleReception, Commande, SaisieCommande, StatutCommande } from '@shared/ipc/achats'
import { formaterDate, formaterFCFA, formaterQuantite } from '@shared/format'
import { lireNombre, texteUnitesBase } from './saisieReception'

export interface LigneCommandeSaisie {
  /** Identifiant d'affichage, stable pendant la saisie. */
  cle: number
  article: ArticleReception
  quantite: string
  prix: string
}

export interface BrouillonCommande {
  /** null tant que le brouillon n'est pas enregistré. */
  id: number | null
  numero: string | null
  fournisseurId: number | null
  commentaire: string
  lignes: LigneCommandeSaisie[]
  prochaineCle: number
}

export interface EtatLigneCommande {
  /** Quantité commandée en unités de base, null si la quantité est illisible. */
  quantiteBase: number | null
  /** Total prévu, null sans prix. */
  total: number | null
  erreur: string | null
}

export const LIBELLES_STATUT: Record<StatutCommande, string> = {
  brouillon: 'Brouillon',
  envoyee: 'Envoyée',
  recue_partiel: 'Reçue en partie',
  recue: 'Reçue',
  annulee: 'Annulée'
}

/** Classe de pastille de chaque état : ambre = à suivre, vert = terminé, gris = sans suite. */
export const PASTILLE_STATUT: Record<StatutCommande, string> = {
  brouillon: 'pastille pastille-alerte',
  envoyee: 'pastille',
  recue_partiel: 'pastille pastille-alerte',
  recue: 'pastille pastille-ok',
  annulee: 'pastille pastille-inactif'
}

export function commandeVide(): BrouillonCommande {
  return { id: null, numero: null, fournisseurId: null, commentaire: '', lignes: [], prochaineCle: 1 }
}

/** Brouillon enregistré, rouvert pour modification ; les articles désactivés depuis sont écartés. */
export function depuisCommande(
  c: Commande,
  articles: Map<number, ArticleReception | null>
): { brouillon: BrouillonCommande; retires: string[] } {
  const retires: string[] = []
  const lignes: LigneCommandeSaisie[] = []
  for (const l of c.lignes) {
    const article = articles.get(l.conditionnementId)
    if (!article) {
      retires.push(`${l.produit} — ${l.conditionnement}`)
      continue
    }
    lignes.push({
      cle: lignes.length + 1,
      article,
      quantite: formaterQuantite(l.quantite).replace(/\s/g, ''),
      prix: l.prix !== null ? String(l.prix) : ''
    })
  }
  return {
    brouillon: {
      id: c.id,
      numero: c.numero,
      fournisseurId: c.fournisseurId,
      commentaire: c.commentaire ?? '',
      lignes,
      prochaineCle: lignes.length + 1
    },
    retires
  }
}

/**
 * Ajoute une ligne, prix prévu pré-rempli par le dernier prix payé. Un produit déjà commandé
 * n'est pas ajouté une seconde fois : on renvoie son nom pour le dire.
 */
export function ajouterArticleCommande(
  b: BrouillonCommande,
  article: ArticleReception
): { brouillon: BrouillonCommande; dejaPresent: string | null } {
  if (b.lignes.some((l) => l.article.produitId === article.produitId)) {
    return { brouillon: b, dejaPresent: article.produit }
  }
  const ligne: LigneCommandeSaisie = {
    cle: b.prochaineCle,
    article,
    quantite: '',
    prix: article.prixPropose !== null ? String(article.prixPropose) : ''
  }
  return { brouillon: { ...b, lignes: [...b.lignes, ligne], prochaineCle: b.prochaineCle + 1 }, dejaPresent: null }
}

export function modifierLigneCommande(
  b: BrouillonCommande,
  cle: number,
  champs: Partial<LigneCommandeSaisie>
): BrouillonCommande {
  return { ...b, lignes: b.lignes.map((l) => (l.cle === cle ? { ...l, ...champs } : l)) }
}

/** Autre conditionnement du même produit : la quantité reste, le prix repart du dernier prix payé. */
export function changerConditionnementCommande(
  b: BrouillonCommande,
  cle: number,
  article: ArticleReception
): BrouillonCommande {
  return modifierLigneCommande(b, cle, {
    article,
    prix: article.prixPropose !== null ? String(article.prixPropose) : ''
  })
}

export function retirerLigneCommande(b: BrouillonCommande, cle: number): BrouillonCommande {
  return { ...b, lignes: b.lignes.filter((l) => l.cle !== cle) }
}

export function etatLigneCommande(l: LigneCommandeSaisie): EtatLigneCommande {
  const a = l.article
  const quantite = lireNombre(l.quantite)
  const prix = lireNombre(l.prix)
  const fractionnaire = UNITES_FRACTIONNAIRES.includes(a.unite)

  let erreur: string | null = null
  const quantiteLue =
    quantite !== null && !Number.isNaN(quantite) && quantite > 0 && (fractionnaire || Number.isInteger(quantite))
  if (quantite === null) erreur = 'indiquez la quantité commandée'
  else if (!quantiteLue) erreur = fractionnaire ? 'quantité illisible' : 'la quantité commandée est un nombre entier'
  else if (prix !== null && (Number.isNaN(prix) || prix <= 0 || !Number.isInteger(prix))) {
    erreur = 'le prix prévu est un montant en francs, sans virgule, ou laissez-le vide'
  }

  const prixLu = prix !== null && !Number.isNaN(prix) && prix > 0 ? prix : null
  return {
    quantiteBase: quantiteLue ? quantite! * a.quantiteBase : null,
    total: quantiteLue && prixLu !== null ? Math.round(quantite! * prixLu) : null,
    erreur
  }
}

/** « = 72 unités » sous la ligne ; null pour l'Unité, où il n'y a rien à convertir. */
export function texteConversionCommande(l: LigneCommandeSaisie): string | null {
  const { quantiteBase } = etatLigneCommande(l)
  if (l.article.quantiteBase === 1 || quantiteBase === null) return null
  return `= ${texteUnitesBase(l.article.unite, quantiteBase)}`
}

export function totalPrevuCommande(b: BrouillonCommande): number {
  return b.lignes.reduce((t, l) => t + (etatLigneCommande(l).total ?? 0), 0)
}

/** Ce qui manque avant de pouvoir enregistrer, null si tout est prêt. */
export function manqueCommande(b: BrouillonCommande): string | null {
  if (b.fournisseurId === null) return 'Choisissez le fournisseur à qui vous commandez.'
  if (b.lignes.length === 0) return 'Scannez, cherchez ou proposez depuis les alertes le premier article.'
  for (const l of b.lignes) {
    const { erreur } = etatLigneCommande(l)
    if (erreur) return `${l.article.produit} — ${l.article.conditionnement} : ${erreur}.`
  }
  return null
}

export function versSaisieCommande(b: BrouillonCommande): SaisieCommande {
  return {
    fournisseurId: b.fournisseurId ?? 0,
    commentaire: b.commentaire.trim() || null,
    lignes: b.lignes.map((l) => {
      const prix = lireNombre(l.prix)
      return {
        conditionnementId: l.article.conditionnementId,
        quantite: lireNombre(l.quantite) ?? 0,
        prix: prix === null || Number.isNaN(prix) ? null : prix
      }
    })
  }
}

/** Texte de la commande à recopier ou envoyer (WhatsApp) : ce qui est commandé, sans les coûts internes. */
export function texteApercu(c: Commande, boutique: string | null): string {
  const lignes = c.lignes.map((l) => {
    const prix = l.prix !== null ? ` (${formaterFCFA(l.prix)})` : ''
    return `- ${l.produit} : ${formaterQuantite(l.quantite)} × ${l.conditionnement}${prix}`
  })
  return [
    `Commande ${c.numero}`,
    ...(boutique ? [`De : ${boutique}`] : []),
    `Pour : ${c.fournisseur}`,
    `Le ${formaterDate(c.dateCommande)}`,
    '',
    ...lignes,
    ...(c.totalPrevu > 0 ? ['', `Total prévu : ${formaterFCFA(c.totalPrevu)}`] : []),
    ...(c.commentaire ? ['', c.commentaire] : [])
  ].join('\n')
}

/**
 * Reste à recevoir, exprimé pour pré-remplir la réception : dans le conditionnement commandé s'il
 * tombe juste (1 carton), sinon dans l'Unité (18 boîtes quand 30 sont déjà arrivées sur 2 cartons).
 */
export function resteEnSaisie(
  resteBase: number,
  quantiteCond: number
): { dansConditionnement: boolean; quantite: number } {
  const n = resteBase / quantiteCond
  return Number.isInteger(n) ? { dansConditionnement: true, quantite: n } : { dansConditionnement: false, quantite: resteBase }
}

/** « 1 carton de 24 » ou « 24 unités » pour la colonne « Reste à recevoir ». */
export function texteReste(l: Commande['lignes'][number]): string {
  if (l.resteBase === 0) return '—'
  const r = resteEnSaisie(l.resteBase, l.quantiteCond)
  return r.dansConditionnement && l.quantiteCond !== 1
    ? `${formaterQuantite(r.quantite)} × ${l.conditionnement}`
    : texteUnitesBase(l.unite, l.resteBase)
}
