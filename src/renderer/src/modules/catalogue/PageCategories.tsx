/**
 * Catégories de produits : rayons et sous-rayons (un seul niveau). Propriétaire : Dev B.
 * Gérant. Jamais de suppression : une catégorie vide se désactive. Les règles (nom unique au même
 * niveau, catégorie non vide) sont revérifiées par le processus principal.
 */
import { useCallback, useEffect, useState } from 'react'
import type { Categorie } from '@shared/ipc/catalogue'
import { appel } from '@renderer/lib/api'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'

type Action =
  | { type: 'creer'; parentId: number | null }
  | { type: 'renommer' | 'desactiver'; categorie: Categorie }
  | null

export function PageCategories(): React.JSX.Element {
  const [categories, setCategories] = useState<Categorie[]>([])
  const [action, setAction] = useState<Action>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)

  const charger = useCallback(() => {
    appel('catalogue:categories')
      .then(setCategories)
      .catch((e: Error) => setErreur(e.message))
  }, [])

  useEffect(charger, [charger])

  const ouvrir = (a: Action): void => {
    setAction(a)
    setErreur(null)
    setSucces(null)
  }

  /** Exécute l'action, puis ferme la fenêtre et recharge. Un refus remonte à la fenêtre, qui l'affiche et garde la saisie. */
  const executer = async (travail: () => Promise<unknown>, message: string): Promise<void> => {
    setErreur(null)
    await travail()
    setAction(null)
    setSucces(message)
    charger()
  }

  const rayonsActifs = categories.filter((c) => c.actif && c.parentId === null)
  const nomRayon = (id: number | null): string => categories.find((c) => c.id === id)?.nom ?? ''

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Catégories</h1>
        <button className="btn" onClick={() => ouvrir({ type: 'creer', parentId: null })}>
          Créer une catégorie
        </button>
      </header>

      {succes && (
        <p className="succes" role="status" style={{ marginBottom: 16 }}>
          {succes}
        </p>
      )}

      {action?.type === 'creer' && (
        <FormulaireCreation
          key={action.parentId ?? 0}
          rayons={rayonsActifs}
          parentInitial={action.parentId}
          onFermer={() => ouvrir(null)}
          onValider={(nom, parentId) =>
            executer(
              () => appel('catalogue:creerCategorie', { nom, parentId }),
              parentId === null
                ? `Rayon « ${nom.trim()} » créé.`
                : `Sous-rayon « ${nom.trim()} » créé dans « ${nomRayon(parentId)} ».`
            )
          }
        />
      )}
      {action?.type === 'renommer' && (
        <FormulaireRenommage
          key={action.categorie.id}
          categorie={action.categorie}
          onFermer={() => ouvrir(null)}
          onValider={(nom) =>
            executer(
              () => appel('catalogue:renommerCategorie', { id: action.categorie.id, nom }),
              `« ${action.categorie.nom} » s’appelle maintenant « ${nom.trim()} ».`
            )
          }
        />
      )}
      {action?.type === 'desactiver' && (
        <FenetreFormulaire
          key={action.categorie.id}
          titre={`Désactiver « ${action.categorie.nom} »`}
          libelleValider="Désactiver la catégorie"
          attention
          valide
          onFermer={() => ouvrir(null)}
          onValider={() =>
            executer(
              () => appel('catalogue:desactiverCategorie', { id: action.categorie.id }),
              `Catégorie « ${action.categorie.nom} » désactivée.`
            )
          }
        >
          <p className="vide champ-large">
            Elle ne sera plus proposée pour les produits. Seule une catégorie vide peut être désactivée.
          </p>
        </FenetreFormulaire>
      )}

      {erreur && (
        <p className="alerte" role="alert" style={{ marginBottom: 16 }}>
          {erreur}
        </p>
      )}

      {categories.length === 0 ? (
        <p className="vide">Aucune catégorie. Créez un premier rayon, par exemple « Alimentation ».</p>
      ) : (
        <div className="tableau-cadre">
          <table className="tableau">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Place</th>
                <th className="nombre">Produits</th>
                <th>État</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className={c.actif ? undefined : 'inactif'}>
                  <td className={c.parentId === null ? undefined : 'retrait'}>{c.nom}</td>
                  <td>{c.parentId === null ? 'Rayon' : `Sous-rayon de ${nomRayon(c.parentId)}`}</td>
                  <td className="nombre">{c.nbProduits}</td>
                  <td>
                    <span className={`pastille ${c.actif ? 'pastille-ok' : 'pastille-inactif'}`}>
                      {c.actif ? 'Active' : 'Désactivée'}
                    </span>
                  </td>
                  <td>
                    {c.actif && (
                      <div className="tableau-actions">
                        {c.parentId === null && (
                          <button
                            className="btn btn-secondaire"
                            onClick={() => ouvrir({ type: 'creer', parentId: c.id })}
                          >
                            Ajouter un sous-rayon
                          </button>
                        )}
                        <button
                          className="btn btn-secondaire"
                          onClick={() => ouvrir({ type: 'renommer', categorie: c })}
                        >
                          Renommer
                        </button>
                        <button
                          className="btn btn-attention"
                          onClick={() => ouvrir({ type: 'desactiver', categorie: c })}
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
      <p className="vide" style={{ marginTop: 12 }}>
        Les rayons donnent les onglets de la caisse. Un sous-rayon ne peut pas contenir d’autres catégories.
      </p>
    </div>
  )
}

function FormulaireCreation(props: {
  rayons: Categorie[]
  parentInitial: number | null
  onValider: (nom: string, parentId: number | null) => Promise<void>
  onFermer: () => void
}): React.JSX.Element {
  const [nom, setNom] = useState('')
  const [parentId, setParentId] = useState<number | null>(props.parentInitial)
  return (
    <FenetreFormulaire
      titre={parentId === null ? 'Nouveau rayon' : 'Nouveau sous-rayon'}
      libelleValider="Créer la catégorie"
      valide={nom.trim() !== ''}
      onValider={() => props.onValider(nom, parentId)}
      onFermer={props.onFermer}
    >
      <label className="champ champ-large">
        Nom
        <input autoFocus value={nom} onChange={(e) => setNom(e.target.value)} />
      </label>
      <label className="champ">
        Place
        <select
          value={parentId ?? ''}
          onChange={(e) => setParentId(e.target.value === '' ? null : Number(e.target.value))}
        >
          <option value="">Rayon principal</option>
          {props.rayons.map((r) => (
            <option key={r.id} value={r.id}>
              Sous-rayon de {r.nom}
            </option>
          ))}
        </select>
      </label>
    </FenetreFormulaire>
  )
}

function FormulaireRenommage(props: {
  categorie: Categorie
  onValider: (nom: string) => Promise<void>
  onFermer: () => void
}): React.JSX.Element {
  const [nom, setNom] = useState(props.categorie.nom)
  return (
    <FenetreFormulaire
      titre={`Renommer « ${props.categorie.nom} »`}
      libelleValider="Renommer la catégorie"
      valide={nom.trim() !== '' && nom.trim() !== props.categorie.nom}
      onValider={() => props.onValider(nom)}
      onFermer={props.onFermer}
    >
      <label className="champ champ-large">
        Nouveau nom
        <input autoFocus value={nom} onChange={(e) => setNom(e.target.value)} />
      </label>
    </FenetreFormulaire>
  )
}
