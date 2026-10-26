/**
 * Sauvegardes : dernière sauvegarde, « Sauvegarder maintenant », clé USB, liste et restauration.
 * Propriétaire : Dev B. Gérant ; le dossier de la clé et la restauration sont à l'admin
 * (REGLES_METIER § 14). Les droits sont revérifiés par le processus principal.
 */
import { useCallback, useEffect, useState } from 'react'
import type { EtatSauvegardes, Sauvegarde } from '@shared/ipc/sauvegardes'
import { formaterDateHeure } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { useUtilisateur } from '@renderer/app/contexte'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import { LIBELLES_MOTIF, formaterTaille, messageCopieExterne } from './affichageSauvegardes'
import { BoutonIcone } from '@renderer/ui/BoutonIcone'
import { Icone } from '@renderer/ui/Icone'
import { Pagination } from '@renderer/ui/Pagination'
import { usePagination } from '@renderer/lib/pagination'
import { AideIcones } from '@renderer/ui/AideIcones'

/** Ce qu'on restaure : une sauvegarde de la liste, ou un fichier à choisir (sur la clé). */
type ARestaurer = { type: 'liste'; sauvegarde: Sauvegarde } | { type: 'fichier' } | null

export function PageSauvegardes(): React.JSX.Element {
  const admin = useUtilisateur().role === 'admin'
  const [etat, setEtat] = useState<EtatSauvegardes | null>(null)
  const [liste, setListe] = useState<Sauvegarde[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [message, setMessage] = useState<{ texte: string; alerte: boolean } | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [aRestaurer, setARestaurer] = useState<ARestaurer>(null)
  const [redemarrage, setRedemarrage] = useState(false)

  const charger = useCallback(() => {
    Promise.all([appel('sauvegardes:etat'), appel('sauvegardes:liste')])
      .then(([e, l]) => {
        setEtat(e)
        setListe(l)
        setErreur(null)
      })
      .catch((e: Error) => setErreur(e.message))
  }, [])

  useEffect(charger, [charger])

  const sauvegarderMaintenant = (): void => {
    setEnCours(true)
    setMessage(null)
    appel('sauvegardes:creer')
      .then((r) => {
        const copie = messageCopieExterne(r.copieExterne)
        setMessage({
          texte: `Sauvegarde faite (${formaterTaille(r.sauvegarde.taille)}). ${copie.texte}`,
          alerte: copie.alerte
        })
        charger()
      })
      .catch((e: Error) => setMessage({ texte: e.message, alerte: true }))
      .finally(() => setEnCours(false))
  }

  const choisirCle = (): void => {
    setMessage(null)
    appel('sauvegardes:choisirDossierExterne')
      .then((dossier) => {
        if (dossier) setMessage({ texte: `Les sauvegardes seront copiées dans ${dossier}.`, alerte: false })
        charger()
      })
      .catch((e: Error) => setMessage({ texte: e.message, alerte: true }))
  }

  const retirerCle = (): void => {
    setMessage(null)
    appel('parametres:ecrire', { sauvegardeDossierExterne: null })
      .then(() => {
        setMessage({ texte: 'Les sauvegardes ne seront plus copiées sur une clé USB.', alerte: false })
        charger()
      })
      .catch((e: Error) => setMessage({ texte: e.message, alerte: true }))
  }

  const pages = usePagination(liste ?? [])

  if (redemarrage) {
    return (
      <div className="page">
        <p className="page-message">Restauration en cours : l’application redémarre…</p>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Sauvegardes</h1>
        <AideIcones
          entrees={[
            'sauvegarder',
            ['dossier', 'Restaurer depuis un fichier, ou choisir la clé USB'],
            ['restaurer', 'Restaurer cette sauvegarde (admin)']
          ]}
          pagination
        />
        <div className="page-entete-actions">
          {admin && (
            <button className="btn btn-secondaire" onClick={() => setARestaurer({ type: 'fichier' })}>
              <Icone nom="dossier" />
              Restaurer depuis un fichier
            </button>
          )}
          <button className="btn" onClick={sauvegarderMaintenant} disabled={enCours}>
            <Icone nom="sauvegarder" />
            {enCours ? 'Sauvegarde en cours…' : 'Sauvegarder maintenant'}
          </button>
        </div>
      </header>

      {message && (
        <p
          className={message.alerte ? 'alerte page-message' : 'succes page-message'}
          role={message.alerte ? 'alert' : 'status'}
        >
          {message.texte}
        </p>
      )}
      {erreur && (
        <p className="alerte page-message" role="alert">
          {erreur}
        </p>
      )}

      {aRestaurer && (
        <FenetreRestauration
          aRestaurer={aRestaurer}
          onFermer={() => setARestaurer(null)}
          onValider={async () => {
            const r =
              aRestaurer.type === 'liste'
                ? await appel('sauvegardes:restaurer', { nom: aRestaurer.sauvegarde.nom })
                : await appel('sauvegardes:restaurerFichier')
            if (r.redemarrage) setRedemarrage(true)
            else setARestaurer(null) // fichier non choisi : rien n'a changé
          }}
        />
      )}

      {etat && (
        <div className="formulaire-bloc page-message">
          {etat.derniere ? (
            <p>
              Dernière sauvegarde : <strong>{formaterDateHeure(etat.derniere.date)}</strong> (
              {LIBELLES_MOTIF[etat.derniere.motif]}){' '}
              {etat.enRetard && <span className="pastille pastille-alerte">Plus de 2 jours</span>}
            </p>
          ) : (
            <p className="alerte" role="alert">
              Aucune sauvegarde pour l’instant : cliquez sur « Sauvegarder maintenant ».
            </p>
          )}
          {etat.enRetard && etat.derniere && (
            <p className="alerte" role="alert">
              La dernière sauvegarde a plus de 2 jours : cliquez sur « Sauvegarder maintenant ».
            </p>
          )}
          {etat.dernierEchec && (
            <p className="alerte" role="alert">
              La dernière sauvegarde automatique a échoué : {etat.dernierEchec}
            </p>
          )}
          <p className="tableau-actions">
            <span>
              Clé USB :{' '}
              {etat.dossierExterne ? (
                <>
                  {etat.dossierExterne}{' '}
                  <span
                    className={`pastille ${etat.dossierExternePresent ? 'pastille-ok' : 'pastille-alerte'}`}
                  >
                    {etat.dossierExternePresent ? 'Branchée' : 'Non branchée'}
                  </span>
                </>
              ) : (
                'aucune choisie'
              )}
            </span>
            {admin && (
              <button className="btn btn-secondaire" onClick={choisirCle}>
                <Icone nom="dossier" />
                {etat.dossierExterne ? 'Changer de clé' : 'Choisir la clé USB'}
              </button>
            )}
            {admin && etat.dossierExterne && (
              <button className="btn btn-discret" onClick={retirerCle}>
                Ne plus copier sur une clé
              </button>
            )}
          </p>
        </div>
      )}

      {liste && liste.length === 0 ? (
        <p className="vide">Aucune sauvegarde sur cet ordinateur.</p>
      ) : (
        liste && (
          <div className="tableau-cadre">
            <table className="tableau">
              <thead>
                <tr>
                  <th>Date et heure</th>
                  <th>Faite</th>
                  <th className="nombre">Taille</th>
                  {admin && (
                    <th className="colonne-actions">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {pages.elements.map((s) => (
                  <tr key={s.nom}>
                    <td className="cellule-titre">{formaterDateHeure(s.date)}</td>
                    <td>{LIBELLES_MOTIF[s.motif]}</td>
                    <td className="nombre">{formaterTaille(s.taille)}</td>
                    {admin && (
                      <td className="colonne-actions">
                        <BoutonIcone
                          icone="restaurer"
                          variante="attention"
                          libelle={`Restaurer la sauvegarde du ${formaterDateHeure(s.date)}`}
                          onClick={() => setARestaurer({ type: 'liste', sauvegarde: s })}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      <Pagination pages={pages} />
      <p className="vide note-bas">
        Une sauvegarde est faite à chaque clôture de caisse, au démarrage si la dernière a plus d’un jour et
        avant chaque mise à jour. On garde les 30 dernières, puis une par semaine pendant un an.
      </p>
    </div>
  )
}

function FenetreRestauration(props: {
  aRestaurer: NonNullable<ARestaurer>
  onValider: () => Promise<void>
  onFermer: () => void
}): React.JSX.Element {
  const [compris, setCompris] = useState(false)
  const s = props.aRestaurer.type === 'liste' ? props.aRestaurer.sauvegarde : null

  return (
    <FenetreFormulaire
      titre={s ? `Restaurer la sauvegarde du ${formaterDateHeure(s.date)}` : 'Restaurer depuis un fichier'}
      libelleValider={s ? 'Restaurer et redémarrer' : 'Choisir le fichier et restaurer'}
      attention
      valide={compris}
      onValider={props.onValider}
      onFermer={props.onFermer}
    >
      <div className="formulaire-bloc">
        <p>
          Toute la base sera remplacée par {s ? 'cette sauvegarde' : 'le fichier choisi (sur la clé USB)'}. Ce
          qui a été fait {s ? `après le ${formaterDateHeure(s.date)}` : 'depuis cette sauvegarde'} (ventes,
          réceptions, dépenses…) disparaîtra de l’application.
        </p>
        <p>
          La base actuelle est d’abord sauvegardée (« Avant une restauration ») : on peut revenir en arrière.
          L’application redémarre ensuite ; chacun devra se reconnecter.
        </p>
      </div>
      <label className="case">
        <input type="checkbox" checked={compris} onChange={(e) => setCompris(e.target.checked)} />
        J’ai compris : faire la restauration
      </label>
    </FenetreFormulaire>
  )
}
