/**
 * Propriétaire : Dev A.
 *
 * Sans session ouverte, l'écran de caisse n'affiche que « Ouvrir la caisse » (UI_UX § 5.2,
 * règle 6.1). La saisie du fond se fait dans la fenêtre commune FenetreFormulaire (règle des
 * formulaires en fenêtre modale, UI_UX § 3).
 */
import { useState } from 'react'
import type { SessionCaisse } from '@shared/ipc/caisse'
import { formaterFCFA } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import { lireMontant } from './paiement'

interface Props {
  nomCaissier: string
  onOuverte: (session: SessionCaisse) => void
}

export function OuvertureCaisse({ nomCaissier, onOuverte }: Props): React.JSX.Element {
  const [fenetreOuverte, setFenetreOuverte] = useState(true)
  const [fond, setFond] = useState('')

  return (
    <div className="caisse-fermee">
      <h1>Caisse fermée</h1>
      <p className="vide">
        {nomCaissier}, comptez les espèces du tiroir puis ouvrez la caisse pour commencer à vendre.
      </p>
      <button className="btn caisse-ouvrir" onClick={() => setFenetreOuverte(true)}>
        Ouvrir la caisse
      </button>

      {fenetreOuverte && (
        <FenetreFormulaire
          titre="Ouvrir la caisse"
          libelleValider="Ouvrir la caisse"
          valide={fond.trim() !== ''}
          onValider={async () => {
            onOuverte(await appel('caisse:ouvrirSession', { fondOuverture: lireMontant(fond) }))
          }}
          onFermer={() => setFenetreOuverte(false)}
        >
          <label className="champ champ-large">
            Fond de caisse : espèces dans le tiroir à l’ouverture
            <input
              inputMode="numeric"
              value={fond}
              placeholder="Ex : 10000"
              onChange={(e) => setFond(e.target.value)}
            />
          </label>
          {fond.trim() !== '' && (
            <p className="formulaire-bloc vide">Fond déclaré : {formaterFCFA(lireMontant(fond))}</p>
          )}
        </FenetreFormulaire>
      )}
    </div>
  )
}
