/**
 * Enregistre tous les canaux IPC. ZONE PARTAGÉE — une ligne par module.
 * Ajouter un module = ajouter une ligne ici (conflit git trivial à résoudre).
 */
import { enregistrerIpcAuth } from '../modules/auth/ipc'
import { enregistrerIpcCaisse } from '../modules/caisse/ipc'
import { enregistrerIpcCatalogue } from '../modules/catalogue/ipc'
import { enregistrerIpcParametres } from '../modules/parametres/ipc'
import { enregistrerIpcStock } from '../modules/stock/ipc'
import { enregistrerIpcUtilisateurs } from '../modules/utilisateurs/ipc'
import { enregistrerIpcMateriel } from '../materiel/ipc'
import { enregistrerIpcSysteme } from './systeme'

export function enregistrerTousLesIpc(options: { cheminBase: string; modeDev: boolean }): void {
  enregistrerIpcSysteme(options)
  // ─── Dev B ───
  enregistrerIpcAuth(options)
  enregistrerIpcUtilisateurs()
  enregistrerIpcCatalogue()
  enregistrerIpcParametres()
  enregistrerIpcStock()
  // ─── Dev A ───
  enregistrerIpcCaisse()
  enregistrerIpcMateriel()
}
