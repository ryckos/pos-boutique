/**
 * Paramètres de la boutique. Propriétaire : Dev B. Admin.
 * Trois blocs, chacun modifié dans sa fenêtre et enregistré à part (tout ou rien, journalisé).
 * Les réglages de l'imprimante n'y sont pas : ils sont dans « Réglages matériel » (Dev A, A3).
 */
import { useEffect, useState } from 'react'
import type { ParametresBoutique } from '@shared/ipc/parametres'
import { formaterFCFA } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import { champsDuGroupe, versModifications, type ChampsParametres, type Groupe } from './saisieParametres'

const TITRES: Record<Groupe, string> = {
  boutique: 'Boutique et ticket',
  stock: 'Stock',
  caisse: 'Caisse'
}

const nonRenseigne = <span className="vide">Non renseigné</span>

export function PageParametres(): React.JSX.Element {
  const [p, setP] = useState<ParametresBoutique | null>(null)
  const [groupe, setGroupe] = useState<Groupe | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)

  useEffect(() => {
    appel('parametres:lire')
      .then(setP)
      .catch((e: Error) => setErreur(e.message))
  }, [])

  const ouvrir = (g: Groupe): void => {
    setGroupe(g)
    setSucces(null)
  }

  /** Un refus remonte à la fenêtre, qui l'affiche et garde la saisie. */
  const enregistrer = async (g: Groupe, champs: ChampsParametres): Promise<void> => {
    setP(await appel('parametres:ecrire', versModifications(g, champs)))
    setGroupe(null)
    setSucces(`« ${TITRES[g]} » enregistré.`)
  }

  const bloc = (g: Groupe, lignes: Array<[string, React.ReactNode]>): React.JSX.Element => (
    <section className="panneau">
      <div className="panneau-entete">
        <h2>{TITRES[g]}</h2>
        <button className="btn btn-secondaire" onClick={() => ouvrir(g)}>
          Modifier
        </button>
      </div>
      <dl className="liste-valeurs">
        {lignes.map(([libelle, valeur]) => (
          <div key={libelle}>
            <dt>{libelle}</dt>
            <dd>{valeur}</dd>
          </div>
        ))}
      </dl>
    </section>
  )

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Paramètres</h1>
      </header>

      {succes && (
        <p className="succes" role="status" style={{ marginBottom: 16 }}>
          {succes}
        </p>
      )}
      {erreur && (
        <p className="alerte" role="alert" style={{ marginBottom: 16 }}>
          {erreur}
        </p>
      )}

      {p && (
        <>
          {bloc('boutique', [
            ['Nom (en haut du ticket)', p.boutiqueNom ?? nonRenseigne],
            ['Adresse', p.boutiqueAdresse ?? nonRenseigne],
            ['NIF', p.boutiqueNif ?? nonRenseigne],
            ['Pied du ticket', p.ticketPied]
          ])}
          {bloc('stock', [
            ['Péremptions à surveiller', `${p.peremptionSeuilJours} jours à l’avance`],
            ['Produit dormant après', `${p.dormantJours} jours sans vente`]
          ])}
          {bloc('caisse', [
            ['TVA proposée pour un nouveau produit', p.tvaDefaut === 18 ? '18 %' : '0 % (exonéré)'],
            [
              'Remise maximale sans gérant',
              p.plafondRemiseCaissier === null ? (
                nonRenseigne
              ) : (
                <span className="montant">{formaterFCFA(p.plafondRemiseCaissier)}</span>
              )
            ]
          ])}
        </>
      )}

      {p && groupe && (
        <FormulaireGroupe
          key={groupe}
          groupe={groupe}
          initial={champsDuGroupe(groupe, p)}
          onValider={(champs) => enregistrer(groupe, champs)}
          onFermer={() => setGroupe(null)}
        />
      )}
    </div>
  )
}

function FormulaireGroupe(props: {
  groupe: Groupe
  initial: ChampsParametres
  onValider: (champs: ChampsParametres) => Promise<void>
  onFermer: () => void
}): React.JSX.Element {
  const [c, setC] = useState(props.initial)
  const champ = (
    cle: string,
    libelle: string,
    options: { large?: boolean; aide?: string } = {}
  ): React.JSX.Element => (
    <label className={options.large ? 'champ champ-large' : 'champ'}>
      {libelle}
      <input value={c[cle]} onChange={(e) => setC({ ...c, [cle]: e.target.value })} />
      {options.aide && <span className="champ-aide">{options.aide}</span>}
    </label>
  )
  const modifie = Object.keys(c).some((k) => c[k] !== props.initial[k])
  const valide = modifie && (props.groupe !== 'boutique' || c.boutiqueNom.trim() !== '')

  return (
    <FenetreFormulaire
      titre={TITRES[props.groupe]}
      libelleValider="Enregistrer"
      valide={valide}
      onValider={() => props.onValider(c)}
      onFermer={props.onFermer}
    >
      {props.groupe === 'boutique' && (
        <>
          {champ('boutiqueNom', 'Nom de la boutique', { large: true })}
          {champ('boutiqueAdresse', 'Adresse', { large: true })}
          {champ('boutiqueNif', 'NIF')}
          {champ('ticketPied', 'Pied du ticket', { large: true, aide: 'Vide : « Merci de votre visite ! »' })}
        </>
      )}
      {props.groupe === 'stock' && (
        <>
          {champ('peremptionSeuilJours', 'Péremptions à surveiller (jours)')}
          {champ('dormantJours', 'Produit dormant après (jours)')}
        </>
      )}
      {props.groupe === 'caisse' && (
        <>
          <label className="champ">
            TVA proposée pour un nouveau produit
            <select value={c.tvaDefaut} onChange={(e) => setC({ ...c, tvaDefaut: e.target.value })}>
              <option value="18">18 %</option>
              <option value="0">0 % (exonéré)</option>
            </select>
          </label>
          {champ('plafondRemiseCaissier', 'Remise maximale sans gérant (F)', {
            aide: 'Vide : aucun plafond fixé'
          })}
        </>
      )}
    </FenetreFormulaire>
  )
}
