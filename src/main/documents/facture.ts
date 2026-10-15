/**
 * Propriétaire : Dev A.
 *
 * Facture A4 (tâche A10, règle 6.12) : faite à partir d'un ticket encaissé, elle en reprend les lignes,
 * la TVA par taux, les paiements (mention « Payée ») et, s'il y en a eu, les retours avec le net payé.
 * Montant en toutes lettres. Une réédition porte « COPIE ».
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
  montant,
  pageA4,
  tableauLignes,
  tableauTotaux
} from './page'

const MODES: Record<string, string> = {
  especes: 'Espèces',
  tmoney: 'TMoney',
  flooz: 'Flooz',
  credit: 'Crédit'
}

export interface RetourFacture {
  numero: string
  horodatage: string
  lignes: { designation: string; quantite: number; totalLigne: number }[]
  /** Négatif : ce qui a été rendu. */
  total: number
}

/** Tout ce qui s'imprime sur la facture, relu en base. */
export interface DonneesFacture {
  numero: string
  horodatage: string
  numeroTicket: string
  dateTicket: string
  caissier: string
  boutique: EnteteDocument
  client: ClientImprime
  lignes: LigneDocument[]
  remiseGlobale: number
  totalTtc: number
  parTaux: VentilationTaux[]
  paiements: { mode: string; montant: number; reference: string | null }[]
  retours: RetourFacture[]
  /** Total du ticket moins les retours. */
  netPaye: number
}

function blocRetours(retours: RetourFacture[], netPaye: number): string {
  if (retours.length === 0) return ''
  const rangees = retours
    .flatMap((r) =>
      r.lignes.map(
        (l) => `<tr>
  <td>${echapper(`Retour ${r.numero} du ${dateDocument(r.horodatage)} : ${l.designation}`)}</td>
  <td class="n">${l.quantite}</td>
  <td class="n">${montant(l.totalLigne)}</td>
</tr>`
      )
    )
    .join('')
  return `<div class="section">
<table class="lignes"><thead><tr><th>Retours</th><th class="n">Qté</th><th class="n">Rendu TTC</th></tr></thead>
<tbody>${rangees}</tbody></table>
<table class="totaux"><tr class="fort"><td>Net payé</td><td class="n">${montant(netPaye)}</td></tr></table>
</div>`
}

export function htmlFacture(f: DonneesFacture, options: { copie: boolean }): string {
  const paiements = f.paiements
    .map(
      (p) =>
        `${MODES[p.mode] ?? p.mode} ${montant(p.montant)}${p.reference ? ` (réf. ${echapper(p.reference)})` : ''}`
    )
    .join(' · ')
  const corps = `
<div class="entete">
  ${blocBoutique(f.boutique)}
  <div class="titre">
    <h1>FACTURE</h1>
    <div>N° <strong>${echapper(f.numero)}</strong></div>
    <div>du ${dateDocument(f.horodatage)}</div>
    ${options.copie ? '<div class="copie">COPIE</div>' : ''}
  </div>
</div>
<div class="infos">
  <div>
    <div>Ticket de caisse : ${echapper(f.numeroTicket)} du ${dateDocument(f.dateTicket)}</div>
    <div>Caisse : ${echapper(f.caissier)}</div>
  </div>
  ${blocClient(f.client, 'Facturé à')}
</div>
${tableauLignes(f.lignes)}
${tableauTotaux(f)}
<div class="section"><strong>Payée</strong> — ${paiements}</div>
${blocRetours(f.retours, f.netPaye)}
<div class="lettres">Arrêtée la présente facture à la somme de <strong>${echapper(montantEnLettres(f.netPaye))}</strong>.</div>
<div class="pied">Prix TTC en francs CFA. Facture établie à partir du ticket ${echapper(f.numeroTicket)}.</div>`
  return pageA4(`Facture ${f.numero}`, corps)
}
