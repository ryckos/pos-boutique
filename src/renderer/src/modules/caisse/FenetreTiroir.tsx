/**
 * Propriétaire : Dev A.
 *
 * « Espèces du tiroir » (tâche A8, règle 6.10) : le gérant voit ce que contient le tiroir d'après
 * le logiciel et les mouvements hors vente de la caisse, met ou sort des espèces (apport, retrait,
 * autre) et annule une erreur par un contre-mouvement. Une seule caisse ouverte : elle est prise
 * d'office ; plusieurs : il choisit celle du tiroir. Le tiroir s'ouvre après chaque enregistrement ;
 * s'il ne s'ouvre pas, le mouvement reste enregistré et la fenêtre le dit.
 */
import { useCallback, useEffect, useState } from 'react'
import type { MotifSaisiAuTiroir } from '@shared/caisse'
import type { MouvementCaisse, MouvementEnregistre, SessionOuverteResume } from '@shared/ipc/caisse'
import { formaterFCFA } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import { dateHeure } from './cloture'
import { lireMontant } from './paiement'
import {
  TITRES_SAISIE,
  annulableAuTiroir,
  heureMouvement,
  libelleEnregistrer,
  messageEnregistre,
  montantSigne,
  nouvelleSaisie,
  versRequeteMouvement,
  type SaisieMouvement
} from './tiroir'

interface Props {
  /** La caisse de la personne connectée, proposée d'abord. */
  sessionInitiale: number
  onFermer: () => void
}

