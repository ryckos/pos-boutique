/**
 * Erreur « métier » : son message est destiné à l'utilisateur et s'affiche tel quel.
 * Toute autre erreur est considérée comme un bug et affiche un message générique.
 * ZONE PARTAGÉE.
 */
export class ErreurMetier extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErreurMetier'
  }
}
