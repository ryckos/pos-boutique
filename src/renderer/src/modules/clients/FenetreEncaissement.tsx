/**
 * Encaisser un paiement d'un client sur ses créances (A12, REGLES_METIER § 7.3). Propriétaire : Dev A.
 * Espèces, TMoney ou Flooz (référence obligatoire). Sans créance choisie, la plus ancienne est payée
 * en premier. Le service revérifie tout : caisse ouverte, montant, répartition.
 */
import { useEffect, useState } from 'react'
import type { EncaissementEnregistre, FicheClient } from '@shared/ipc/clients'
import { formaterDate, formaterFCFA } from '@shared/format'
import { LIBELLES_MODE_ENCAISSEMENT, type ModeEncaissement } from '@shared/recouvrement'
import { appel } from '@renderer/lib/api'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import { lireMontant, manqueEncaissement } from './clients'

const MODES: ModeEncaissement[] = ['especes', 'tmoney', 'flooz']

export function FenetreEncaissement(props: {
  clientId: number
  onEncaisse: (r: EncaissementEnregistre) => void
  onFermer: () => void
}): React.JSX.Element {
  const [fiche, setFiche] = useState<FicheClient | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [montant, setMontant] = useState('')
  const [mode, setMode] = useState<ModeEncaissement>('especes')
  const [reference, setReference] = useState('')
  const [creanceId, setCreanceId] = useState<number | null>(null)

  useEffect(() => {
    appel('clients:lire', { clientId: props.clientId })
      .then((f) => {
        setFiche(f)
        setMontant(String(f.encours))
      })
      .catch((e: Error) => setErreur(e.message))
  }, [props.clientId])

  if (!fiche) {
    return (
      <div className="voile">
        <section className="fenetre" role="dialog" aria-modal="true" aria-label="Encaisser un paiement">
          {erreur ? (
            <p className="alerte" role="alert">
              {erreur}
            </p>
          ) : (
            <p className="vide">Chargement…</p>
          )}
          <button className="btn btn-secondaire" onClick={props.onFermer}>
            Fermer
          </button>
        </section>
      </div>
    )
  }

  const dues = fiche.creances.filter((c) => c.restantDu > 0)
  const choisie = dues.find((c) => c.id === creanceId)
  const du = choisie ? choisie.restantDu : fiche.encours
  const saisie = { montant, mode, reference }
  const probleme = manqueEncaissement(saisie, du)
  const valeur = lireMontant(montant)

  return (
    <FenetreFormulaire
      titre={`Encaisser un paiement — ${fiche.nom}`}
      libelleValider="Encaisser"
      valide={probleme === null}
      onFermer={props.onFermer}
      onValider={async () => {
        const r = await appel('clients:encaisserCreance', {
          clientId: fiche.id,
          montant: valeur ?? 0,
          mode,
          ...(mode !== 'especes' && { reference: reference.trim() }),
          ...(choisie && { creanceId: choisie.id })
        })
        props.onEncaisse(r)
      }}
    >
      <p className="formulaire-bloc">
        Le client doit <span className="montant">{formaterFCFA(fiche.encours)}</span>
        {dues.length > 1 && ` sur ${dues.length} crédits`}.
      </p>

      {dues.length > 1 && (
        <label className="champ champ-large">
          Payer le crédit
          <select
            value={creanceId ?? ''}
            onChange={(e) => {
              const id = e.target.value === '' ? null : Number(e.target.value)
              setCreanceId(id)
              const cible = dues.find((c) => c.id === id)
              setMontant(String(cible ? cible.restantDu : fiche.encours))
            }}
          >
            <option value="">Le plus ancien d’abord</option>
            {dues.map((c) => (
              <option key={c.id} value={c.id}>
                {c.numeroTicket} du {formaterDate(c.creeLe)} — reste {formaterFCFA(c.restantDu)}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="champ">
        Montant payé (FCFA)
        <input inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value)} />
      </label>

      <fieldset className="champ champ-large">
        <legend>Mode de paiement</legend>
        <div className="onglets">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              className={m === mode ? 'onglet actif' : 'onglet'}
              aria-pressed={m === mode}
              onClick={() => setMode(m)}
            >
              {LIBELLES_MODE_ENCAISSEMENT[m]}
            </button>
          ))}
        </div>
      </fieldset>

      {mode !== 'especes' && (
        <label className="champ champ-large">
          Référence du transfert
          <input
            value={reference}
            maxLength={40}
            placeholder="Ex : TM-123456"
            onChange={(e) => setReference(e.target.value)}
          />
        </label>
      )}

      {probleme && montant.trim() !== '' && <p className="alerte formulaire-bloc">{probleme}</p>}
      {probleme === null && valeur !== null && valeur < du && (
        <p className="vide formulaire-bloc">
          Paiement partiel : il restera {formaterFCFA(du - valeur)} à payer.
        </p>
      )}
      <p className="vide formulaire-bloc">
        {mode === 'especes'
          ? 'Les espèces entrent dans votre tiroir et sur le rapport de caisse.'
          : 'Le transfert mobile est déjà fait : il ne touche pas aux espèces du tiroir.'}
      </p>
    </FenetreFormulaire>
  )
}
