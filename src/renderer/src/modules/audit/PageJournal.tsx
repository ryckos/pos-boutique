/**
 * Journal des opérations : qui a fait quoi, quand, avec l'état avant et ce qui a changé.
 * Propriétaire : Dev B.
 * Admin seulement (matrice des droits). Lecture seule : le journal est immuable. Le texte de chaque
 * entrée est mis en mots par le processus principal (`detailsAudit`).
 */
import { useCallback, useEffect, useState } from 'react'
import type { DetailAudit } from '@shared/audit'
import type { ChoixJournal, EntreeJournal, FiltreJournal } from '@shared/ipc/audit'
import { formaterDate } from '@shared/format'
import { appel } from '@renderer/lib/api'

function texteDetails(details: DetailAudit[]): string {
  return details.map((d) => `${d.libelle} : ${d.valeur}`).join(' ; ')
}

export function PageJournal(): React.JSX.Element {
  const [du, setDu] = useState('')
  const [au, setAu] = useState('')
  const [utilisateurId, setUtilisateurId] = useState('')
  const [action, setAction] = useState('')
  const [choix, setChoix] = useState<ChoixJournal | null>(null)
  const [entrees, setEntrees] = useState<EntreeJournal[]>([])
  const [periode, setPeriode] = useState<{ du: string; au: string } | null>(null)
  const [suite, setSuite] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const filtre: FiltreJournal = {
    du: du || null,
    au: au || null,
    utilisateurId: utilisateurId ? Number(utilisateurId) : null,
    action: action || null
  }

  const charger = useCallback(
    (avantId: number | null) => {
      appel('audit:journal', { ...filtre, avantId })
        .then((p) => {
          setEntrees((deja) => (avantId === null ? p.entrees : [...deja, ...p.entrees]))
          setPeriode({ du: p.du, au: p.au })
          setSuite(p.suite)
          setErreur(null)
        })
        .catch((e: Error) => setErreur(e.message))
    },
    // Le filtre se résume à ces quatre champs : `filtre` est recréé à chaque rendu.
    [du, au, utilisateurId, action]
  )

  useEffect(() => charger(null), [charger])
  useEffect(() => {
    appel('audit:choix')
      .then(setChoix)
      .catch((e: Error) => setErreur(e.message))
  }, [])

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Journal des opérations</h1>
      </header>

      <div className="filtres">
        <label className="champ">
          Du
          <input
            type="date"
            value={du || periode?.du || ''}
            max={au || periode?.au}
            onChange={(e) => setDu(e.target.value)}
          />
        </label>
        <label className="champ">
          Au
          <input
            type="date"
            value={au || periode?.au || ''}
            min={du || periode?.du}
            onChange={(e) => setAu(e.target.value)}
          />
        </label>
        <label className="champ">
          Personne
          <select value={utilisateurId} onChange={(e) => setUtilisateurId(e.target.value)}>
            <option value="">Tout le monde</option>
            {choix?.utilisateurs.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nom}
                {u.actif ? '' : ' (désactivé)'}
              </option>
            ))}
          </select>
        </label>
        <label className="champ">
          Action
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">Toutes</option>
            {choix?.actions.map((a) => (
              <option key={a.action} value={a.action}>
                {a.libelle}
              </option>
            ))}
          </select>
        </label>
      </div>

      {erreur && (
        <p className="alerte" role="alert" style={{ marginBottom: 16 }}>
          {erreur}
        </p>
      )}

      {periode && entrees.length === 0 ? (
        <p className="vide">
          Aucune opération du {formaterDate(periode.du)} au {formaterDate(periode.au)} pour ce choix.
        </p>
      ) : (
        <div className="tableau-cadre">
          <table className="tableau">
            <thead>
              <tr>
                <th>Date et heure</th>
                <th>Personne</th>
                <th>Action</th>
                <th>Détail</th>
              </tr>
            </thead>
            <tbody>
              {entrees.map((e) => (
                <tr key={e.id}>
                  <td>
                    {formaterDate(e.horodatage)}
                    <span className="detail">{e.horodatage.slice(11, 16)}</span>
                  </td>
                  <td>{e.utilisateur}</td>
                  <td>{e.libelle}</td>
                  <td>
                    {e.apres.length > 0 && texteDetails(e.apres)}
                    {e.avant.length > 0 && <span className="detail">Avant : {texteDetails(e.avant)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {suite && (
        <p style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-secondaire" onClick={() => charger(entrees.at(-1)!.id)}>
            Afficher plus
          </button>
        </p>
      )}
    </div>
  )
}
