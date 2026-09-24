/**
 * Propriétaire : Dev A.
 *
 * Fenêtre de paiement (UI_UX § 5.3), sur deux colonnes pour tenir sur l'écran du terminal sans
 * défiler :
 * - à gauche, les modes de paiement : montants TMoney / Flooz et leurs références ; la part en
 *   espèces n'est jamais saisie, c'est le reste (paiement.ts) ;
 * - à droite, toujours visibles : à payer, billets rapides, montant reçu du client, MONNAIE À
 *   RENDRE en très grand (l'élément fort) et « Encaisser ».
 * Comme la recherche F2, elle garde `.voile` / `.fenetre` (fenêtre de caisse, pas un formulaire de
 * gestion) ; comme FenetreFormulaire, un toucher à côté ne la ferme pas.
 */
import { useEffect, useState } from 'react'
import type { ModePaiementCaisse } from '@shared/ipc/caisse'
import { formaterFCFA } from '@shared/format'
import {
  BILLETS_RAPIDES,
  LIBELLES_MODES,
  MODES_MOBILES,
  ajouterBillet,
  ajouterMode,
  blocage,
  changerMontant,
  changerRecu,
  changerReference,
  lireMontant,
  monnaieARendre,
  montantExact,
  nombreDeModes,
  ouvrirPaiement,
  partEspeces,
  resteAPayer,
  retirerMode,
  type EtatPaiement
} from './paiement'

/**
 * Toucher un champ de montant sélectionne tout son contenu : la frappe REMPLACE le montant au lieu
 * de s'y ajouter (bogue trouvé à l'essai : « 8500 » + « 5000 » donnait 85 005 000). Différé d'une
 * image, sinon le relâchement du doigt annule la sélection.
 */
const selectionnerTout = (e: React.FocusEvent<HTMLInputElement>): void => {
  const champ = e.currentTarget
  requestAnimationFrame(() => champ.select())
}

interface Props {
  total: number
  modeInitial: ModePaiementCaisse
  /** Envoie la vente ; en cas de refus, le message s'affiche ici et la saisie est gardée. */
  onEncaisser: (etat: EtatPaiement) => Promise<void>
  onFermer: () => void
}

