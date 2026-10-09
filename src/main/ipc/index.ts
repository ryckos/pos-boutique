/**
 * Enregistre tous les canaux IPC. ZONE PARTAGÉE — une ligne par module.
 * Ajouter un module = ajouter une ligne ici (conflit git trivial à résoudre).
 */
import { enregistrerIpcAchats } from '../modules/achats/ipc'
import { enregistrerIpcAudit } from '../modules/audit/ipc'
import { enregistrerIpcAuth } from '../modules/auth/ipc'
import { enregistrerIpcCaisse } from '../modules/caisse/ipc'
import { enregistrerIpcCatalogue } from '../modules/catalogue/ipc'
import { enregistrerIpcDepenses } from '../modules/depenses/ipc'
import { enregistrerIpcExports } from '../modules/exports/ipc'
import { enregistrerIpcFournisseurs } from '../modules/fournisseurs/ipc'
import { enregistrerIpcInventaires } from '../modules/inventaires/ipc'
import { enregistrerIpcParametres } from '../modules/parametres/ipc'
import { enregistrerIpcRapportsGestion } from '../modules/rapports-gestion/ipc'
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
  enregistrerIpcFournisseurs()
  enregistrerIpcAchats()
  enregistrerIpcInventaires()
  enregistrerIpcDepenses()
  enregistrerIpcRapportsGestion()
  enregistrerIpcAudit()
  enregistrerIpcExports()
  // ─── Dev A ───
  enregistrerIpcCaisse()
  enregistrerIpcMateriel()
}
