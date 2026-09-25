/** Propriétaire : Dev A. Encodeur ESC/POS validé en Phase 0 (Xprinter M804). */
import type { PageDeCodes } from '@shared/ipc/materiel'
/**
 * Encodeur ESC/POS minimal, 100 % TypeScript, sans dépendance native.
 * Génère les octets bruts compris par l'imprimante Xprinter M804.
 *
 * Références des commandes :
 *  - ESC @        : initialisation
 *  - ESC t n      : sélection de la page de codes (accents)
 *  - ESC a n      : alignement (0 gauche, 1 centre, 2 droite)
 *  - ESC E n      : gras (1 on, 0 off)
 *  - GS ! n       : taille du texte (0x00 normal, 0x11 double)
 *  - ESC d n      : avance de n lignes
 *  - GS V 66 n    : coupe partielle du papier
 *  - ESC p m t1 t2: impulsion tiroir-caisse (port RJ11)
 */

const ESC = 0x1b
const GS = 0x1d

export type Codepage = PageDeCodes

/** Valeur n de la commande ESC t pour chaque page de codes (valeurs Xprinter/Epson). */
const CODEPAGE_CMD: Record<Codepage, number> = {
  cp437: 0, // Page par défaut USA/Europe — accents partiels
  cp1252: 16, // Windows-1252 — le plus simple pour le français
  cp858: 19 // CP858 = CP850 + symbole €
}

/**
 * Table de correspondance des caractères accentués pour CP437/CP850/CP858.
 * (CP850 et CP858 partagent les mêmes positions pour les lettres françaises.)
 */
const CP850_MAP: Record<string, number> = {
  é: 0x82,
  è: 0x8a,
  ê: 0x88,
  ë: 0x89,
  à: 0x85,
  â: 0x83,
  ä: 0x84,
  ç: 0x87,
  ù: 0x97,
  û: 0x96,
  ü: 0x81,
  ô: 0x93,
  ö: 0x94,
  î: 0x8c,
  ï: 0x8b,
  É: 0x90,
  Ç: 0x80,
  // Majuscules accentuées et guillemets : CP850/858 seulement (autres signes en CP437).
  À: 0xb7,
  Â: 0xb6,
  È: 0xd4,
  Ê: 0xd2,
  Î: 0xd7,
  Ô: 0xe2,
  Ù: 0xeb,
  Û: 0xea,
  '«': 0xae,
  '»': 0xaf,
  '°': 0xf8,
  '€': 0xd5 // uniquement CP858 — imprimera un autre signe en CP437
}

/**
 * Windows-1252 = Latin-1 sauf 0x80–0x9F. Sans cette table, « € » (U+20AC) sortait en « ? »
 * (corrigé en A3).
 */
const CP1252_EXTRA: Record<string, number> = { '€': 0x80, Œ: 0x8c, œ: 0x9c }

/**
 * Signes typographiques absents des pages de codes de l'imprimante, remplacés par leur équivalent
 * ASCII. Indispensable : les désignations contiennent un tiret long (« Tomate — Carton de 24 ») et
 * les nombres formatés en français une espace fine insécable.
 */
const TRANSLITTERATION: Record<string, string> = {
  '—': '-', // tiret long
  '–': '-', // tiret moyen
  '‘': "'",
  '’': "'", // apostrophe typographique
  '“': '"',
  '”': '"',
  // Codes explicites : écrites telles quelles, ces espaces seraient invisibles dans le source.
  [String.fromCharCode(0x00a0)]: ' ', // espace insécable
  [String.fromCharCode(0x202f)]: ' ', // espace fine insécable (toLocaleString('fr-FR'))
  '…': '...',
  '×': 'x', // signe multiplier
  œ: 'oe',
  Œ: 'OE'
}

/** Convertit une chaîne en octets pour la page de codes choisie. */
export function encodeText(text: string, cp: Codepage): number[] {
  const bytes: number[] = []
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0x3f
    if (code < 0x80) {
      bytes.push(code) // ASCII pur : identique partout
    } else if (cp === 'cp1252' && CP1252_EXTRA[ch] !== undefined) {
      bytes.push(CP1252_EXTRA[ch])
    } else if (cp === 'cp1252' && code >= 0xa0 && code <= 0xff && TRANSLITTERATION[ch] === undefined) {
      bytes.push(code) // Latin-1 direct
    } else if (cp !== 'cp1252' && CP850_MAP[ch] !== undefined) {
      bytes.push(CP850_MAP[ch])
    } else if (TRANSLITTERATION[ch] !== undefined) {
      bytes.push(...encodeText(TRANSLITTERATION[ch], cp))
    } else {
      bytes.push(0x3f) // inconnu : '?'
    }
  }
  return bytes
}

