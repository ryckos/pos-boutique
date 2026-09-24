/**
 * Propriétaire : Dev A.
 *
 * Réimprimer un ticket par son numéro (tâche A3), depuis la caisse. Le serveur décide original ou
 * DUPLICATA et vérifie les droits : une caissière ne réimprime que les tickets de sa session en
 * cours, le gérant n'importe lequel (règles validées par Dev A, 2026-09-24).
 */
import { useState } from 'react'
import { appel } from '@renderer/lib/api'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'

interface Props {
  /** Numéro proposé : le dernier ticket de la caisse. */
  numeroInitial: string
  onReimprime: (numeroTicket: string, duplicata: boolean) => void
  onFermer: () => void
}

export function FenetreReimpression({ numeroInitial, onReimprime, onFermer }: Props): React.JSX.Element {
  const [numero, setNumero] = useState(numeroInitial)

  return (
    <FenetreFormulaire
      titre="Réimprimer un ticket"
      libelleValider="Réimprimer le ticket"
      valide={numero.trim() !== ''}
      onValider={async () => {
        const { duplicata } = await appel('caisse:reimprimerTicket', { numeroTicket: numero })
        onReimprime(numero.trim().toUpperCase(), duplicata)
      }}
      onFermer={onFermer}
    >
      <label className="champ champ-large">
        Numéro du ticket
        <input
          value={numero}
          placeholder="Ex : T-2026-000158"
          onChange={(e) => setNumero(e.target.value.toUpperCase())}
        />
      </label>
      <p className="formulaire-bloc vide">
        Un ticket déjà imprimé ressort avec la mention DUPLICATA. Vous pouvez réimprimer les tickets de votre
        session en cours ; pour un ticket plus ancien, demandez au gérant.
      </p>
    </FenetreFormulaire>
  )
}
