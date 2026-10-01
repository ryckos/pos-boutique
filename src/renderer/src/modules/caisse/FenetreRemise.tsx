/**
 * Propriétaire : Dev A.
 *
 * Remise sur une ligne ou sur le ticket (règle 6.6, A5), en francs. Le plafond de la caissière
 * porte sur le TOTAL des remises du ticket ; au-delà (ou si aucun plafond n'est fixé, D-A3), le
 * gérant choisit son nom et tape son code dans cette même fenêtre. Le principal vérifie le code et
 * remet un accord à usage unique : l'écran ne garde jamais le code. Montant 0 = retirer la remise.
 * Le service revérifie tout à l'encaissement.
 */
import { useEffect, useState } from 'react'
import type { AccordRemiseDonne } from '@shared/ipc/caisse'
import { formaterFCFA } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import { lireMontant } from './paiement'
import { totalRemisesAvec, type Panier } from './panier'

interface Props {
  panier: Panier
  /** Ligne remisée ; null = remise sur le ticket. */
  conditionnementId: number | null
  /** Ce que la remise peut au plus couvrir (montant de la ligne, ou sous-total du ticket). */
  maximum: number
  remiseActuelle: number
  /** Désignation de la ligne, ou null pour le ticket. */
  designation: string | null
  /** Plafond de la caissière ; null = non fixé (D-A3) ; sans objet pour le gérant. */
  plafond: number | null
  estCaissiere: boolean
  onAppliquer: (montant: number, accord?: AccordRemiseDonne) => void
  onFermer: () => void
}

export function FenetreRemise(props: Props): React.JSX.Element {
  const { panier, conditionnementId, maximum, plafond, estCaissiere } = props
  const [saisie, setSaisie] = useState(props.remiseActuelle > 0 ? String(props.remiseActuelle) : '')
  const [gerants, setGerants] = useState<{ id: number; nom: string }[]>([])
  const [gerantId, setGerantId] = useState<number | null>(null)
  const [code, setCode] = useState('')

  const montant = lireMontant(saisie)
  const total = totalRemisesAvec(panier, conditionnementId, montant)
  const accordSuffit = !!panier.accord && total <= panier.accord.montantMax
  const besoinAccord = estCaissiere && montant > 0 && total > (plafond ?? 0) && !accordSuffit
  const tropFort = montant > maximum

  useEffect(() => {
    if (!besoinAccord || gerants.length > 0) return
    appel('caisse:gerants')
      .then((g) => {
        setGerants(g)
        if (g.length === 1) setGerantId(g[0].id)
      })
      .catch(() => setGerants([]))
  }, [besoinAccord, gerants.length])

  const valide = !tropFort && (!besoinAccord || (gerantId !== null && /^\d{4}$/.test(code)))

  return (
    <FenetreFormulaire
      titre={conditionnementId === null ? 'Remise sur le ticket' : 'Remise sur la ligne'}
      libelleValider={montant === 0 ? 'Retirer la remise' : 'Appliquer la remise'}
      valide={valide}
      onValider={async () => {
        if (!besoinAccord) return props.onAppliquer(montant)
        // Le principal vérifie le code (verrouillage après 5 codes faux) ; une erreur reste dans la fenêtre.
        const accord = await appel('caisse:autoriserRemise', {
          utilisateurId: gerantId!,
          code,
          montant: total
        })
        props.onAppliquer(montant, accord)
      }}
      onFermer={props.onFermer}
    >
      {props.designation && <p className="formulaire-bloc">{props.designation}</p>}
      <label className="champ champ-large">
        Remise en francs
        <input
          inputMode="numeric"
          value={saisie}
          placeholder="Ex : 500"
          onFocus={(e) => e.target.select()}
          onChange={(e) => setSaisie(e.target.value.replace(/\D/g, ''))}
        />
      </label>
      <p className="formulaire-bloc remise-apercu">
        <span>
          {conditionnementId === null ? 'Total des articles' : 'Montant de la ligne'} :{' '}
          <span className="montant">{formaterFCFA(maximum)}</span>
        </span>
        <span>
          Après remise : <span className="montant">{formaterFCFA(Math.max(0, maximum - montant))}</span>
        </span>
      </p>
      {tropFort && <p className="alerte">La remise ne peut pas dépasser {formaterFCFA(maximum)}.</p>}

      {besoinAccord && !tropFort && (
        <div className="formulaire-bloc remise-accord">
          <p className="bandeau">
            {plafond === null || plafond === 0
              ? `Une remise demande l’accord du gérant (${formaterFCFA(total)} de remises sur ce ticket).`
              : `${formaterFCFA(total)} de remises sur ce ticket : au-delà de votre plafond de ${formaterFCFA(plafond)}.`}{' '}
            Le gérant choisit son nom et tape son code.
          </p>
          {gerants.length === 0 ? (
            <p className="vide">Aucun compte de gérant actif.</p>
          ) : (
            <div className="remise-gerants" role="radiogroup" aria-label="Gérant qui autorise">
              {gerants.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  role="radio"
                  aria-checked={g.id === gerantId}
                  className={g.id === gerantId ? 'btn' : 'btn btn-discret'}
                  onClick={() => setGerantId(g.id)}
                >
                  {g.nom}
                </button>
              ))}
            </div>
          )}
          <label className="champ">
            Code du gérant
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </label>
        </div>
      )}
      {!besoinAccord && panier.accord && accordSuffit && montant > 0 && estCaissiere && (
        <p className="formulaire-bloc vide">
          Couverte par l’accord de {panier.accord.gerant} (jusqu’à {formaterFCFA(panier.accord.montantMax)}).
        </p>
      )}
    </FenetreFormulaire>
  )
}
