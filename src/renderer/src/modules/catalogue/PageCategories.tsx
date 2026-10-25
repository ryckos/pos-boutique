/**
 * Catégories de produits : rayons et sous-rayons (un seul niveau). Propriétaire : Dev B.
 * Gérant. Jamais de suppression : une catégorie vide se désactive. Les règles (nom unique au même
 * niveau, catégorie non vide) sont revérifiées par le processus principal.
 */
import { useCallback, useEffect, useState } from 'react'
import type { Categorie } from '@shared/ipc/catalogue'
import { appel } from '@renderer/lib/api'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import { BoutonIcone } from '@renderer/ui/BoutonIcone'
import { Icone } from '@renderer/ui/Icone'
import { Pagination } from '@renderer/ui/Pagination'
import { usePagination } from '@renderer/lib/pagination'
import { AideIcones } from '@renderer/ui/AideIcones'

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
  // 50 par page : un rayon reste le plus souvent sur la même page que ses sous-rayons.
  const pages = usePagination(categories, 50)

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Catégories</h1>
        <AideIcones
          entrees={[
            ['ajouter', 'Créer une catégorie, ou ajouter un sous-rayon à un rayon'],
            'renommer',
            ['desactiver', 'Désactiver une catégorie vide']
          ]}
          pagination
        />
        <button className="btn" onClick={() => ouvrir({ type: 'creer', parentId: null })}>
          <Icone nom="ajouter" />
          Créer une catégorie
        </button>
      </header>

      {succes && (
        <p className="succes page-message" role="status">
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
        <p className="alerte page-message" role="alert">
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
                <th className="colonne-actions">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pages.elements.map((c) => (
                <tr key={c.id} className={c.actif ? undefined : 'inactif'}>
                  <td className={c.parentId === null ? 'cellule-titre' : 'retrait'}>{c.nom}</td>
                  <td>{c.parentId === null ? 'Rayon' : `Sous-rayon de ${nomRayon(c.parentId)}`}</td>
                  <td className="nombre">{c.nbProduits}</td>
                  <td>
                    <span className={`pastille ${c.actif ? 'pastille-ok' : 'pastille-inactif'}`}>
                      {c.actif ? 'Active' : 'Désactivée'}
                    </span>
                  </td>
                  <td className="colonne-actions">
                    {c.actif && (
                      <div className="tableau-actions">
                        {c.parentId === null && (
                          <BoutonIcone
                            icone="ajouter"
                            libelle={`Ajouter un sous-rayon à « ${c.nom} »`}
                            onClick={() => ouvrir({ type: 'creer', parentId: c.id })}
                          />
                        )}
                        <BoutonIcone
                          icone="renommer"
                          libelle={`Renommer « ${c.nom} »`}
                          onClick={() => ouvrir({ type: 'renommer', categorie: c })}
                        />
                        <BoutonIcone
                          icone="desactiver"
                          variante="attention"
                          libelle={`Désactiver « ${c.nom} »`}
                          onClick={() => ouvrir({ type: 'desactiver', categorie: c })}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination pages={pages} />
      <p className="vide note-bas">
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
