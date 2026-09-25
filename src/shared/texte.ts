/**
 * Normalisation des textes pour la recherche. ZONE PARTAGÉE.
 * Une seule règle pour le principal (fonction SQL sans_accents) et pour les écrans, afin que
 * « pate » trouve « Pâte » partout de la même façon.
 */

/** « Pâte ÉCOLE Œuf » → « pate ecole oeuf » : sans accents, en minuscules, ligatures dépliées. */
export function normaliserRecherche(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
}
