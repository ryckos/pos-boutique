/**
 * Propriétaire : Dev A.
 *
 * Faire la facture d'un ticket déjà encaissé (tâche A10, règle 6.12), depuis la caisse. On tape le
 * numéro (le dernier ticket est proposé) ; si le ticket a déjà sa facture, on la réédite, sinon on
 * saisit le client. Puis PDF enregistré ou impression : le serveur décide original ou « COPIE ».
 * Ni vente, ni stock, ni caisse : la facture n'est qu'un document.
 */
import { useEffect, useState } from 'react'
import type { FactureCreee, SortieDocument } from '@shared/ipc/caisse'
import { appel } from '@renderer/lib/api'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import {
  estNumeroFacture,
  manqueClient,
  nettoyerClient,
  saisieClientVide,
  type SaisieClient
} from './documents'
import { ChampsClient } from './ChampsClient'
import { Icone } from '@renderer/ui/Icone'

interface Props {
  /** Numéro proposé : le dernier ticket de la caisse. */
  numeroInitial: string
  onFermer: () => void
}

/** Où en est la recherche du ticket : rien, ticket sans facture (formulaire client), facture prête. */
type Etape =
  | { sorte: 'recherche' }
  | { sorte: 'nouvelle'; numeroTicket: string }
  | { sorte: 'prete'; facture: FactureCreee; dejaFaite: boolean }

export function FenetreFacture({ numeroInitial, onFermer }: Props): React.JSX.Element {
  const [numero, setNumero] = useState(numeroInitial)
  const [etape, setEtape] = useState<Etape>({ sorte: 'recherche' })
  const [lecture, setLecture] = useState<string | null>(null)
  const [client, setClient] = useState<SaisieClient>(saisieClientVide)
  const [sortie, setSortie] = useState<{ message: string; erreur: boolean } | null>(null)
  const [impressionEnCours, setImpressionEnCours] = useState(false)

  const chercher = async (n: string): Promise<void> => {
    setEtape({ sorte: 'recherche' })
    setLecture(null)
    setSortie(null)
    if (!n.trim()) return
    try {
      const facture = await appel('caisse:trouverFacture', { numero: n })
      if (facture) setEtape({ sorte: 'prete', facture, dejaFaite: true })
      else if (estNumeroFacture(n))
        setLecture(`Facture ${n.trim().toUpperCase()} introuvable : vérifiez le numéro.`)
      else setEtape({ sorte: 'nouvelle', numeroTicket: n.trim().toUpperCase() })
    } catch (e) {
      setLecture((e as Error).message)
    }
  }

  // Le dernier ticket de la caisse est cherché tout de suite : c'est presque toujours lui.
  useEffect(() => {
    void chercher(numeroInitial)
  }, [numeroInitial])

  /** Une sortie annulée dans la boîte de dialogue de Windows ne dit rien : rien n'a été fait. */
  const editer = async (factureId: number, s: SortieDocument): Promise<void> => {
    setSortie(null)
    const { fait, copie } = await appel('caisse:editerFacture', { factureId, sortie: s })
    if (!fait) return
    const quoi = s === 'enregistrer' ? 'PDF enregistré' : 'Facture envoyée à l’imprimante'
    setSortie({ message: `${quoi}${copie ? ' (copie)' : ' (original)'}.`, erreur: false })
  }

  const imprimer = (factureId: number): void => {
    setImpressionEnCours(true)
    editer(factureId, 'imprimer')
      .catch((e: Error) => setSortie({ message: e.message, erreur: true }))
      .finally(() => setImpressionEnCours(false))
  }

  const manque = etape.sorte === 'nouvelle' ? manqueClient(client, true) : null

  return (
    <FenetreFormulaire
      titre="Faire une facture"
      libelleValider={etape.sorte === 'prete' ? 'Enregistrer le PDF' : 'Faire la facture'}
      large
      valide={etape.sorte === 'prete' ? !impressionEnCours : etape.sorte === 'nouvelle' && manque === null}
      onValider={async () => {
        if (etape.sorte === 'prete') return editer(etape.facture.factureId, 'enregistrer')
        if (etape.sorte !== 'nouvelle') return
        const facture = await appel('caisse:facturer', {
          numeroTicket: etape.numeroTicket,
          client: nettoyerClient(client)!
        })
        setEtape({ sorte: 'prete', facture, dejaFaite: false })
      }}
      onFermer={onFermer}
    >
      <label className="champ">
        Numéro du ticket (ou de la facture)
        <input
          value={numero}
          placeholder="Ex : T-2026-000158 ou 158"
          disabled={etape.sorte === 'prete' && !etape.dejaFaite}
          onChange={(e) => {
            setNumero(e.target.value.toUpperCase())
            setEtape({ sorte: 'recherche' })
            setLecture(null)
            setSortie(null)
          }}
          onKeyDown={(e) => {
            // Entrée cherche le ticket au lieu de valider le formulaire.
            if (e.key === 'Enter' && etape.sorte === 'recherche') {
              e.preventDefault()
              void chercher(numero)
            }
          }}
        />
      </label>
      {etape.sorte === 'recherche' && (
        <button type="button" className="btn btn-discret" onClick={() => void chercher(numero)}>
          <Icone nom="rechercher" />
          Chercher le ticket
        </button>
      )}

      {lecture && (
        <p className="alerte formulaire-bloc" role="alert">
          {lecture}
        </p>
      )}

      {etape.sorte === 'nouvelle' && (
        <>
          <h3 className="formulaire-bloc">Client à facturer — ticket {etape.numeroTicket}</h3>
          <ChampsClient saisie={client} onChange={setClient} />
          <p className="vide formulaire-bloc">
            {manque ??
              'La facture reprend les articles et les paiements du ticket. Une seule facture par ticket.'}
          </p>
        </>
      )}

      {etape.sorte === 'prete' && (
        <div className="formulaire-bloc">
          <p className="succes">
            {etape.dejaFaite
              ? `Le ticket ${etape.facture.numeroTicket} a déjà la facture ${etape.facture.numero} : rééditez-la.`
              : `Facture ${etape.facture.numero} faite pour le ticket ${etape.facture.numeroTicket}.`}
          </p>
          <p className="vide">
            Enregistrez le PDF (clé USB, envoi au client) ou imprimez-la. Chaque nouvelle sortie porte la
            mention « COPIE ».
          </p>
          <button
            type="button"
            className="btn btn-secondaire"
            disabled={impressionEnCours}
            onClick={() => imprimer(etape.facture.factureId)}
          >
            <Icone nom="imprimer" />
            Imprimer la facture
          </button>
        </div>
      )}

      {sortie && (
        <p className={sortie.erreur ? 'alerte formulaire-bloc' : 'vide formulaire-bloc'} role="status">
          {sortie.message}
        </p>
      )}
    </FenetreFormulaire>
  )
}
