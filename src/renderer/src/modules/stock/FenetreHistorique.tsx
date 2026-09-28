/**
 * Historique d'un produit (B4, REGLES_METIER § 3.3, UI_UX § 5.16). Propriétaire : Dev B.
 * La réponse à « pourquoi il reste 41 boîtes » : le stock au début de la période, chaque mouvement
 * avec son document, son auteur et le stock après lui, puis le stock à la fin.
 */
import { useEffect, useState } from 'react'
import type { HistoriqueProduit } from '@shared/ipc/stock'
import { LIBELLES_MOUVEMENT } from '@shared/stock'
import { formaterDate, formaterQuantite } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import { texteRepartition } from './affichageStock'

interface Props {
  produitId: number
  nom: string
  onFermer: () => void
}

const signe = (q: number): string => (q > 0 ? `+${formaterQuantite(q)}` : `−${formaterQuantite(-q)}`)

/** « 2026-09-28 14:05:12 » → « 28/09/2026 14:05 ». */
const dateHeure = (horodatage: string): string => `${formaterDate(horodatage)} ${horodatage.slice(11, 16)}`

export function FenetreHistorique({ produitId, nom, onFermer }: Props): React.JSX.Element {
  const [historique, setHistorique] = useState<HistoriqueProduit | null>(null)
  const [du, setDu] = useState('')
  const [au, setAu] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)

  // Première ouverture : la période par défaut vient du service (30 derniers jours).
  useEffect(() => {
    appel('stock:historiqueProduit', { produitId })
      .then((h) => {
        setHistorique(h)
        setDu(h.du)
        setAu(h.au)
      })
      .catch((e: Error) => setErreur(e.message))
  }, [produitId])

  const afficher = async (): Promise<void> => {
    setHistorique(await appel('stock:historiqueProduit', { produitId, du, au }))
  }

  const h = historique
  return (
    <FenetreFormulaire
      titre={`Historique — ${nom}`}
      pastille={
        h && (
          <span className="pastille pastille-ok">
            Stock actuel : {formaterQuantite(h.stockActuel)}
            {h.repartition && ` ${texteRepartition(h.repartition)}`}
          </span>
        )
      }
      libelleValider="Afficher la période"
      valide={du !== '' && au !== '' && du <= au}
      large
      onValider={afficher}
      onFermer={onFermer}
    >
      <div className="filtres">
        <label className="champ">
          Du
          <input type="date" value={du} max={au || undefined} onChange={(e) => setDu(e.target.value)} />
        </label>
        <label className="champ">
          Au
          <input type="date" value={au} min={du || undefined} onChange={(e) => setAu(e.target.value)} />
        </label>
      </div>
      {erreur && (
        <p className="alerte" role="alert">
          {erreur}
        </p>
      )}

      {h && (
        <div className="tableau-cadre">
          <table className="tableau">
            <thead>
              <tr>
                <th>Date</th>
                <th>Mouvement</th>
                <th>Document</th>
                <th className="nombre">Quantité</th>
                <th className="nombre">Stock</th>
                <th>Par</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{formaterDate(h.du)}</td>
                <td colSpan={3}>Stock au début de la période</td>
                <td className="nombre">
                  <strong>{formaterQuantite(h.stockDebut)}</strong>
                </td>
                <td />
              </tr>
              {h.mouvements.length === 0 && (
                <tr>
                  <td colSpan={6} className="vide">
                    Aucun mouvement sur cette période.
                  </td>
                </tr>
              )}
              {h.mouvements.map((m) => (
                <tr key={m.id}>
                  <td>{dateHeure(m.horodatage)}</td>
                  <td>{LIBELLES_MOUVEMENT[m.type]}</td>
                  <td>
                    {m.document ?? ''}
                    {m.lot && <span className="detail">Lot {m.lot}</span>}
                    {m.motif && <span className="detail">{m.motif}</span>}
                  </td>
                  <td className="nombre">{signe(m.quantite)}</td>
                  <td className="nombre">{formaterQuantite(m.stockApres)}</td>
                  <td>{m.utilisateur}</td>
                </tr>
              ))}
              <tr>
                <td>{formaterDate(h.au)}</td>
                <td colSpan={3}>
                  <strong>Stock à la fin de la période</strong>
                </td>
                <td className="nombre">
                  <strong>{formaterQuantite(h.stockFin)}</strong>
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </FenetreFormulaire>
  )
}
