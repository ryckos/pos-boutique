/**
 * Propriétaire : Dev A.
 *
 * Proforma (devis) depuis le ticket en cours (tâche A10, règle 6.13). Client facultatif ; le service
 * relit prix, remises et plafond comme pour une vente, sans rien vendre ni sortir du stock. Puis PDF
 * enregistré ou impression. Le ticket reste en caisse : la caissière choisit de le vider ou non.
 */
import { useState } from 'react'
import type { ProformaCreee, SortieDocument } from '@shared/ipc/caisse'
import { formaterDate, formaterFCFA } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import { manqueClient, nettoyerClient, saisieClientVide, type SaisieClient } from './documents'
import { totalPanier, versLignesVente, type Panier } from './panier'
import { ChampsClient } from './ChampsClient'
import { Icone } from '@renderer/ui/Icone'

interface Props {
  panier: Panier
  onFermer: () => void
}

export function FenetreProforma({ panier, onFermer }: Props): React.JSX.Element {
  const [client, setClient] = useState<SaisieClient>(saisieClientVide)
  const [proforma, setProforma] = useState<ProformaCreee | null>(null)
  const [sortie, setSortie] = useState<{ message: string; erreur: boolean } | null>(null)
  const [impressionEnCours, setImpressionEnCours] = useState(false)

  /** Une sortie annulée dans la boîte de dialogue de Windows ne dit rien : rien n'a été fait. */
  const editer = async (proformaId: number, s: SortieDocument): Promise<void> => {
    setSortie(null)
    const { fait } = await appel('caisse:editerProforma', { proformaId, sortie: s })
    if (fait) {
      setSortie({
        message: s === 'enregistrer' ? 'PDF enregistré.' : 'Proforma envoyée à l’imprimante.',
        erreur: false
      })
    }
  }

  const imprimer = (proformaId: number): void => {
    setImpressionEnCours(true)
    editer(proformaId, 'imprimer')
      .catch((e: Error) => setSortie({ message: e.message, erreur: true }))
      .finally(() => setImpressionEnCours(false))
  }

  const manque = proforma ? null : manqueClient(client, false)
  const nb = panier.lignes.length

  return (
    <FenetreFormulaire
      titre="Proforma"
      pastille={<span className="pastille pastille-ok montant">{formaterFCFA(totalPanier(panier))}</span>}
      libelleValider={proforma ? 'Enregistrer le PDF' : 'Faire la proforma'}
      large
      valide={proforma ? !impressionEnCours : manque === null}
      onValider={async () => {
        if (proforma) return editer(proforma.proformaId, 'enregistrer')
        const c = nettoyerClient(client)
        setProforma(
          await appel('caisse:creerProforma', {
            lignes: versLignesVente(panier),
            ...((panier.remiseGlobale ?? 0) > 0 && { remiseGlobale: panier.remiseGlobale }),
            ...(panier.accord && { jetonRemise: panier.accord.jeton }),
            ...(c && { client: c })
          })
        )
      }}
      onFermer={onFermer}
    >
      {proforma ? (
        <div className="formulaire-bloc">
          <p className="succes">
            Proforma {proforma.numero} faite : {formaterFCFA(proforma.totalTtc)}, valable jusqu’au{' '}
            {formaterDate(proforma.valideJusquAu)}.
          </p>
          <p className="vide">
            Enregistrez le PDF (clé USB, envoi au client) ou imprimez-la. Le ticket reste en caisse : videz-le
            si le client ne prend rien aujourd’hui.
          </p>
          <button
            type="button"
            className="btn btn-secondaire"
            disabled={impressionEnCours}
            onClick={() => imprimer(proforma.proformaId)}
          >
            <Icone nom="imprimer" />
            Imprimer la proforma
          </button>
        </div>
      ) : (
        <>
          <h3 className="formulaire-bloc">Client (facultatif)</h3>
          <ChampsClient saisie={client} onChange={setClient} />
          <p className="vide formulaire-bloc">
            {manque ??
              `${nb} article${nb > 1 ? 's' : ''} du ticket, aux prix du jour. Rien n’est vendu ni sorti du stock ; la proforma vaut 30 jours.`}
          </p>
        </>
      )}

      {sortie && (
        <p className={sortie.erreur ? 'alerte formulaire-bloc' : 'vide formulaire-bloc'} role="status">
          {sortie.message}
        </p>
      )}
    </FenetreFormulaire>
  )
}
