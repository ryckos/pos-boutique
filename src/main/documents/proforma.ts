/**
 * Propriétaire : Dev A.
 *
 * Proforma A4 (tâche A10, règle 6.13) : un devis, sans valeur de facture. Mêmes blocs que la facture,
 * avec la date de validité et la mention que les prix sont ceux du jour de l'achat.
 */
import type { VentilationTaux } from '../modules/caisse/calculs'
import { montantEnLettres } from './lettres'
import {
  blocBoutique,
  blocClient,
  type ClientImprime,
  dateDocument,
  echapper,
  type EnteteDocument,
  type LigneDocument,
  pageA4,
  tableauLignes,
  tableauTotaux
} from './page'

export interface DonneesProforma {
  numero: string
  horodatage: string
  /** AAAA-MM-JJ */
  valideJusquAu: string
  auteur: string
  boutique: EnteteDocument
  client: ClientImprime
  lignes: LigneDocument[]
  remiseGlobale: number
  totalTtc: number
  parTaux: VentilationTaux[]
}

export function htmlProforma(p: DonneesProforma): string {
  const corps = `
<div class="entete">
  ${blocBoutique(p.boutique)}
  <div class="titre">
    <h1>FACTURE PROFORMA</h1>
    <div>N° <strong>${echapper(p.numero)}</strong></div>
    <div>du ${dateDocument(p.horodatage)}</div>
    <div>Valable jusqu’au <strong>${dateDocument(p.valideJusquAu)}</strong></div>
  </div>
</div>
<div class="infos">
  <div>Établie par : ${echapper(p.auteur)}</div>
  ${blocClient(p.client, 'Établie pour')}
</div>
${tableauLignes(p.lignes)}
${tableauTotaux(p)}
<div class="lettres">Arrêtée la présente proforma à la somme de <strong>${echapper(montantEnLettres(p.totalTtc))}</strong>.</div>
<div class="pied">Devis sans valeur de facture. Prix TTC en francs CFA, donnés à titre indicatif : la vente se fait
aux prix en vigueur le jour de l’achat. Rappelez le numéro ${echapper(p.numero)} à la caisse.</div>`
  return pageA4(`Proforma ${p.numero}`, corps)
}