export function FenetreTiroir({ sessionInitiale, onFermer }: Props): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionOuverteResume[]>([])
  const [sessionId, setSessionId] = useState(sessionInitiale)
  const [mouvements, setMouvements] = useState<MouvementCaisse[] | null>(null)
  const [enCaisse, setEnCaisse] = useState<number | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [resultat, setResultat] = useState<{ texte: string; tiroirOuvert: boolean } | null>(null)
  const [saisie, setSaisie] = useState<SaisieMouvement | null>(null)
  const [aAnnuler, setAAnnuler] = useState<MouvementCaisse | null>(null)
  const [motifAnnulation, setMotifAnnulation] = useState('')
  const sousFenetre = saisie !== null || aAnnuler !== null

  const charger = useCallback(async (id: number): Promise<void> => {
    setErreur(null)
    try {
      const [liste, rapport] = await Promise.all([
        appel('caisse:mouvementsSession', { sessionId: id }),
        appel('caisse:rapportSession', { sessionId: id })
      ])
      setMouvements(liste)
      setEnCaisse(rapport.especesTheoriques)
    } catch (e) {
      setErreur((e as Error).message)
    }
  }, [])

  useEffect(() => {
    appel('caisse:sessionsOuvertes')
      .then(setSessions)
      .catch((e: Error) => setErreur(e.message))
  }, [])

  useEffect(() => {
    void charger(sessionId)
  }, [charger, sessionId])

  // Échap ferme la fenêtre, sauf si un formulaire est ouvert par-dessus : il gère sa propre touche.
  useEffect(() => {
    if (sousFenetre) return
    const surTouche = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onFermer()
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [sousFenetre, onFermer])

  const apres = async ({ mouvement, tiroirOuvert }: MouvementEnregistre): Promise<void> => {
    setResultat({ texte: messageEnregistre(mouvement, tiroirOuvert), tiroirOuvert })
    await charger(mouvement.sessionId)
  }

  const ouvrirSaisie = (motif: MotifSaisiAuTiroir): void => {
    setResultat(null)
    setSaisie(nouvelleSaisie(sessionId, motif))
  }

  const requete = saisie && versRequeteMouvement(saisie)

  return (
    <div className="voile">
      <section
        className="fenetre fenetre-large fenetre-tiroir"
        role="dialog"
        aria-modal="true"
        aria-label="Espèces du tiroir"
      >
        <div className="fenetre-entete">
          <h2>Espèces du tiroir</h2>
          {enCaisse !== null && (
            <span className="tiroir-en-caisse">
              En caisse d’après le logiciel : <span className="montant">{formaterFCFA(enCaisse)}</span>
            </span>
          )}
        </div>

        {sessions.length > 1 && (
          <label className="champ">
            Caisse du tiroir
            <select value={sessionId} onChange={(e) => setSessionId(Number(e.target.value))}>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  Caisse de {s.caissier}, ouverte le {dateHeure(s.dateOuverture)}
                </option>
              ))}
            </select>
          </label>
        )}

        {resultat && (
          <p className={resultat.tiroirOuvert ? 'succes' : 'bandeau'} role="status">
            {resultat.texte}
          </p>
        )}
        {erreur && (
          <p className="alerte" role="alert">
            {erreur}
          </p>
        )}

        {mouvements === null ? (
          <p className="vide">Lecture des mouvements…</p>
        ) : mouvements.length === 0 ? (
          <p className="vide">Aucune entrée ni sortie d’espèces hors vente sur cette caisse.</p>
        ) : (
          <div className="tableau-cadre">
            <table className="tableau">
              <thead>
                <tr>
                  <th>Heure</th>
                  <th>Mouvement</th>
                  <th>Saisi par</th>
                  <th className="nombre">Montant</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {mouvements.map((m) => (
                  <tr key={m.id} className={m.annuleParId !== null ? 'inactif' : undefined}>
                    <td>{heureMouvement(m.horodatage)}</td>
                    <td>
                      {m.libelle}
                      {m.annuleParId !== null && <span className="pastille">Annulé</span>}
                    </td>
                    <td>{m.auteur}</td>
                    <td className="nombre montant">
                      {montantSigne(m) > 0 ? '+' : '−'}
                      {formaterFCFA(m.montant)}
                    </td>
                    <td className="tableau-actions">
                      {annulableAuTiroir(m) && (
                        <button
                          className="btn btn-discret"
                          onClick={() => {
                            setResultat(null)
                            setMotifAnnulation('')
                            setAAnnuler(m)
                          }}
                        >
                          Annuler
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="formulaire-actions tiroir-actions">
          <button className="btn" onClick={() => ouvrirSaisie('apport')}>
            Mettre des espèces (apport)
          </button>
          <button className="btn" onClick={() => ouvrirSaisie('retrait')}>
            Sortir des espèces (retrait)
          </button>
          <button className="btn btn-discret" onClick={() => ouvrirSaisie('autre')}>
            Autre mouvement
          </button>
          <button className="btn btn-secondaire" onClick={onFermer}>
            Fermer
          </button>
        </div>
      </section>

      {saisie && (
        <FenetreFormulaire
          titre={TITRES_SAISIE[saisie.motif]}
          libelleValider={libelleEnregistrer(saisie)}
          valide={requete !== null}
          onValider={async () => {
            if (!requete) return
            const r = await appel('caisse:enregistrerMouvement', requete)
            setSaisie(null)
            await apres(r)
          }}
          onFermer={() => setSaisie(null)}
        >
          {saisie.motif === 'autre' && (
            <label className="champ champ-large">
              Sens
              <select
                value={saisie.sens ?? ''}
                onChange={(e) =>
                  setSaisie({
                    ...saisie,
                    sens: e.target.value === '' ? null : (e.target.value as 'entree' | 'sortie')
                  })
                }
              >
                <option value="">Choisissez…</option>
                <option value="entree">Entrée : des espèces arrivent dans le tiroir</option>
                <option value="sortie">Sortie : des espèces quittent le tiroir</option>
              </select>
            </label>
          )}
          <label className="champ">
            Montant
            <input
              inputMode="numeric"
              value={saisie.montant}
              placeholder="Ex : 5000"
              onChange={(e) => setSaisie({ ...saisie, montant: e.target.value })}
            />
          </label>
          <label className="champ champ-large">
            Motif
            <input
              value={saisie.commentaire}
              maxLength={80}
              placeholder={
                saisie.motif === 'apport'
                  ? 'Ex : monnaie rapportée de la banque'
                  : saisie.motif === 'retrait'
                    ? 'Ex : versement à la banque'
                    : 'Ex : pièce retrouvée sous le comptoir'
              }
              onChange={(e) => setSaisie({ ...saisie, commentaire: e.target.value })}
            />
          </label>
          {lireMontant(saisie.montant) > 0 && (
            <p className="formulaire-bloc vide">
              Montant : {formaterFCFA(lireMontant(saisie.montant))}. Le motif s’imprime sur les rapports X et
              Z ; le tiroir s’ouvre à l’enregistrement.
            </p>
          )}
        </FenetreFormulaire>
      )}

      {aAnnuler && (
        <FenetreFormulaire
          titre="Annuler un mouvement de caisse"
          libelleValider="Annuler le mouvement"
          attention
          valide={motifAnnulation.trim() !== ''}
          onValider={async () => {
            const r = await appel('caisse:annulerMouvement', {
              mouvementId: aAnnuler.id,
              motif: motifAnnulation
            })
            setAAnnuler(null)
            await apres(r)
          }}
          onFermer={() => setAAnnuler(null)}
        >
          <p className="formulaire-bloc">
            {aAnnuler.libelle} : {formaterFCFA(aAnnuler.montant)} à {heureMouvement(aAnnuler.horodatage)}.
            <span className="vide">
              Le mouvement reste visible ; un mouvement inverse de {formaterFCFA(aAnnuler.montant)} l’annule.
              Remettez ou reprenez les espèces dans le tiroir.
            </span>
          </p>
          <label className="champ champ-large">
            Motif de l’annulation
            <input
              value={motifAnnulation}
              maxLength={80}
              placeholder="Ex : erreur de montant"
              onChange={(e) => setMotifAnnulation(e.target.value)}
            />
          </label>
        </FenetreFormulaire>
      )}
    </div>
  )
}
