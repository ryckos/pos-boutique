/**
 * Propriétaire : Dev A.
 *
 * Clôture de caisse (tâche A4, maquette UI_UX § 5.4, règle 6.9) : 4 totaux par mode, calcul des
 * espèces théoriques ligne à ligne, saisie du compté, écart coloré en direct, commentaire (exigé si
 * l'écart n'est pas nul), rapport X, puis « Clôturer et imprimer le Z ».
 * La caissière clôture sa session ; le gérant choisit parmi les sessions ouvertes. Les montants
 * affichés viennent du processus principal, qui recalcule tout à la clôture. Le Z s'imprime APRÈS
 * la clôture : une imprimante en panne ne l'annule pas (bandeau + « Réimprimer le Z »).
 */
import { useCallback, useEffect, useState } from 'react'
import type { RapportCaisse, SessionOuverteResume } from '@shared/ipc/caisse'
import { formaterFCFA } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { useUtilisateur } from '@renderer/app/contexte'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import { dateHeure, etatCompte, type TonEcart } from './cloture'

type Vue =
  | { type: 'chargement' }
  | { type: 'aucune'; message: string }
  | { type: 'choix'; sessions: SessionOuverteResume[] }
  | { type: 'rapport'; rapport: RapportCaisse; plusieurs: boolean }

type Impression =
  | { etat: 'en_cours'; type: 'X' | 'Z' }
  | { etat: 'ok'; type: 'X' | 'Z'; duplicata: boolean }
  | { etat: 'echec'; type: 'X' | 'Z'; detail: string }

const CLASSES_ECART: Record<TonEcart, string> = {
  manque: 'cloture-ecart cloture-ecart-manque',
  surplus: 'cloture-ecart cloture-ecart-surplus',
  juste: 'cloture-ecart cloture-ecart-juste'
}

/** −500 F, +300 F, 0 F */
const ecartSigne = (ecart: number): string => (ecart > 0 ? '+' : '') + formaterFCFA(ecart)

