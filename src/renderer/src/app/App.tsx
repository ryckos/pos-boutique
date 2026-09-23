import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { UtilisateurConnecte } from '@shared/types'
import { appel } from '@renderer/lib/api'
import { PageConnexion } from '@renderer/modules/auth/PageConnexion'
import { PagePremierDemarrage } from '@renderer/modules/auth/PagePremierDemarrage'
import { ContexteUtilisateur } from './contexte'
import { Layout } from './Layout'
import { routes } from './routes'

export default function App(): React.JSX.Element | null {
  const [utilisateur, setUtilisateur] = useState<UtilisateurConnecte | null>(null)
  const [premierDemarrage, setPremierDemarrage] = useState(false)
  const [pret, setPret] = useState(false)

  useEffect(() => {
    Promise.all([appel('auth:utilisateurCourant'), appel('auth:etatDemarrage')])
      .then(([u, etat]) => {
        setUtilisateur(u)
        setPremierDemarrage(etat.premierDemarrage)
      })
      .finally(() => setPret(true))
  }, [])

  if (!pret) return null
  if (!utilisateur && premierDemarrage) {
    return (
      <PagePremierDemarrage
        onCree={(u) => {
          setPremierDemarrage(false)
          setUtilisateur(u)
        }}
      />
    )
  }
  if (!utilisateur) return <PageConnexion onConnexion={setUtilisateur} />

  const autorisees = routes.filter((r) => utilisateur.role === 'admin' || r.roles.includes(utilisateur.role))
  const deconnexion = async (): Promise<void> => {
    await appel('auth:deconnexion')
    setUtilisateur(null)
  }

  return (
    <ContexteUtilisateur.Provider value={utilisateur}>
      <HashRouter>
        <Routes>
          <Route element={<Layout routes={autorisees} onDeconnexion={deconnexion} />}>
            {autorisees.map((r) => (
              <Route key={r.chemin} path={r.chemin} element={r.element} />
            ))}
            <Route path="*" element={<Navigate to={autorisees[0]?.chemin ?? '/'} replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </ContexteUtilisateur.Provider>
  )
}
