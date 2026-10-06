/**
 * Dettes d'un fournisseur et règlements (B10, REGLES_METIER § 4.5, UI_UX § 5.17). Propriétaire : Dev B.
 * L'échéancier par réception, les règlements (annulés compris), « Enregistrer un règlement » et
 * « Annuler » un règlement mal saisi. Le processus principal relit le reste dû et revérifie tout.
 */
import { useCallback, useEffect, useState } from 'react'
import type { DettesFournisseur, ModeReglement, ReglementFournisseur } from '@shared/ipc/fournisseurs'
import { LIBELLES_MODE_REGLEMENT } from '@shared/fournisseurs'
import { formaterDate, formaterFCFA } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import {
  GLOBAL,
  libelleReception,
  lireMontant,
  manqueReglement,
  resteAPayer,
  texteEcheance
} from './saisieReglement'

interface Props {
  fournisseurId: number
  nom: string
  /** « Payer » ouvre directement la saisie d'un règlement. */
  payer?: boolean
  /** Après un règlement ou une annulation : la page recharge la liste et affiche le message. */
  onChangement: (message: string) => void
  onFermer: () => void
}

type Vue = { type: 'dettes' } | { type: 'payer' } | { type: 'annuler'; reglement: ReglementFournisseur }

/** Date du jour du poste, AAAA-MM-JJ. */
function aujourdhuiLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function FenetreDettes(props: Props): React.JSX.Element | null {
  const { fournisseurId, nom, onChangement, onFermer } = props
  const [dettes, setDettes] = useState<DettesFournisseur | null>(null)
  const [vue, setVue] = useState<Vue>({ type: props.payer ? 'payer' : 'dettes' })
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(async () => {
    setDettes(await appel('fournisseurs:dettes', { fournisseurId }))
    setErreur(null)
  }, [fournisseurId])
  useEffect(() => {
    charger().catch((e: Error) => setErreur(e.message))
  }, [charger])

  // Ouverte par « Payer » : la saisie finie (ou fermée), on revient à la page, pas à l'échéancier.
  const [depuisPayer] = useState(Boolean(props.payer))

  /** Après une écriture : la page recharge ; on revient à l'échéancier rechargé, ou à la page. */
  const apres = async (message: string, versPage: boolean): Promise<void> => {
    onChangement(message)
    if (versPage) return onFermer()
    await charger()
    setVue({ type: 'dettes' })
  }
  const retour = (): void => (depuisPayer && vue.type === 'payer' ? onFermer() : setVue({ type: 'dettes' }))

  if (!dettes) {
    return erreur ? (
      <FenetreFormulaire
        titre={`Dettes — ${nom}`}
        libelleValider="Réessayer"
        valide
        onValider={charger}
        onFermer={onFermer}
      >
        <p className="alerte formulaire-bloc" role="alert">
          {erreur}
        </p>
      </FenetreFormulaire>
    ) : null
  }

  if (vue.type === 'payer') {
    return (
      <FormulaireReglement
        dettes={dettes}
        onFermer={retour}
        onValider={async (s) => {
          await appel('fournisseurs:enregistrerReglement', { fournisseurId, ...s })
          await apres(`Règlement de ${formaterFCFA(s.montant)} à « ${nom} » enregistré.`, depuisPayer)
        }}
      />
    )
  }
  if (vue.type === 'annuler') {
    const r = vue.reglement
    return (
      <FormulaireAnnulation
        reglement={r}
        onFermer={() => setVue({ type: 'dettes' })}
        onValider={async (motif) => {
          await appel('fournisseurs:annulerReglement', { id: r.id, motif })
          await apres(`Règlement de ${formaterFCFA(r.montant)} du ${formaterDate(r.date)} annulé.`, false)
        }}
      />
    )
  }

  return (
    <FenetreFormulaire
      titre={`Dettes — ${nom}`}
      pastille={
        <span className={`pastille ${dettes.enRetard > 0 ? 'pastille-erreur' : 'pastille-ok'}`}>
          Dû : {formaterFCFA(dettes.soldeDu)}
          {dettes.enRetard > 0 && ` · en retard : ${formaterFCFA(dettes.enRetard)}`}
        </span>
      }
      libelleValider="Enregistrer un règlement"
      valide={dettes.actif && dettes.soldeDu > 0}
      large
      onValider={async () => setVue({ type: 'payer' })}
      onFermer={onFermer}
    >
      {erreur && (
        <p className="alerte formulaire-bloc" role="alert">
          {erreur}
        </p>
      )}
      <div className="formulaire-bloc">
        <h3>Échéancier</h3>
        {dettes.echeances.length === 0 ? (
          <p className="vide">Aucune livraison à payer.</p>
        ) : (
          <div className="tableau-cadre">
            <table className="tableau">
              <thead>
                <tr>
                  <th>Réception</th>
                  <th className="nombre">Total</th>
                  <th className="nombre">Réglé</th>
                  <th className="nombre">Reste</th>
                  <th>Échéance</th>
                </tr>
              </thead>
              <tbody>
                {dettes.echeances.map((e) => (
                  <tr key={e.receptionId} className={e.etat === 'en_retard' ? 'ligne-urgente' : undefined}>
                    <td>
                      {e.numero}
                      <span className="detail">reçue le {formaterDate(e.dateReception)}</span>
                    </td>
                    <td className="nombre montant">{formaterFCFA(e.total)}</td>
                    <td className="nombre montant">{formaterFCFA(e.regle)}</td>
                    <td className="nombre montant">{formaterFCFA(e.reste)}</td>
                    <td>
                      <span
                        className={`pastille ${
                          e.etat === 'soldee'
                            ? 'pastille-ok'
                            : e.etat === 'en_retard'
                              ? 'pastille-erreur'
                              : 'pastille-alerte'
                        }`}
                      >
                        {texteEcheance(e)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h3>Règlements</h3>
        {dettes.reglements.length === 0 ? (
          <p className="vide">Aucun règlement enregistré.</p>
        ) : (
          <div className="tableau-cadre">
            <table className="tableau">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="nombre">Montant</th>
                  <th>Mode</th>
                  <th>Pour</th>
                  <th>Par</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {dettes.reglements.map((r) => (
                  <tr key={r.id} className={r.annuleLe ? 'inactif' : undefined}>
                    <td>{formaterDate(r.date)}</td>
                    <td className="nombre montant">{formaterFCFA(r.montant)}</td>
                    <td>
                      {LIBELLES_MODE_REGLEMENT[r.mode]}
                      {r.reference && <span className="detail">{r.reference}</span>}
                    </td>
                    <td>{r.reception ?? 'Solde global'}</td>
                    <td>{r.utilisateur}</td>
                    <td>
                      {r.annuleLe ? (
                        <>
                          <span className="pastille pastille-inactif">Annulé</span>
                          <span className="detail">
                            le {formaterDate(r.annuleLe)} par {r.annulePar} : {r.motifAnnulation}
                          </span>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-attention"
                          onClick={() => setVue({ type: 'annuler', reglement: r })}
                        >
                          Annuler
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </FenetreFormulaire>
  )
}

interface SaisieEcran {
  receptionId: number | null
  montant: number
  mode: ModeReglement
  reference: string
  date: string
}

function FormulaireReglement(props: {
  dettes: DettesFournisseur
  onValider: (s: SaisieEcran) => Promise<void>
  onFermer: () => void
}): React.JSX.Element {
  const { dettes } = props
  const aujourdhui = aujourdhuiLocal()
  const dues = dettes.echeances.filter((e) => e.reste > 0)
  const [pour, setPour] = useState(GLOBAL)
  const [montantTexte, setMontantTexte] = useState(String(dettes.soldeDu))
  const [mode, setMode] = useState<ModeReglement>('especes')
  const [reference, setReference] = useState('')
  const [date, setDate] = useState(aujourdhui)

  const reste = resteAPayer(dettes, pour)
  const montant = lireMontant(montantTexte)
  const manque = manqueReglement(montant, reste, date, aujourdhui)

  const changerPour = (valeur: string): void => {
    setPour(valeur)
    // Le montant proposé suit le reste de ce qu'on paie ; on peut le baisser pour un acompte.
    setMontantTexte(String(resteAPayer(dettes, valeur)))
  }

  return (
    <FenetreFormulaire
      titre={`Payer « ${dettes.nom} »`}
      pastille={<span className="pastille pastille-alerte">Reste dû : {formaterFCFA(reste)}</span>}
      libelleValider="Enregistrer le règlement"
      valide={manque === null}
      onValider={() =>
        props.onValider({
          receptionId: pour === GLOBAL ? null : Number(pour),
          montant: montant!,
          mode,
          reference,
          date
        })
      }
      onFermer={props.onFermer}
    >
      <label className="champ champ-large">
        Pour
        <select value={pour} onChange={(e) => changerPour(e.target.value)}>
          <option value={GLOBAL}>Solde global — les livraisons les plus anciennes d’abord</option>
          {dues.map((e) => (
            <option key={e.receptionId} value={String(e.receptionId)}>
              {libelleReception(e)}
            </option>
          ))}
        </select>
      </label>
      <label className="champ">
        Montant payé (F)
        <input inputMode="numeric" value={montantTexte} onChange={(e) => setMontantTexte(e.target.value)} />
        <span className="champ-aide">
          {manque ?? `Il restera ${formaterFCFA(reste - (montant ?? 0))} à payer.`}
        </span>
      </label>
      <label className="champ">
        Mode de paiement
        <select value={mode} onChange={(e) => setMode(e.target.value as ModeReglement)}>
          {(Object.keys(LIBELLES_MODE_REGLEMENT) as ModeReglement[]).map((m) => (
            <option key={m} value={m}>
              {LIBELLES_MODE_REGLEMENT[m]}
            </option>
          ))}
        </select>
      </label>
      <label className="champ">
        Référence (facultatif)
        <input
          placeholder="N° de transaction ou de virement"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </label>
      <label className="champ">
        Date du règlement
        <input type="date" value={date} max={aujourdhui} onChange={(e) => setDate(e.target.value)} />
      </label>
      <p className="vide formulaire-bloc">Le règlement n’est pas pris dans la caisse.</p>
    </FenetreFormulaire>
  )
}

function FormulaireAnnulation(props: {
  reglement: ReglementFournisseur
  onValider: (motif: string) => Promise<void>
  onFermer: () => void
}): React.JSX.Element {
  const [motif, setMotif] = useState('')
  const r = props.reglement
  return (
    <FenetreFormulaire
      titre="Annuler un règlement"
      libelleValider="Annuler le règlement"
      attention
      valide={motif.trim() !== ''}
      onValider={() => props.onValider(motif)}
      onFermer={props.onFermer}
    >
      <p className="vide formulaire-bloc">
        Règlement de {formaterFCFA(r.montant)} du {formaterDate(r.date)} ({LIBELLES_MODE_REGLEMENT[r.mode]},{' '}
        {r.reception ?? 'solde global'}). Il restera visible, marqué annulé, et ne comptera plus : la dette
        remontera d’autant. Saisissez ensuite le bon règlement.
      </p>
      <label className="champ champ-large">
        Motif
        <input
          placeholder="Ex. : montant mal saisi"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
        />
      </label>
    </FenetreFormulaire>
  )
}