export function FenetrePaiement({ total, modeInitial, onEncaisser, onFermer }: Props): React.JSX.Element {
  const [etat, setEtat] = useState(() => ouvrirPaiement(total, modeInitial))
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const probleme = blocage(etat)
  const especes = partEspeces(etat)
  const mixte = nombreDeModes(etat) > 1
  const modesAjoutables = (['especes', ...MODES_MOBILES] as ModePaiementCaisse[]).filter((m) =>
    m === 'especes' ? !etat.especes : !etat.mobiles.some((p) => p.mode === m)
  )

  useEffect(() => {
    const surTouche = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !envoi) onFermer()
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [envoi, onFermer])

  const encaisser = (e: React.FormEvent): void => {
    e.preventDefault()
    if (probleme || envoi) return
    setEnvoi(true)
    setErreur(null)
    onEncaisser(etat)
      .catch((err: Error) => setErreur(err.message))
      .finally(() => setEnvoi(false))
  }

  return (
    <div className="voile">
      <form
        className="fenetre fenetre-paiement"
        role="dialog"
        aria-modal="true"
        aria-label="Paiement"
        onSubmit={encaisser}
      >
        {/* ─── Colonne gauche : modes de paiement ─── */}
        <div className="paiement-modes">
          <h2>Paiement</h2>

          {etat.especes && (
            <div className="paiement-ligne">
              <div className="paiement-ligne-entete">
                <h3>Espèces</h3>
                <span className="montant paiement-part">{formaterFCFA(especes)}</span>
              </div>
              {mixte && (
                <div className="paiement-ligne-pied">
                  <span className="vide">Le reste du total, calculé seul.</span>
                  <button
                    type="button"
                    className="btn btn-discret"
                    onClick={() => setEtat((s) => retirerMode(s, 'especes'))}
                  >
                    Retirer les espèces
                  </button>
                </div>
              )}
            </div>
          )}

          {etat.mobiles.map((p) => (
            <div key={p.mode} className="paiement-ligne">
              <div className="paiement-ligne-entete">
                <h3>{LIBELLES_MODES[p.mode]}</h3>
                {mixte ? (
                  <button
                    type="button"
                    className="btn btn-discret"
                    onClick={() => setEtat((s) => retirerMode(s, p.mode))}
                  >
                    Retirer {LIBELLES_MODES[p.mode]}
                  </button>
                ) : (
                  <span className="montant paiement-part">{formaterFCFA(p.montant)}</span>
                )}
              </div>
              {mixte && (
                <label className="champ">
                  Montant payé en {LIBELLES_MODES[p.mode]}
                  <input
                    inputMode="numeric"
                    value={String(p.montant)}
                    autoFocus={p.montant === 0}
                    onFocus={selectionnerTout}
                    onChange={(e) => setEtat((s) => changerMontant(s, p.mode, lireMontant(e.target.value)))}
                  />
                </label>
              )}
              <label className="champ">
                Référence de la transaction {LIBELLES_MODES[p.mode]} (obligatoire)
                <input
                  value={p.reference}
                  autoFocus={!mixte}
                  onChange={(e) => setEtat((s) => changerReference(s, p.mode, e.target.value))}
                />
              </label>
            </div>
          ))}

          {modesAjoutables.length > 0 && (
            <div className="paiement-ajouts">
              {modesAjoutables.map((m) => (
                <button
                  key={m}
                  type="button"
                  className="btn btn-discret"
                  onClick={() => setEtat((s) => ajouterMode(s, m))}
                >
                  {m === 'especes' ? 'Ajouter des espèces' : `Ajouter un paiement ${LIBELLES_MODES[m]}`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ─── Colonne droite : toujours visible ─── */}
        <div className="paiement-caisse">
          <div className="paiement-a-payer">
            <span>À payer</span>
            <span className="montant">{formaterFCFA(total)}</span>
          </div>

          {!etat.especes && mixte && (
            <div className="paiement-reste">
              <span>Reste à payer</span>
              <span className="montant">{formaterFCFA(Math.max(resteAPayer(etat), 0))}</span>
            </div>
          )}

          {especes > 0 && (
            <>
              <div className="paiement-billets">
                {BILLETS_RAPIDES.map((b) => (
                  <button
                    key={b}
                    type="button"
                    className="btn btn-secondaire paiement-billet"
                    onClick={() => setEtat((s) => ajouterBillet(s, b))}
                  >
                    + {formaterFCFA(b)}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-secondaire paiement-billet"
                  onClick={() => setEtat(montantExact)}
                >
                  Montant exact
                </button>
              </div>
              <div className="paiement-recu">
                <label className="champ">
                  Montant reçu du client
                  <input
                    inputMode="numeric"
                    value={etat.recu === null ? '' : String(etat.recu)}
                    placeholder={`${especes} (montant exact)`}
                    onFocus={selectionnerTout}
                    onChange={(e) =>
                      setEtat((s) =>
                        changerRecu(s, e.target.value.trim() ? lireMontant(e.target.value) : null)
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-discret"
                  disabled={etat.recu === null}
                  onClick={() => setEtat((s) => changerRecu(s, null))}
                >
                  Effacer
                </button>
              </div>
              <div className="paiement-monnaie">
                <span>Monnaie à rendre</span>
                <span className="montant">{formaterFCFA(monnaieARendre(etat))}</span>
              </div>
            </>
          )}

          {(erreur ?? probleme) && (
            <p className={erreur ? 'alerte' : 'bandeau'} role={erreur ? 'alert' : undefined}>
              {erreur ?? probleme}
            </p>
          )}

          <div className="paiement-actions">
            {/* En espèces, le focus est ici : F4 puis Entrée encaissent un paiement exact. */}
            <button
              type="submit"
              className="btn paiement-encaisser"
              autoFocus={modeInitial === 'especes'}
              disabled={probleme !== null || envoi}
            >
              Encaisser
            </button>
            <button type="button" className="btn btn-secondaire" onClick={onFermer} disabled={envoi}>
              Revenir au ticket (Échap)
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
