/**
 * Produits du catalogue : liste, création, modification, désactivation. Propriétaire : Dev B.
 * Gérant. Jamais de suppression : un produit se désactive, avec un motif (REGLES_METIER § 2.2).
 */
import { useCallback, useEffect, useState } from 'react'
import type { AlertePrix } from '@shared/catalogue'
import type { Categorie, LigneProduit } from '@shared/ipc/catalogue'
import { formaterFCFA, formaterQuantite } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import { FenetreProduit } from './FenetreProduit'

type Action =
  | { type: 'creer' }
  | { type: 'modifier'; produitId: number }
  | { type: 'desactiver'; produit: LigneProduit }
  | null

/** Minuscules sans accents : « pate » trouve « Pâte ». */
const normaliser = (t: string): string => t.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr')

export function PageProduits(): React.JSX.Element {
  const [produits, setProduits] = useState<LigneProduit[]>([])
  const [rayons, setRayons] = useState<Categorie[]>([])
  const [filtreRayon, setFiltreRayon] = useState<string>('')
  const [recherche, setRecherche] = useState('')
  const [action, setAction] = useState<Action>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)
  const [alertes, setAlertes] = useState<AlertePrix[]>([])

  const charger = useCallback(() => {
    appel('catalogue:listeProduits')
      .then(setProduits)
      .catch((e: Error) => setErreur(e.message))
    appel('catalogue:categories')
      .then((c) => setRayons(c.filter((r) => r.actif && r.parentId === null)))
      .catch((e: Error) => setErreur(e.message))
  }, [])

  useEffect(charger, [charger])

  const ouvrir = (a: Action): void => {
    setAction(a)
    setErreur(null)
    setSucces(null)
    setAlertes([])
  }

  const apresEnregistrement = (message: string, alertesPrix: AlertePrix[] = []): void => {
    setAction(null)
    setSucces(message)
    setAlertes(alertesPrix)
    charger()
  }

  const cle = normaliser(recherche.trim())
  const visibles = produits.filter(
    (p) =>
      (filtreRayon === '' || (p.categorie ?? '').split(' › ')[0] === filtreRayon) &&
      (cle === '' || normaliser(p.nom).includes(cle))
  )

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Produits</h1>
        <button className="btn" onClick={() => ouvrir({ type: 'creer' })}>
          Nouveau produit
        </button>
      </header>

      {succes && (
        <p className="succes" role="status" style={{ marginBottom: 16 }}>
          {succes}
        </p>
      )}
      {alertes.map((a) => (
        <p key={a.conditionnement} className="bandeau" role="status" style={{ marginBottom: 16 }}>
          Attention : « {a.conditionnement} » à {formaterFCFA(a.prixVente)} coûte plus cher que la même
          quantité à l’unité ({formaterFCFA(a.prixALUnite)}). Corrigez le prix si ce n’est pas voulu.
        </p>
      ))}
      {erreur && (
        <p className="alerte" role="alert" style={{ marginBottom: 16 }}>
          {erreur}
        </p>
      )}

      {action?.type === 'creer' && (
        <FenetreProduit
          onFermer={() => ouvrir(null)}
          onEnregistre={(nom, a) => apresEnregistrement(`« ${nom} » est créé et se vend dès maintenant.`, a)}
        />
      )}
      {action?.type === 'modifier' && (
        <FenetreProduit
          key={action.produitId}
          produitId={action.produitId}
          onFermer={() => ouvrir(null)}
          onEnregistre={(nom, a) => apresEnregistrement(`« ${nom} » est enregistré.`, a)}
        />
      )}
      {action?.type === 'desactiver' && (
        <FormulaireDesactivation
          key={action.produit.id}
          produit={action.produit}
          onFermer={() => ouvrir(null)}
          onValider={async (motif) => {
            await appel('catalogue:desactiverProduit', { id: action.produit.id, motif })
            apresEnregistrement(`« ${action.produit.nom} » est désactivé : il ne se vend plus.`)
          }}
        />
      )}

      <div className="filtres">
        <label className="champ champ-large">
          Rechercher
          <input
            placeholder="Nom du produit"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </label>
        <label className="champ">
          Rayon
          <select value={filtreRayon} onChange={(e) => setFiltreRayon(e.target.value)}>
            <option value="">Tous les rayons</option>
            {rayons.map((r) => (
              <option key={r.id} value={r.nom}>
                {r.nom}
              </option>
            ))}
          </select>
        </label>
      </div>

      {produits.length === 0 ? (
        <p className="vide">Aucun produit. Créez le premier avec « Nouveau produit ».</p>
      ) : visibles.length === 0 ? (
        <p className="vide">Aucun produit ne correspond à cette recherche.</p>
      ) : (
        <div className="tableau-cadre">
          <table className="tableau">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Catégorie</th>
                <th className="nombre">Prix unité</th>
                <th className="nombre">TVA</th>
                <th className="nombre">Conditionnements</th>
                <th className="nombre">Stock</th>
                <th>État</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => (
                <tr key={p.id} className={p.actif ? undefined : 'inactif'}>
                  <td>{p.nom}</td>
                  <td>{p.categorie ?? 'Non classé'}</td>
                  <td className="nombre montant">{formaterFCFA(p.prixUnite)}</td>
                  <td className="nombre">{p.tauxTva} %</td>
                  <td className="nombre">{p.nbConditionnements}</td>
                  <td className="nombre">{formaterQuantite(p.stockActuel)}</td>
                  <td>
                    <span className={`pastille ${p.actif ? 'pastille-ok' : 'pastille-inactif'}`}>
                      {p.actif ? 'En vente' : 'Désactivé'}
                    </span>
                  </td>
                  <td>
                    {p.actif && (
                      <div className="tableau-actions">
                        <button
                          className="btn btn-secondaire"
                          onClick={() => ouvrir({ type: 'modifier', produitId: p.id })}
                        >
                          Modifier
                        </button>
                        <button
                          className="btn btn-attention"
                          onClick={() => ouvrir({ type: 'desactiver', produit: p })}
                        >
                          Désactiver
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function FormulaireDesactivation(props: {
  produit: LigneProduit
  onValider: (motif: string) => Promise<void>
  onFermer: () => void
}): React.JSX.Element {
  const [motif, setMotif] = useState('')
  const { produit } = props
  return (
    <FenetreFormulaire
      titre={`Désactiver « ${produit.nom} »`}
      libelleValider="Désactiver le produit"
      attention
      valide={motif.trim() !== ''}
      onValider={() => props.onValider(motif)}
      onFermer={props.onFermer}
    >
      <p className="vide formulaire-bloc">
        Il ne sera plus vendu. Son historique (ventes, mouvements de stock) est conservé.
      </p>
      {produit.stockActuel > 0 && (
        <p className="bandeau formulaire-bloc">
          Il reste {formaterQuantite(produit.stockActuel)} en stock. Ce stock sera noté au journal ; pensez à
          le sortir (casse, retour fournisseur) s’il n’est plus en rayon.
        </p>
      )}
      <label className="champ champ-large">
        Motif
        <input placeholder="Ex. : plus fabriqué" value={motif} onChange={(e) => setMotif(e.target.value)} />
      </label>
    </FenetreFormulaire>
  )
}
