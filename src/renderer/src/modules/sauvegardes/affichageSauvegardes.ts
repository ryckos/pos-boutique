/** Textes de l'écran Sauvegardes (B16). Propriétaire : Dev B. Logique pure, testée. */
import type { CopieExterne, MotifSauvegarde } from '@shared/ipc/sauvegardes'

export const LIBELLES_MOTIF: Record<MotifSauvegarde, string> = {
  cloture: 'Clôture de caisse',
  mise_a_jour: 'Avant une mise à jour',
  demarrage: 'Au démarrage',
  manuelle: 'Sauvegarde manuelle',
  avant_restauration: 'Avant une restauration'
}

/** 1 536 000 octets → « 1,5 Mo » ; en dessous de 1 Mo, en Ko. */
export function formaterTaille(octets: number): string {
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024)).toLocaleString('fr-FR')} Ko`
  return `${(octets / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
}

/** Phrase affichée après « Sauvegarder maintenant », selon ce qui est arrivé à la copie sur la clé. */
export function messageCopieExterne(copie: CopieExterne): { texte: string; alerte: boolean } {
  switch (copie) {
    case 'faite':
      return { texte: 'Copie faite sur la clé USB.', alerte: false }
    case 'non_reglee':
      return { texte: 'Aucune clé USB n’est choisie : sauvegarde gardée sur cet ordinateur.', alerte: false }
    case 'absente':
      return { texte: 'Clé USB non branchée : branchez-la puis sauvegardez de nouveau.', alerte: true }
    case 'echec':
      return {
        texte: 'La copie sur la clé USB a échoué : vérifiez qu’elle n’est pas pleine ni protégée.',
        alerte: true
      }
  }
}
