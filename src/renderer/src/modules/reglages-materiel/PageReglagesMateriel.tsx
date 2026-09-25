/**
 * Propriétaire : Dev A.
 *
 * Réglages matériel (gérant, tâche A3) : imprimante, méthode d'envoi, page de codes ; tickets de
 * test et ouverture du tiroir. Les réglages sont les clés imprimante_* des paramètres de la boutique
 * (Dev B, B5) : le gérant peut les modifier, chaque changement est journalisé.
 * La page de codes par défaut est PROVISOIRE (décision en attente D-A2) : les trois boutons de
 * ticket de test servent à trouver sur le terminal celle qui imprime tous les accents.
 */
import { useCallback, useEffect, useState } from 'react'
import type { CibleImprimante, MethodeImpression, PageDeCodes } from '@shared/ipc/materiel'
import { appel } from '@renderer/lib/api'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'

const METHODES: Record<MethodeImpression, string> = {
  spooler: 'Imprimante Windows (spouleur)',
  share: 'Partage réseau'
}
const PAGES: PageDeCodes[] = ['cp858', 'cp1252', 'cp437']

export function PageReglagesMateriel(): React.JSX.Element {
  const [reglages, setReglages] = useState<CibleImprimante | null>(null)
  const [modification, setModification] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  const charger = useCallback(() => {
    appel('materiel:lireReglages')
      .then(setReglages)
      .catch((e: Error) => setErreur(e.message))
  }, [])
  useEffect(charger, [charger])

  /** Lance un test sur l'imprimante ; le résultat s'affiche en haut de la page. */
  const tester = async (travail: () => Promise<unknown>, message: string): Promise<void> => {
    setEnCours(true)
    setErreur(null)
    setSucces(null)
    try {
      await travail()
      setSucces(message)
    } catch (e) {
      setErreur((e as Error).message)
    } finally {
      setEnCours(false)
    }
  }

  const imprimanteReglee = !!reglages?.cible

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Réglages matériel</h1>
        <button className="btn" disabled={!reglages} onClick={() => setModification(true)}>
          Modifier les réglages
        </button>
      </header>

      {succes && (
        <p className="succes page-message" role="status">
          {succes}
        </p>
      )}
      {erreur && (
        <p className="alerte page-message" role="alert">
          {erreur}
        </p>
      )}

      {reglages && (
        <section className="panneau">
          <h2>Imprimante de tickets</h2>
          <dl className="reglages-liste">
            <dt>Imprimante</dt>
            <dd>
              {reglages.cible || <span className="vide">Aucune : touchez « Modifier les réglages ».</span>}
            </dd>
            <dt>Méthode d’envoi</dt>
            <dd>{METHODES[reglages.methode]}</dd>
            <dt>Page de codes (accents)</dt>
            <dd>{reglages.pageDeCodes}</dd>
          </dl>
        </section>
      )}

      <section className="panneau">
        <h2>Trouver la page de codes</h2>
        <p className="vide reglages-aide">
          Imprimez un ticket de test avec chaque page, puis gardez celle où la ligne « éèêàçùôî ÉÇ € » est
          entièrement juste. Choisissez-la ensuite dans « Modifier les réglages ».
        </p>
        <div className="formulaire-actions">
          {PAGES.map((p) => (
            <button
              key={p}
              className="btn btn-secondaire"
              disabled={!imprimanteReglee || enCours}
              onClick={() =>
                void tester(
                  () => appel('materiel:ticketTest', { ...reglages!, pageDeCodes: p }),
                  `Ticket de test ${p} envoyé à l’imprimante.`
                )
              }
            >
              Imprimer le test en {p}
            </button>
          ))}
        </div>
      </section>

      <section className="panneau">
        <h2>Tiroir-caisse</h2>
        <p className="vide reglages-aide">
          Le tiroir s’ouvre seul à chaque encaissement en espèces. Une ouverture manuelle est notée au
          journal.
        </p>
        <button
          className="btn btn-secondaire"
          disabled={!imprimanteReglee || enCours}
          onClick={() =>
            void tester(
              () => appel('materiel:ouvrirTiroir', { methode: reglages!.methode, cible: reglages!.cible }),
              'Commande d’ouverture envoyée au tiroir.'
            )
          }
        >
          Ouvrir le tiroir
        </button>
      </section>

      {modification && reglages && (
        <FormulaireReglages
          initial={reglages}
          onFermer={() => setModification(false)}
          onValider={async (r) => {
            setReglages(await appel('materiel:enregistrerReglages', r))
            setModification(false)
            setErreur(null)
            setSucces('Réglages de l’imprimante enregistrés.')
          }}
        />
      )}
    </div>
  )
}

function FormulaireReglages(props: {
  initial: CibleImprimante
  onValider: (r: CibleImprimante) => Promise<void>
  onFermer: () => void
}): React.JSX.Element {
  const [r, setR] = useState(props.initial)
  /** undefined = recherche en cours (jusqu'à 30 s sur le terminal, D-05). */
  const [detectees, setDetectees] = useState<string[] | undefined>(undefined)

  useEffect(() => {
    appel('materiel:imprimantes')
      .then(setDetectees)
      .catch(() => setDetectees([]))
  }, [])

  return (
    <FenetreFormulaire
      titre="Modifier les réglages de l’imprimante"
      libelleValider="Enregistrer les réglages"
      valide={r.cible.trim() !== ''}
      onValider={() => props.onValider(r)}
      onFermer={props.onFermer}
    >
      <label className="champ champ-large">
        Méthode d’envoi
        <select
          value={r.methode}
          onChange={(e) => setR({ ...r, methode: e.target.value as MethodeImpression })}
        >
          {Object.entries(METHODES).map(([valeur, libelle]) => (
            <option key={valeur} value={valeur}>
              {libelle}
            </option>
          ))}
        </select>
      </label>
      <label className="champ champ-large">
        {r.methode === 'spooler' ? 'Nom de l’imprimante Windows' : 'Nom du partage réseau'}
        <input
          list="imprimantes-detectees"
          value={r.cible}
          placeholder="Ex : XP-80C"
          onChange={(e) => setR({ ...r, cible: e.target.value })}
        />
        <datalist id="imprimantes-detectees">
          {(detectees ?? []).map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </label>
      <p className="formulaire-bloc vide">
        {detectees === undefined
          ? 'Recherche des imprimantes… (jusqu’à 30 secondes sur le terminal)'
          : detectees.length === 0
            ? 'Aucune imprimante détectée : saisissez son nom exact, tel qu’il apparaît dans Windows.'
            : `${detectees.length} imprimante(s) détectée(s) : touchez le champ pour choisir.`}
      </p>
      <label className="champ">
        Page de codes (accents)
        <select
          value={r.pageDeCodes}
          onChange={(e) => setR({ ...r, pageDeCodes: e.target.value as PageDeCodes })}
        >
          {PAGES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
    </FenetreFormulaire>
  )
}
