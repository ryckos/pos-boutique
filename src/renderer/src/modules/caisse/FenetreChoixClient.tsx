/**
 * Propriétaire : Dev A.
 *
 * Choix du client d'une vente à crédit (A11, REGLES_METIER § 7.1). On cherche par nom ou téléphone et
 * on touche le client. Un client sans plafond de crédit est montré mais non cliquable : il faut que le
 * gérant fixe son plafond dans la fiche (page Clients). Comme les autres fenêtres de caisse, elle garde
 * `.voile` / `.fenetre` ; un toucher à côté ne la ferme pas.
 */
import { useEffect, useState } from 'react'
import type { Client } from '@shared/ipc/clients'
import { formaterFCFA } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { resteDisponible, texteCredit } from '../clients/clients'

interface Props {
  onChoisir: (client: Client) => void
  onFermer: () => void
}

export function FenetreChoixClient({ onChoisir, onFermer }: Props): React.JSX.Element {
  const [texte, setTexte] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [erreur, setErreur] = useState<string | null>(null)

  // 200 ms après la dernière frappe, comme la recherche de produits.
  useEffect(() => {
    const minuteur = setTimeout(() => {
      appel('clients:rechercher', { texte })
        .then((liste) => {
          setClients(liste)
          setErreur(null)
        })
        .catch((e: Error) => setErreur(e.message))
    }, 200)
    return () => clearTimeout(minuteur)
  }, [texte])

  useEffect(() => {
    const surTouche = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onFermer()
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [onFermer])

  return (
    <div className="voile">
      <section className="fenetre" role="dialog" aria-modal="true" aria-label="Choisir le client">
        <h2>Vente à crédit : quel client ?</h2>
        <label className="champ champ-large">
          Nom ou téléphone
          <input
            autoFocus
            autoComplete="off"
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            placeholder="Ex. : Akouvi ou 90 00 00 00"
          />
        </label>

        {erreur && (
          <p className="alerte" role="alert">
            {erreur}
          </p>
        )}

        {clients.length === 0 ? (
          <p className="vide">
            Aucun client trouvé. Le gérant peut le créer et fixer son plafond dans la page « Clients ».
          </p>
        ) : (
          <ul className="recherche-resultats">
            {clients.map((c) => {
              const possible = c.plafondCredit > 0
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className="recherche-resultat"
                    disabled={!possible}
                    onClick={() => onChoisir(c)}
                  >
                    <span className="cellule-titre">{c.nom}</span>
                    <span className="detail">
                      {c.telephone ?? 'Sans téléphone'} ·{' '}
                      {possible
                        ? `${texteCredit(c)} (encours ${formaterFCFA(c.encours)})`
                        : 'Aucun crédit autorisé : voyez le gérant'}
                    </span>
                    {possible && resteDisponible(c) === 0 && (
                      <span className="pastille pastille-alerte">Plafond atteint</span>
                    )}
                    {c.enRetard > 0 && (
                      <span className="pastille pastille-erreur">En retard : {formaterFCFA(c.enRetard)}</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <button type="button" className="btn btn-secondaire" onClick={onFermer}>
          Revenir au ticket (Échap)
        </button>
      </section>
    </div>
  )
}
