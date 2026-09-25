/**
 * Paramètres de la boutique. Propriétaire : Dev B.
 * La table est un simple clé/valeur texte : ce service est le seul à connaître les clés, leurs
 * défauts et leur conversion, pour que personne d'autre n'ait à le faire.
 * `lireParametres` peut être appelée directement dans le processus principal (ticket imprimé
 * après la vente) sans passer par l'IPC.
 */
import type { UtilisateurConnecte } from '@shared/types'
import type { ParametresBoutique } from '@shared/ipc/parametres'
import type { Db } from '../../db/connexion'
import { avecTransaction, executer, toutes } from '../../db/requetes'
import { ErreurMetier } from '../../core/erreurs'
import { journaliser } from '../../core/audit'

type Champ = keyof ParametresBoutique

/** Champ de l'objet → clé de la table (REGLES_METIER § 13). */
const CLES: Record<Champ, string> = {
  boutiqueNom: 'boutique_nom',
  boutiqueAdresse: 'boutique_adresse',
  boutiqueNif: 'boutique_nif',
  ticketPied: 'ticket_pied',
  tvaDefaut: 'tva_defaut',
  plafondRemiseCaissier: 'plafond_remise_caissier',
  peremptionSeuilJours: 'peremption_seuil_jours',
  dormantJours: 'dormant_jours',
  imprimanteMethode: 'imprimante_methode',
  imprimanteCible: 'imprimante_cible',
  imprimantePageCodes: 'imprimante_page_codes'
}

/** Le gérant règle l'imprimante (écran « Réglages matériel », A3) ; le reste est à l'admin. */
const CHAMPS_MATERIEL: Champ[] = ['imprimanteMethode', 'imprimanteCible', 'imprimantePageCodes']

function texte(v: string | undefined): string | null {
  const t = v?.trim()
  return t ? t : null
}

/** Entier positif ou nul ; toute valeur illisible vaut « non renseigné ». */
function entier(v: string | undefined): number | null {
  const t = v?.trim()
  return t && /^\d+$/.test(t) ? Number(t) : null
}

function jours(v: string | undefined, defaut: number): number {
  const n = entier(v)
  return n !== null && n > 0 ? n : defaut
}

export function lireParametres(db: Db): ParametresBoutique {
  const brut = new Map(
    toutes<{ cle: string; valeur: string | null }>(db, 'SELECT cle, valeur FROM parametres').map((l) => [
      l.cle,
      l.valeur ?? undefined
    ])
  )
  const v = (champ: Champ): string | undefined => brut.get(CLES[champ])
  const tva = entier(v('tvaDefaut'))
  return {
    boutiqueNom: texte(v('boutiqueNom')),
    boutiqueAdresse: texte(v('boutiqueAdresse')),
    boutiqueNif: texte(v('boutiqueNif')),
    ticketPied: texte(v('ticketPied')) ?? 'Merci de votre visite !',
    // Seuls 18 % et 0 % existent (comme pour la fiche produit) : toute autre valeur revient à 18.
    tvaDefaut: tva === 0 || tva === 18 ? tva : 18,
    plafondRemiseCaissier: entier(v('plafondRemiseCaissier')),
    peremptionSeuilJours: jours(v('peremptionSeuilJours'), 15),
    dormantJours: jours(v('dormantJours'), 60),
    imprimanteMethode: v('imprimanteMethode')?.trim() === 'share' ? 'share' : 'spooler',
    imprimanteCible: texte(v('imprimanteCible')),
    imprimantePageCodes: texte(v('imprimantePageCodes'))
  }
}

// ─── Écriture ───

function exigerTexte(valeur: unknown): string | null {
  if (valeur === null) return null
  if (typeof valeur !== 'string') throw new ErreurMetier('Valeur de paramètre invalide')
  return valeur.trim() || null
}

function exigerEntier(valeur: unknown, min: number, message: string): number {
  if (typeof valeur !== 'number' || !Number.isSafeInteger(valeur) || valeur < min) {
    throw new ErreurMetier(message)
  }
  return valeur
}

/**
 * Contrôle une valeur reçue de l'interface (non fiable) et renvoie le texte à ranger en base.
 * `null` = effacer : la lecture rendra alors le défaut, ou « non renseigné ».
 */
function valeurAEnregistrer(champ: Champ, valeur: unknown): string | null {
  switch (champ) {
    case 'boutiqueNom': {
      const nom = exigerTexte(valeur)
      if (nom === null)
        throw new ErreurMetier('Indiquez le nom de la boutique : il s’imprime en haut du ticket')
      return nom
    }
    case 'boutiqueAdresse':
    case 'boutiqueNif':
    case 'ticketPied':
    case 'imprimanteCible':
    case 'imprimantePageCodes':
      return exigerTexte(valeur)
    case 'tvaDefaut':
      if (valeur !== 0 && valeur !== 18)
        throw new ErreurMetier('La TVA par défaut est de 18 % ou 0 % (exonéré)')
      return String(valeur)
    case 'plafondRemiseCaissier':
      if (valeur === null) return null
      return String(exigerEntier(valeur, 0, 'Le plafond de remise est un montant en francs, sans décimales'))
    case 'peremptionSeuilJours':
      return String(exigerEntier(valeur, 1, 'L’horizon des péremptions est un nombre de jours, au moins 1'))
    case 'dormantJours':
      return String(
        exigerEntier(valeur, 1, 'Le seuil des produits dormants est un nombre de jours, au moins 1')
      )
    case 'imprimanteMethode':
      if (valeur !== 'spooler' && valeur !== 'share') throw new ErreurMetier('Méthode d’impression inconnue')
      return valeur
  }
}

/**
 * Enregistre les paramètres fournis (les autres ne bougent pas), tout ou rien : une seule valeur
 * refusée et rien n'est écrit. Chaque paramètre dont la valeur change réellement est journalisé.
 * Renvoie les paramètres à jour.
 */
export function ecrireParametres(
  db: Db,
  auteur: UtilisateurConnecte,
  modifications: Partial<Record<Champ, unknown>>
): ParametresBoutique {
  const champs = Object.keys(modifications) as Champ[]
  for (const champ of champs) {
    if (!Object.hasOwn(CLES, champ)) throw new ErreurMetier('Paramètre inconnu')
  }
  // L'interface n'est pas digne de confiance : le rôle est revérifié ici.
  const materielSeulement = champs.every((c) => CHAMPS_MATERIEL.includes(c))
  if (auteur.role === 'caissier' || (auteur.role !== 'admin' && !materielSeulement)) {
    throw new ErreurMetier('Seul l’administrateur peut modifier les paramètres de la boutique')
  }
  // Tout est contrôlé avant la première écriture.
  const valeurs = champs.map((champ) => [champ, valeurAEnregistrer(champ, modifications[champ])] as const)

  return avecTransaction(db, () => {
    const avant = lireParametres(db)
    for (const [champ, valeur] of valeurs) {
      executer(
        db,
        `INSERT INTO parametres (cle, valeur) VALUES (?, ?)
         ON CONFLICT (cle) DO UPDATE SET valeur = excluded.valeur`,
        CLES[champ],
        valeur
      )
    }
    const apres = lireParametres(db)
    // On compare les valeurs lues (défauts compris) : effacer un pied de ticket déjà par défaut ne
    // change rien pour personne, donc rien à journaliser.
    for (const champ of champs) {
      if (avant[champ] === apres[champ]) continue
      journaliser(db, {
        utilisateurId: auteur.id,
        action: 'modification_parametre',
        entite: CLES[champ],
        avant: avant[champ],
        apres: apres[champ]
      })
    }
    return apres
  })
}
