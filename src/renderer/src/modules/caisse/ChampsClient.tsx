/**
 * Propriétaire : Dev A.
 *
 * Les quatre champs du client d'une facture ou d'une proforma (tâche A10) : nom obligatoire pour la
 * facture, le reste facultatif. Recopiés sur le document au moment T ; la fiche client viendra en A11.
 */
import { LONGUEUR_MAX_CHAMP, type SaisieClient } from './documents'

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
  return (
    <>
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
