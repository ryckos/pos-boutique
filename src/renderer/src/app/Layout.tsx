import { NavLink, Outlet } from 'react-router-dom'
import type { DefinitionRoute } from './types'
import { useUtilisateur } from './contexte'

const LIBELLES_ROLE = { caissier: 'Caisse', gerant: 'Gérant', admin: 'Administrateur' } as const

export function Layout(props: { routes: DefinitionRoute[]; onDeconnexion: () => void }): React.JSX.Element {
  const u = useUtilisateur()
  return (
    <div className="coque">
      <nav className="menu">
        <p className="menu-marque">Ma Boutique</p>
        <ul>
          {props.routes.map((r) => (
            <li key={r.chemin}>
              <NavLink to={r.chemin} className={({ isActive }) => (isActive ? 'actif' : undefined)}>
                {r.libelle}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="menu-pied">
          <p>
            {u.nom}
            <span>{LIBELLES_ROLE[u.role]}</span>
          </p>
          <button className="btn btn-discret" onClick={props.onDeconnexion}>
            Se déconnecter
          </button>
        </div>
      </nav>
      <main className="contenu">
        <Outlet />
      </main>
    </div>
  )
}
