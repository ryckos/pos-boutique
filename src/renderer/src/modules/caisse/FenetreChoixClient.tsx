/**
 * Propriétaire : Dev A.
 *
 * Choix d'un client enregistré (A11, REGLES_METIER § 7.1). On cherche par nom ou téléphone et on touche
 * le client. Pour une vente à crédit (`exigerCredit`), un client sans plafond est montré mais non
 * cliquable : il faut que le gérant fixe son plafond dans la fiche (page Clients). Sert aussi à remplir
 * une facture ou une proforma. Comme les autres fenêtres de caisse, elle garde `.voile` / `.fenetre` ;
 * un toucher à côté ne la ferme pas.
 */
import { useEffect, useState } from 'react'
import type { Client } from '@shared/ipc/clients'
import { formaterFCFA } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { resteDisponible, texteCredit } from '../clients/clients'

interface Props {
  /**
   * `credit` : seuls les clients à plafond > 0 sont choisissables. `avoir` : seuls ceux qui ont un avoir à
   * dépenser. `recopie` : tout client actif (facture, proforma, destinataire d'un avoir).
   */
  usage?: 'credit' | 'avoir' | 'recopie'
  onChoisir: (client: Client) => void
  onFermer: () => void
}

export function FenetreChoixClient({ usage = 'credit', onChoisir, onFermer }: Props): React.JSX.Element {
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
      if (e.key !== 'Escape') return
      // Ouverte par-dessus un formulaire (facture) : Échap ne ferme que cette fenêtre.
      e.stopImmediatePropagation()
      onFermer()
    }
    window.addEventListener('keydown', surTouche, true)
    return () => window.removeEventListener('keydown', surTouche, true)
  }, [onFermer])

  return (
    <div className="voile">
      <section className="fenetre" role="dialog" aria-modal="true" aria-label="Choisir le client">
        <h2>
          {usage === 'credit'
            ? 'Vente à crédit : quel client ?'
            : usage === 'avoir'
              ? 'Paiement par avoir : quel client ?'
              : 'Choisir un client enregistré'}
        </h2>
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
            {usage === 'credit'
              ? 'Aucun client trouvé. Le gérant peut le créer et fixer son plafond dans la page « Clients ».'
              : usage === 'avoir'
                ? 'Aucun client avec un avoir ne correspond. L’avoir naît d’un retour client remboursé en avoir.'
                : 'Aucun client trouvé. Créez-le dans la page « Clients », ou saisissez-le à la main.'}
          </p>
        ) : (
          <ul className="recherche-resultats">
            {clients.map((c) => {
              const possible =
                usage === 'recopie' || (usage === 'credit' ? c.plafondCredit > 0 : c.soldeAvoir > 0)
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
                      {usage === 'recopie'
                        ? (c.adresse ?? 'Sans adresse')
                        : usage === 'avoir'
                          ? `Avoir disponible : ${formaterFCFA(c.soldeAvoir)}`
                          : possible
                            ? `${texteCredit(c)} (encours ${formaterFCFA(c.encours)})`
                            : 'Aucun crédit autorisé : voyez le gérant'}
                    </span>
                    {usage === 'credit' && possible && resteDisponible(c) === 0 && (
                      <span className="pastille pastille-alerte">Plafond atteint</span>
                    )}
                    {usage === 'credit' && c.enRetard > 0 && (
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
