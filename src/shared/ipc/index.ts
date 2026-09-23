/**
 * CONTRAT IPC — l'unique porte entre l'interface (renderer) et le processus principal.
 *
 * Chaque module déclare ses canaux dans SON propre fichier (auth.ts, catalogue.ts…),
 * possédé par son développeur. Ce fichier-ci ne fait qu'assembler : une ligne par module.
 * ZONE PARTAGÉE.
 */
import type { ContratAuth } from './auth'
import type { ContratCaisse } from './caisse'
import type { ContratCatalogue } from './catalogue'
import type { ContratMateriel } from './materiel'
import type { ContratSysteme } from './systeme'
import type { ContratUtilisateurs } from './utilisateurs'

export type ContratIpc = ContratSysteme &
  ContratAuth &
  ContratUtilisateurs &
  ContratCatalogue &
  ContratCaisse &
  ContratMateriel

export type Canal = keyof ContratIpc
export type Requete<C extends Canal> = ContratIpc[C]['requete']
export type Reponse<C extends Canal> = ContratIpc[C]['reponse']

/** Enveloppe de toute réponse IPC : jamais d'exception qui traverse la frontière. */
export type Resultat<T> = { ok: true; donnees: T } | { ok: false; erreur: string }