export function PageClotureCaisse(): React.JSX.Element {
  const utilisateur = useUtilisateur()
  const gerant = utilisateur.role !== 'caissier'
  const [vue, setVue] = useState<Vue>({ type: 'chargement' })
  const [compte, setCompte] = useState('')
  const [commentaire, setCommentaire] = useState('')
  const [confirmation, setConfirmation] = useState(false)
  const [impression, setImpression] = useState<Impression | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const ouvrirRapport = useCallback(async (sessionId: number | undefined, plusieurs: boolean) => {
    setCompte('')
    setCommentaire('')
    setImpression(null)
    setErreur(null)
    setVue({ type: 'rapport', rapport: await appel('caisse:rapportSession', { sessionId }), plusieurs })
  }, [])

  // Caissière : sa session ouverte. Gérant : la liste des sessions ouvertes, directement le rapport
  // s'il n'y en a qu'une.
  const charger = useCallback(async () => {
    setVue({ type: 'chargement' })
    try {
      if (!gerant) return await ouvrirRapport(undefined, false)
      const sessions = await appel('caisse:sessionsOuvertes')
      if (sessions.length === 0) setVue({ type: 'aucune', message: 'Aucune caisse n’est ouverte.' })
      else if (sessions.length === 1) await ouvrirRapport(sessions[0].id, false)
      else setVue({ type: 'choix', sessions })
    } catch (e) {
      setVue({ type: 'aucune', message: (e as Error).message })
    }
  }, [gerant, ouvrirRapport])

  useEffect(() => {
    void charger()
  }, [charger])

  const imprimer = async (sessionId: number, type: 'X' | 'Z'): Promise<void> => {
    setImpression({ etat: 'en_cours', type })
    try {
      const { duplicata } = await appel('caisse:imprimerRapport', { sessionId, type })
      setImpression({ etat: 'ok', type, duplicata })
    } catch (e) {
      setImpression({ etat: 'echec', type, detail: (e as Error).message })
    }
  }

  if (vue.type === 'chargement') {
    return (
      <div className="page">
        <p className="vide">Lecture de la caisse…</p>
      </div>
    )
  }

  if (vue.type === 'aucune') {
    return (
      <div className="page">
        <header className="page-entete">
          <h1>Clôture de caisse</h1>
        </header>
        <p className="vide">{vue.message}</p>
      </div>
    )
  }

  if (vue.type === 'choix') {
    return (
      <div className="page">
        <header className="page-entete">
          <h1>Clôture de caisse</h1>
        </header>
        <p className="vide page-message">Plusieurs caisses sont ouvertes : touchez celle à clôturer.</p>
        {erreur && (
          <p className="alerte page-message" role="alert">
            {erreur}
          </p>
        )}
        <div className="cloture-choix">
          {vue.sessions.map((s) => (
            <button
              key={s.id}
              className="cloture-session"
              onClick={() => ouvrirRapport(s.id, true).catch((e: Error) => setErreur(e.message))}
            >
              <span className="cloture-session-nom">{s.caissier}</span>
              <span className="vide">Ouverte le {dateHeure(s.dateOuverture)}</span>
              <span className="montant">Fond {formaterFCFA(s.fondOuverture)}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const r = vue.rapport
  const saisie = etatCompte(r.especesTheoriques, compte, commentaire)

  const messageImpression = impression && (
    <>
      {impression.etat === 'en_cours' && (
        <p className="vide page-message" role="status">
          Impression du rapport {impression.type}…
        </p>
      )}
      {impression.etat === 'ok' && (
        <p className="succes page-message" role="status">
          {impression.duplicata ? 'Duplicata du rapport' : 'Rapport'} {impression.type} imprimé.
        </p>
      )}
      {impression.etat === 'echec' && (
        <div className="bandeau page-message" role="alert">
          <p>
            {impression.type === 'Z'
              ? 'Caisse clôturée, rapport Z non imprimé. Vérifiez le papier puis touchez « Réimprimer le Z ».'
              : 'Rapport X non imprimé. Vérifiez le papier puis réessayez.'}
            <span className="caisse-impression-detail">{impression.detail}</span>
          </p>
        </div>
      )}
    </>
  )

  // ── Session clôturée : résultat, et réimpression du Z. ──
  if (r.statut === 'fermee') {
    const ecart = r.ecart ?? 0
    return (
      <div className="page">
        <header className="page-entete">
          <h1>Caisse clôturée</h1>
          <span className="vide">
            Caisse : {r.caissier} · fermée le {r.dateFermeture ? dateHeure(r.dateFermeture) : '—'}
          </span>
        </header>
        {messageImpression}
        <section className="panneau">
          <dl className="cloture-lignes">
            <dt>Espèces théoriques</dt>
            <dd className="montant">{formaterFCFA(r.especesTheoriques)}</dd>
            <dt>Espèces comptées</dt>
            <dd className="montant">{formaterFCFA(r.montantCompte ?? 0)}</dd>
            <dt>Écart</dt>
            <dd className={CLASSES_ECART[ecart < 0 ? 'manque' : ecart > 0 ? 'surplus' : 'juste']}>
              {ecartSigne(ecart)}
            </dd>
          </dl>
          {r.commentaire && <p className="cloture-commentaire">Commentaire : {r.commentaire}</p>}
        </section>
        <div className="formulaire-actions">
          <button
            className="btn btn-secondaire"
            disabled={impression?.etat === 'en_cours'}
            onClick={() => void imprimer(r.sessionId, 'Z')}
          >
            Réimprimer le Z
          </button>
          {gerant && (
            <button className="btn btn-secondaire" onClick={() => void charger()}>
              Voir les autres caisses ouvertes
            </button>
          )}
        </div>
        {!gerant && (
          <p className="vide cloture-suite">
            Rangez le rapport Z avec les espèces. Pour vendre à nouveau, rouvrez la caisse depuis l’écran
            Caisse.
          </p>
        )}
      </div>
    )
  }

  // ── Session ouverte : rapport X et clôture. ──
  const cartes: [string, number][] = [
    ['Espèces', r.totauxParMode.especes],
    ['TMoney', r.totauxParMode.tmoney],
    ['Flooz', r.totauxParMode.flooz],
    ['Ventes crédit', r.totauxParMode.credit]
  ]

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Clôture de caisse</h1>
        <span className="vide">
          Caisse : {r.caissier} · ouverte le {dateHeure(r.dateOuverture)} · {r.nombreTickets} ticket
          {r.nombreTickets > 1 ? 's' : ''}
        </span>
      </header>
      {messageImpression}

      <div className="cloture-totaux">
        {cartes.map(([libelle, montant]) => (
          <div key={libelle} className="cloture-carte">
            <span className="vide">{libelle}</span>
            <span className="montant">{formaterFCFA(montant)}</span>
          </div>
        ))}
      </div>

      <section className="panneau">
        <h2>Espèces dans le tiroir</h2>
        <dl className="cloture-lignes">
          <dt>Fond d’ouverture</dt>
          <dd className="montant">{formaterFCFA(r.fondOuverture)}</dd>
          <dt>+ Ventes en espèces</dt>
          <dd className="montant">{formaterFCFA(r.ventesEspeces)}</dd>
          {r.mouvements.map((m, i) => (
            <MouvementLigne
              key={i}
              signe={m.sens === 'entree' ? '+' : '−'}
              libelle={m.libelle}
              montant={m.montant}
            />
          ))}
          <dt className="cloture-total">Espèces théoriques</dt>
          <dd className="montant cloture-total">{formaterFCFA(r.especesTheoriques)}</dd>
        </dl>

        <div className="cloture-saisie">
          <label className="champ">
            Espèces comptées dans le tiroir
            <input
              inputMode="numeric"
              value={compte}
              placeholder="Ex : 58200"
              onChange={(e) => setCompte(e.target.value)}
            />
          </label>
          {saisie.ecart !== null && saisie.ton && (
            <span className={CLASSES_ECART[saisie.ton]} role="status">
              Écart : {ecartSigne(saisie.ecart)}
            </span>
          )}
          <label className="champ champ-large">
            Commentaire{saisie.commentaireRequis ? ' (obligatoire : expliquez l’écart)' : ''}
            <input
              value={commentaire}
              placeholder="Ex : monnaie rendue en trop"
              onChange={(e) => setCommentaire(e.target.value)}
            />
          </label>
        </div>
      </section>

      <div className="formulaire-actions">
        <button
          className="btn btn-secondaire"
          disabled={impression?.etat === 'en_cours'}
          onClick={() => void imprimer(r.sessionId, 'X')}
        >
          Imprimer le rapport X
        </button>
        <button className="btn" disabled={!saisie.peutCloturer} onClick={() => setConfirmation(true)}>
          Clôturer et imprimer le Z
        </button>
        {vue.plusieurs && (
          <button className="btn btn-discret" onClick={() => void charger()}>
            Choisir une autre caisse
          </button>
        )}
      </div>

      {confirmation && saisie.compte !== null && saisie.ecart !== null && (
        <FenetreFormulaire
          titre={`Clôturer la caisse de ${r.caissier} ?`}
          libelleValider="Clôturer et imprimer le Z"
          valide
          onValider={async () => {
            const cloture = await appel('caisse:cloturerSession', {
              sessionId: r.sessionId,
              montantCompte: saisie.compte!,
              commentaire
            })
            setConfirmation(false)
            setVue({ type: 'rapport', rapport: cloture, plusieurs: vue.plusieurs })
            void imprimer(cloture.sessionId, 'Z')
          }}
          onFermer={() => setConfirmation(false)}
        >
          <dl className="cloture-lignes formulaire-bloc">
            <dt>Espèces théoriques</dt>
            <dd className="montant">{formaterFCFA(r.especesTheoriques)}</dd>
            <dt>Espèces comptées</dt>
            <dd className="montant">{formaterFCFA(saisie.compte)}</dd>
            <dt>Écart</dt>
            <dd className={CLASSES_ECART[saisie.ton!]}>{ecartSigne(saisie.ecart)}</dd>
          </dl>
          <p className="formulaire-bloc vide">
            Après la clôture, plus aucune vente ne peut être enregistrée sur cette caisse.
          </p>
        </FenetreFormulaire>
      )}
    </div>
  )
}

function MouvementLigne(props: { signe: string; libelle: string; montant: number }): React.JSX.Element {
  return (
    <>
      <dt>
        {props.signe} {props.libelle}
      </dt>
      <dd className="montant">{formaterFCFA(props.montant)}</dd>
    </>
  )
}