/** Petit assembleur d'octets (utilisé aussi par ticket.ts). */
export class Builder {
  private data: number[] = []
  raw(...bytes: number[]): this {
    this.data.push(...bytes)
    return this
  }
  init(): this {
    return this.raw(ESC, 0x40)
  }
  codepage(cp: Codepage): this {
    return this.raw(ESC, 0x74, CODEPAGE_CMD[cp])
  }
  align(a: 0 | 1 | 2): this {
    return this.raw(ESC, 0x61, a)
  }
  bold(on: boolean): this {
    return this.raw(ESC, 0x45, on ? 1 : 0)
  }
  size(double: boolean): this {
    return this.raw(GS, 0x21, double ? 0x11 : 0x00)
  }
  text(s: string, cp: Codepage): this {
    this.data.push(...encodeText(s, cp))
    return this
  }
  line(s: string, cp: Codepage): this {
    return this.text(s, cp).raw(0x0a)
  }
  feed(n: number): this {
    return this.raw(ESC, 0x64, n)
  }
  cut(): this {
    return this.raw(GS, 0x56, 0x42, 0x03)
  }
  buffer(): Buffer {
    return Buffer.from(this.data)
  }
}

/** Ligne article formatée sur 32 colonnes (police normale 80 mm ≈ 48 col, on reste prudent). */
function articleLine(nom: string, prix: string): string {
  const width = 32
  const gap = width - nom.length - prix.length
  return nom + ' '.repeat(Math.max(1, gap)) + prix
}

/**
 * Ticket de test complet : en-tête, test d'accents, fausse vente, total.
 * Le test d'accents est LE point à vérifier visuellement sur le papier :
 * si "éèêàçùôî ÉÇ" s'imprime correctement, la page de codes est la bonne.
 */
export function buildTestTicket(cp: Codepage): Buffer {
  const b = new Builder()
  const now = new Date()
  const dateStr = now.toLocaleDateString('fr-FR') + ' ' + now.toLocaleTimeString('fr-FR')

  b.init()
    .codepage(cp)
    .align(1)
    .size(true)
    .bold(true)
    .line('TEST POS - PHASE 0', cp)
    .size(false)
    .bold(false)
    .line('Validation Xprinter M804', cp)
    .line('--------------------------------', cp)
    .align(0)
    .line(`Page de codes : ${cp}`, cp)
    .line(`Date : ${dateStr}`, cp)
    .line('', cp)
    .bold(true)
    .line('TEST DES ACCENTS FRANCAIS :', cp)
    .bold(false)
    .line('eeaa -> éèêë àâä çùûü ôö îï', cp)
    .line('Majuscules -> É Ç   Euro -> €', cp)
    .line('', cp)
    .bold(true)
    .line('SIMULATION DE VENTE :', cp)
    .bold(false)
    .line(articleLine('Riz parfume 5kg', '4 500'), cp)
    .line(articleLine('Huile vegetale 1L', '1 200'), cp)
    .line(articleLine('Savon de menage x3', '750'), cp)
    .line('--------------------------------', cp)
    .bold(true)
    .size(true)
    .line(articleLine('TOTAL', '6 450 F'), cp)
    .size(false)
    .bold(false)
    .align(1)
    .line('', cp)
    .line('Merci de votre visite !', cp)
    .feed(4)
    .cut()

  return b.buffer()
}

/**
 * Impulsion d'ouverture du tiroir-caisse : ESC p 0 25 250.
 * L'imprimante convertit ces 5 octets en impulsion électrique sur son port RJ11.
 * Test valide même sans tiroir branché si la commande part sans erreur.
 */
export const IMPULSION_TIROIR = [ESC, 0x70, 0x00, 0x19, 0xfa] as const

export function buildDrawerPulse(): Buffer {
  return Buffer.from(IMPULSION_TIROIR)
}
