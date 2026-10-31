/**
 * Propriétaire : Dev A.
 *
 * Les quatre champs du client d'une facture ou d'une proforma (tâche A10) : nom obligatoire pour la
 * facture, le reste facultatif. Recopiés sur le document au moment T. Un client enregistré (page Clients)
 * peut être choisi : ses coordonnées remplissent les champs, qui restent modifiables, et la fiche n'est
 * pas liée au document (une correction de la fiche ne change jamais une facture déjà émise).
 */
import { useState } from 'react'
import { LONGUEUR_MAX_CHAMP, type SaisieClient } from './documents'
import { FenetreChoixClient } from './FenetreChoixClient'

interface Props {
  saisie: SaisieClient
  onChange: (saisie: SaisieClient) => void
}

const CHAMPS: { cle: keyof SaisieClient; libelle: string; exemple: string; large?: boolean }[] = [
  { cle: 'nom', libelle: 'Nom ou raison sociale', exemple: 'Ex : Établissements Agbodjan', large: true },
  { cle: 'telephone', libelle: 'Téléphone', exemple: 'Ex : 90 12 34 56' },
  { cle: 'adresse', libelle: 'Adresse', exemple: 'Ex : Bè-Kpota, Lomé', large: true },
  { cle: 'nif', libelle: 'NIF', exemple: 'Numéro d’identification fiscale' }
]

export function ChampsClient({ saisie, onChange }: Props): React.JSX.Element {
  const [choixOuvert, setChoixOuvert] = useState(false)
  return (
    <>
      <div className="champ champ-large">
        <button type="button" className="btn btn-secondaire" onClick={() => setChoixOuvert(true)}>
          Choisir un client enregistré
        </button>
      </div>
      {choixOuvert && (
        <FenetreChoixClient
          usage="recopie"
          onChoisir={(c) => {
            onChange({ nom: c.nom, telephone: c.telephone ?? '', adresse: c.adresse ?? '', nif: c.nif ?? '' })
            setChoixOuvert(false)
          }}
          onFermer={() => setChoixOuvert(false)}
        />
      )}
      {CHAMPS.map((c) => (
        <label key={c.cle} className={c.large ? 'champ champ-large' : 'champ'}>
          {c.libelle}
          <input
            value={saisie[c.cle]}
            maxLength={LONGUEUR_MAX_CHAMP}
            placeholder={c.exemple}
            inputMode={c.cle === 'telephone' ? 'tel' : undefined}
            onChange={(e) => onChange({ ...saisie, [c.cle]: e.target.value })}
          />
        </label>
      ))}
    </>
  )
}
