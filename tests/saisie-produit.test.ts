import { describe, expect, it } from 'vitest'
import {
  champsDepuisFiche,
  champsVides,
  lireNombre,
  nouveauConditionnement,
  prixParUnite,
  saisieComplete,
  versSaisie,
  type ChampsProduit
} from '../src/renderer/src/modules/catalogue/saisieProduit'
import { ficheProduit, modifierProduit } from '../src/main/modules/catalogue/produits'
import { baseAvecDemo } from './aide'

/** Le jus d'ananas du scénario, tel que tapé dans la fiche. */
function jusTape(): ChampsProduit {
  const c = champsVides()
  c.nom = "Jus d'ananas Fruity 1L"
  c.seuil = '6'
  c.uniteVente = { ...c.uniteVente, prix: '600', codeBarres: ' 6034000012345 ' }
  c.conditionnements = [
    { ...nouveauConditionnement(), nom: 'Pack de 6', quantite: '6', prix: '3 300', bouton: true, ordre: '5' }
  ]
  return c
}

describe('Fiche produit : lecture des champs tapés', () => {
  it('lit les nombres à la française', () => {
    expect(lireNombre('3 300')).toBe(3300)
    expect(lireNombre('0,5')).toBe(0.5)
    expect(lireNombre('')).toBeNaN()
    expect(lireNombre('abc')).toBeNaN()
  })

  it('transforme la saisie du jus d’ananas en nombres, codes nettoyés', () => {
    const s = versSaisie(jusTape())
    expect(s.seuilAlerte).toBe(6)
    expect(s.uniteVente).toEqual({
      prixVente: 600,
      codeBarres: '6034000012345',
      codePlu: null,
      boutonTactile: false,
      ordreBouton: 0
    })
    expect(s.conditionnements).toEqual([
      {
        nom: 'Pack de 6',
        quantiteBase: 6,
        prixVente: 3300,
        codeBarres: null,
        codePlu: null,
        boutonTactile: true,
        ordreBouton: 5,
        actif: true
      }
    ])
  })

  it('n’allume « Créer le produit » que si l’essentiel est saisi', () => {
    expect(saisieComplete(jusTape())).toBe(true)
    expect(saisieComplete(champsVides())).toBe(false)
    const sansPrix = jusTape()
    sansPrix.conditionnements[0].prix = ''
    expect(saisieComplete(sansPrix)).toBe(false)
    const virgule = jusTape()
    virgule.uniteVente.prix = '600,5'
    expect(saisieComplete(virgule)).toBe(false)
  })

  it('ramène le prix à l’unité : carton de 24 à 7 500 F → 313 F', () => {
    expect(prixParUnite('7 500', '24')).toBe(313)
    expect(prixParUnite('1000', '3')).toBe(333)
    expect(prixParUnite('1000', '')).toBeNull()
  })

  it('renvoie la fiche de la tomate sans rien changer : aucun prix journalisé', () => {
    const db = baseAvecDemo()
    const champs = champsDepuisFiche(ficheProduit(db, 3))
    expect(champs.conditionnements.map((l) => [l.id !== undefined, l.nom, l.quantite])).toEqual([
      [true, 'Lot de 3', '3'],
      [true, 'Carton de 24', '24']
    ])
    modifierProduit(db, 1, 3, versSaisie(champs))
    expect(ficheProduit(db, 3).conditionnements.map((c) => c.prixVente)).toEqual([1000, 7500])
  })
})
