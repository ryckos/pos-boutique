/** Propriétaire : Dev B. */
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import { BrowserWindow, dialog } from 'electron'
import { base } from '../../db/connexion'
import { gerer } from '../../ipc/gerer'
import { session } from '../../core/session'
import {
  conditionnementsProduit,
  grille,
  produitsAvecStock,
  rechercherParCode,
  rechercherTexte
} from './service'
import {
  creerProduit,
  desactiverProduit,
  ficheProduit,
  genererCodeInterne,
  listeProduits,
  modifierProduit
} from './produits'
import { creerCategorie, desactiverCategorie, listerCategories, renommerCategorie } from './categories'
import { importerCatalogue, modeleImport, TAILLE_MAX_OCTETS, verifierImport } from './import'
import { ErreurMetier } from '../../core/erreurs'

/**
 * Dernier fichier vérifié. L'import relit ce chemin, choisi dans la fenêtre du système : l'écran
 * ne transmet jamais de chemin de fichier.
 */
let fichierVerifie: string | null = null

function lireFichierImport(chemin: string): Uint8Array {
  try {
    if (statSync(chemin).size > TAILLE_MAX_OCTETS) {
      throw new ErreurMetier('Ce fichier dépasse 5 Mo : gardez seulement la feuille des produits')
    }
    return readFileSync(chemin)
  } catch (e) {
    if (e instanceof ErreurMetier) throw e
    throw new ErreurMetier('Le fichier ne s’ouvre plus : fermez-le dans Excel, puis vérifiez-le à nouveau')
  }
}

export function enregistrerIpcCatalogue(): void {
  gerer('catalogue:rechercherCode', ({ code }) => {
    session.exiger()
    return rechercherParCode(base(), code)
  })
  gerer('catalogue:rechercher', ({ texte }) => {
    session.exiger()
    return rechercherTexte(base(), texte)
  })
  gerer('catalogue:grille', () => {
    session.exiger()
    return grille(base())
  })
  gerer('catalogue:conditionnementsProduit', ({ produitId }) => {
    session.exiger()
    return conditionnementsProduit(base(), produitId)
  })
  gerer('catalogue:produitsStock', () => {
    // Valeur du stock au CUMP : donnée de gestion, pas pour la caisse.
    session.exiger(['gerant'])
    return produitsAvecStock(base())
  })

  // Produits : gérant (matrice : « créer ou modifier un produit »). La caisse ne lit le catalogue
  // que par les canaux ci-dessus.
  gerer('catalogue:listeProduits', () => {
    session.exiger(['gerant'])
    return listeProduits(base())
  })
  gerer('catalogue:ficheProduit', ({ id }) => {
    session.exiger(['gerant'])
    return ficheProduit(base(), id)
  })
  gerer('catalogue:creerProduit', (saisie) => {
    session.exiger(['gerant'])
    return creerProduit(base(), saisie)
  })
  gerer('catalogue:modifierProduit', ({ id, ...saisie }) => {
    const u = session.exiger(['gerant'])
    return modifierProduit(base(), u.id, id, saisie)
  })
  gerer('catalogue:desactiverProduit', ({ id, motif }) => {
    const u = session.exiger(['gerant'])
    desactiverProduit(base(), u.id, id, motif)
  })
  gerer('catalogue:genererCodeInterne', () => {
    session.exiger(['gerant'])
    return { code: genererCodeInterne(base()) }
  })

  // Catégories : lecture pour tous (grille, fiches), modification par le gérant (matrice :
  // « créer ou modifier un produit »).
  gerer('catalogue:categories', () => {
    session.exiger()
    return listerCategories(base())
  })
  gerer('catalogue:creerCategorie', ({ nom, parentId }) => {
    session.exiger(['gerant'])
    return { id: creerCategorie(base(), nom, parentId ?? null) }
  })
  gerer('catalogue:renommerCategorie', ({ id, nom }) => {
    session.exiger(['gerant'])
    renommerCategorie(base(), id, nom)
  })
  gerer('catalogue:desactiverCategorie', ({ id }) => {
    session.exiger(['gerant'])
    desactiverCategorie(base(), id)
  })

  // Import du catalogue (B3) : gérant, comme la création d'un produit.
  gerer('catalogue:telechargerModeleImport', async () => {
    session.exiger(['gerant'])
    const fenetre = BrowserWindow.getFocusedWindow()
    const options = {
      title: 'Enregistrer le modèle d’import',
      defaultPath: 'Modele_catalogue.xlsx',
      filters: [{ name: 'Classeur Excel', extensions: ['xlsx'] }]
    }
    const choix = fenetre
      ? await dialog.showSaveDialog(fenetre, options)
      : await dialog.showSaveDialog(options)
    if (choix.canceled || !choix.filePath) return { enregistre: false }
    try {
      writeFileSync(choix.filePath, modeleImport())
    } catch {
      throw new ErreurMetier(
        'Le modèle n’a pas pu être enregistré : fermez-le dans Excel ou choisissez un autre dossier'
      )
    }
    return { enregistre: true }
  })
  gerer('catalogue:verifierImport', async () => {
    session.exiger(['gerant'])
    const fenetre = BrowserWindow.getFocusedWindow()
    const options = {
      title: 'Choisir le fichier du catalogue',
      properties: ['openFile' as const],
      filters: [{ name: 'Classeur Excel', extensions: ['xlsx', 'xls'] }]
    }
    const choix = fenetre
      ? await dialog.showOpenDialog(fenetre, options)
      : await dialog.showOpenDialog(options)
    const chemin = choix.filePaths[0]
    if (choix.canceled || !chemin) return null
    fichierVerifie = null
    const rapport = verifierImport(base(), lireFichierImport(chemin), basename(chemin))
    fichierVerifie = chemin
    return rapport
  })
  gerer('catalogue:importerCatalogue', () => {
    const u = session.exiger(['gerant'])
    if (!fichierVerifie) throw new ErreurMetier('Vérifiez d’abord le fichier')
    const rapport = importerCatalogue(
      base(),
      u.id,
      lireFichierImport(fichierVerifie),
      basename(fichierVerifie)
    )
    fichierVerifie = null
    return rapport
  })
}
