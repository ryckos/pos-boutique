/**
 * Propriétaire : Dev A.
 *
 * Gabarit HTML d'un document A4 (facture et proforma, tâche A10), converti en PDF par Chromium
 * (documents/pdf.ts). Fonctions pures, testables : aucune dépendance à Electron ni à la base.
 * Document imprimé en noir sur blanc : il ne suit pas les jetons de couleur de l'interface.
 */
import { formaterFCFA } from '@shared/format'
import type { VentilationTaux } from '../modules/caisse/calculs'

export interface EnteteDocument {
  nom: string
  adresse: string[]
  nif: string | null
}

/** Le client tel qu'il s'imprime (recopié sur la facture ou la proforma). */
export interface ClientImprime {
  nom: string | null
  telephone: string | null
  adresse: string | null
  nif: string | null
}

export interface LigneDocument {
  designation: string
  quantite: number
  prixUnitaire: number
  remise: number
  totalLigne: number
  tauxTva: number
}

/** Échappe un texte saisi (désignation, nom du client…) avant de l'insérer dans le HTML. */
export function echapper(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const montant = (n: number): string => echapper(formaterFCFA(n))
const taux = (t: number): string => `${String(t).replace('.', ',')} %`

/** '2026-10-15 10:42:05' → '15/10/2026' */
export function dateDocument(horodatage: string): string {
  const [a, m, j] = horodatage.slice(0, 10).split('-')
  return `${j}/${m}/${a}`
}

export function blocBoutique(e: EnteteDocument): string {
  return `<div class="boutique">
  <div class="boutique-nom">${echapper(e.nom)}</div>
  ${e.adresse.map((l) => `<div>${echapper(l)}</div>`).join('')}
  ${e.nif ? `<div>NIF : ${echapper(e.nif)}</div>` : ''}
</div>`
}

export function blocClient(c: ClientImprime, titre: string): string {
  if (!c.nom) return ''
  const lignes = [
    `<div class="client-nom">${echapper(c.nom)}</div>`,
    c.adresse ? `<div>${echapper(c.adresse)}</div>` : '',
    c.telephone ? `<div>Tél. : ${echapper(c.telephone)}</div>` : '',
    c.nif ? `<div>NIF : ${echapper(c.nif)}</div>` : ''
  ]
  return `<div class="client"><div class="libelle">${titre}</div>${lignes.join('')}</div>`
}

export function tableauLignes(lignes: LigneDocument[]): string {
  const rangees = lignes
    .map(
      (l) => `<tr>
  <td>${echapper(l.designation)}</td>
  <td class="n">${l.quantite}</td>
  <td class="n">${montant(l.prixUnitaire)}</td>
  <td class="n">${l.remise ? montant(l.remise) : ''}</td>
  <td class="n">${taux(l.tauxTva)}</td>
  <td class="n">${montant(l.totalLigne)}</td>
</tr>`
    )
    .join('')
  return `<table class="lignes">
<thead><tr><th>Désignation</th><th class="n">Qté</th><th class="n">Prix unit. TTC</th><th class="n">Remise</th><th class="n">TVA</th><th class="n">Total TTC</th></tr></thead>
<tbody>${rangees}</tbody>
</table>`
}

/** Totaux : remise sur le document, HT / TVA par taux, total TTC (règle 6.4). */
export function tableauTotaux(t: {
  remiseGlobale: number
  parTaux: VentilationTaux[]
  totalTtc: number
}): string {
  const lignes: string[] = []
  if (t.remiseGlobale > 0)
    lignes.push(`<tr><td>Remise</td><td class="n">−${montant(t.remiseGlobale)}</td></tr>`)
  for (const v of t.parTaux) {
    lignes.push(`<tr><td>Total HT ${taux(v.taux)}</td><td class="n">${montant(v.ht)}</td></tr>`)
    lignes.push(`<tr><td>TVA ${taux(v.taux)}</td><td class="n">${montant(v.tva)}</td></tr>`)
  }
  const ht = t.parTaux.reduce((s, v) => s + v.ht, 0)
  const tva = t.parTaux.reduce((s, v) => s + v.tva, 0)
  lignes.push(`<tr><td>Total HT</td><td class="n">${montant(ht)}</td></tr>`)
  lignes.push(`<tr><td>Total TVA</td><td class="n">${montant(tva)}</td></tr>`)
  lignes.push(`<tr class="fort"><td>Total TTC</td><td class="n">${montant(t.totalTtc)}</td></tr>`)
  return `<table class="totaux">${lignes.join('')}</table>`
}

const STYLE = `
@page { size: A4; margin: 15mm; }
* { box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #000; margin: 0; }
.entete { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
.boutique-nom { font-size: 16pt; font-weight: 700; }
.titre { text-align: right; }
.titre h1 { font-size: 20pt; margin: 0; letter-spacing: 1px; }
.titre .copie { font-weight: 700; border: 2px solid #000; display: inline-block; padding: 2px 8px; margin-top: 6px; }
.infos { margin-top: 18px; display: flex; justify-content: space-between; gap: 24px; }
.client { border: 1px solid #000; padding: 8px 12px; min-width: 45%; }
.libelle { font-size: 9pt; text-transform: uppercase; color: #444; }
.client-nom { font-weight: 700; }
table { border-collapse: collapse; width: 100%; }
.lignes { margin-top: 18px; }
.lignes th, .lignes td { border: 1px solid #000; padding: 4px 6px; vertical-align: top; }
.lignes th { background: #eee; text-align: left; }
.n { text-align: right; white-space: nowrap; }
.totaux { width: 50%; margin: 12px 0 0 auto; }
.totaux td { padding: 3px 6px; border-bottom: 1px solid #ccc; }
.fort td { font-weight: 700; font-size: 13pt; border-top: 2px solid #000; }
.section { margin-top: 14px; }
.lettres { margin-top: 18px; }
.pied { margin-top: 28px; font-size: 9pt; color: #444; }
`

/** La page complète, prête pour printToPDF. */
export function pageA4(titre: string, corps: string): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${echapper(titre)}</title><style>${STYLE}</style></head>
<body>${corps}</body></html>`
}
