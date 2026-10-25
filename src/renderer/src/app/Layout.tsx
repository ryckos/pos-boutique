import { useRef } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import type { DefinitionRoute } from './types'
import { useUtilisateur } from './contexte'
import { Icone } from '@renderer/ui/Icone'
import { useInfobulle } from '@renderer/ui/BoutonIcone'

const LIBELLES_ROLE = { caissier: 'Caisse', gerant: 'Gérant', admin: 'Administrateur' } as const

export function Layout(props: { routes: DefinitionRoute[]; onDeconnexion: () => void }): React.JSX.Element {
  const u = useUtilisateur()
  return (
    <div className="coque">
      <nav className="menu" aria-label="Menu principal">
        <p className="menu-marque">
          <span className="menu-marque-logo">
            <Icone nom="boutique" />
          </span>
          <span className="menu-libelle">Ma Boutique</span>
        </p>
        <ul>
          {props.routes.map((r) => (
            <li key={r.chemin}>
              <LienMenu route={r} />
            </li>
          ))}
        </ul>
        <div className="menu-pied">
          <p>
            <span className="menu-avatar" aria-hidden="true">
              {u.nom.slice(0, 1).toUpperCase()}
            </span>
            <span className="menu-utilisateur">
              {u.nom}
              <span className="menu-role">{LIBELLES_ROLE[u.role]}</span>
            </span>
          </p>
          <button className="btn btn-discret" onClick={props.onDeconnexion} aria-label="Se déconnecter">
            <Icone nom="deconnexion" />
            <span className="menu-libelle">Se déconnecter</span>
          </button>
        </div>
      </nav>
      <main className="contenu">
        <Outlet />
      </main>
    </div>
  )
}

/**
 * Lien du menu. Menu replié (écran étroit), seule l'icône reste visible : son infobulle donne le nom
 * de la page, au survol comme à l'appui long.
 */
function LienMenu(props: { route: DefinitionRoute }): React.JSX.Element {
  const ref = useRef<HTMLAnchorElement>(null)
  const { infobulle, gestionnaires } = useInfobulle(ref, props.route.libelle)
  // Menu déplié : le libellé est déjà écrit, l'infobulle n'apporterait rien.
  const replie = (): boolean => window.matchMedia('(max-width: 1180px)').matches
  return (
    <>
      <NavLink
        ref={ref}
        to={props.route.chemin}
        className={({ isActive }) => (isActive ? 'actif' : undefined)}
        onPointerEnter={(e) => replie() && gestionnaires.onPointerEnter?.(e)}
        onPointerLeave={gestionnaires.onPointerLeave}
        onFocus={(e) => replie() && gestionnaires.onFocus?.(e)}
        onBlur={gestionnaires.onBlur}
      >
        <Icone nom={props.route.icone} />
        <span className="menu-libelle">{props.route.libelle}</span>
      </NavLink>
      {infobulle}
    </>
  )
}
