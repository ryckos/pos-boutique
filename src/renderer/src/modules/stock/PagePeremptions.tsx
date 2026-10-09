/**
 * Tableau des péremptions (B9, REGLES_METIER § 5.1, UI_UX § 5.8). Propriétaire : Dev B.
 * Gérant. Les lots en stock qui périment bientôt, ou déjà périmés, et ce qu'ils valent au prix
 * d'achat ; « Retirer » sort tout ou partie d'un lot en perte. Le FEFO de la caisse vend d'abord
 * les lots les plus proches de leur date.
 */
import { useCallback, useEffect, useState } from 'react'
import type { LotPerimable, TableauPeremptions } from '@shared/ipc/stock'
import { UNITES_FRACTIONNAIRES } from '@shared/achats'
import { formaterDate, formaterFCFA, formaterQuantite } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import { BoutonExporter } from '@renderer/ui/BoutonExporter'
import { jourLocal } from '@renderer/lib/exportExcel'
import type { DemandeExport } from '@shared/ipc/exports'
import { lireNombre } from '../achats/saisieReception'

/** « Périmé depuis 2 j », « Périme aujourd'hui », « Dans 8 j ». */
export function texteEcheance(jours: number): string {
  if (jours < 0) return `Périmé depuis ${-jours} j`
  if (jours === 0) return 'Périme aujourd’hui'
  return `Dans ${jours} j`
}

/** L'export reprend le tableau affiché (REGLES_METIER § 11.2). */
function exportPeremptions(t: TableauPeremptions): DemandeExport {
  const jour = jourLocal()
  return {
    nomFichier: `Peremptions_${jour}`,
    titre: `Péremptions sous ${t.horizonJours} jours, au ${formaterDate(jour)}`,
    feuilles: [
      {
        nom: 'Péremptions',
        colonnes: [
          { titre: 'Produit', type: 'texte' },
          { titre: 'Lot', type: 'texte' },
          { titre: 'Périme le', type: 'date' },
          { titre: 'Échéance', type: 'texte' },
          { titre: 'Restant', type: 'nombre' },
          { titre: 'Unité', type: 'texte' },
          { titre: 'Prix d’achat', type: 'montant' },
          { titre: 'Valeur en jeu', type: 'montant' }
        ],
        lignes: [
          ...t.lots.map((l) => [
            l.produit,
            l.numeroLot ?? 'Sans numéro',
            l.datePeremption,
            texteEcheance(l.joursRestants),
            l.restant,
            l.unite,
            l.prixAchat,
            l.valeur
          ]),
          ['Total', null, null, null, null, null, null, t.valeurTotale]
        ]
      }
    ]
  }
}

export function PagePeremptions(): React.JSX.Element {
  const [tableau, setTableau] = useState<TableauPeremptions | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [aRetirer, setARetirer] = useState<LotPerimable | null>(null)

  const charger = useCallback(() => {
    appel('stock:peremptions')
      .then(setTableau)
      .catch((e: Error) => setErreur(e.message))
  }, [])
  useEffect(charger, [charger])

  const retirer = async (lot: LotPerimable, quantite: number, commentaire: string): Promise<void> => {
    await appel('stock:retirerLot', { lotId: lot.lotId, quantite, commentaire })
    setARetirer(null)
    setMessage(`« ${lot.produit} » : ${formaterQuantite(quantite)} retiré du stock, enregistré en perte.`)
    charger()
  }

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Péremptions — sous {tableau?.horizonJours ?? 15} jours</h1>
        {tableau && (
          <div className="tableau-actions">
            <span className="montant">Valeur en jeu : {formaterFCFA(tableau.valeurTotale)}</span>
            <BoutonExporter
              demande={() => exportPeremptions(tableau)}
              desactive={tableau.lots.length === 0}
            />
          </div>
        )}
      </header>

      {erreur && (
        <p className="alerte page-message" role="alert">
          {erreur}
        </p>
      )}
      {message && <p className="succes page-message">{message}</p>}

      {aRetirer && <FenetreRetrait lot={aRetirer} onValider={retirer} onFermer={() => setARetirer(null)} />}

      {tableau === null ? null : tableau.lots.length === 0 ? (
        <p className="vide">Aucun lot ne périme dans les {tableau.horizonJours} prochains jours.</p>
      ) : (
        <div className="tableau-cadre">
          <table className="tableau">
            <thead>
              <tr>
                <th>Produit · lot</th>
                <th>Périme le</th>
                <th className="nombre">Restant</th>
                <th className="nombre">Valeur</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tableau.lots.map((l) => (
                <tr key={l.lotId} className={l.urgent ? 'ligne-urgente' : 'ligne-proche'}>
                  <td>
                    {l.produit}
                    <span className="detail">{l.numeroLot ? `Lot ${l.numeroLot}` : 'Lot sans numéro'}</span>
                  </td>
                  <td>
                    {formaterDate(l.datePeremption)}
                    <span className="detail">{texteEcheance(l.joursRestants)}</span>
                  </td>
                  <td className="nombre">{formaterQuantite(l.restant)}</td>
                  <td className="nombre montant">{formaterFCFA(l.valeur)}</td>
                  <td>
                    <div className="tableau-actions">
                      <button
                        type="button"
                        className="btn btn-secondaire"
                        disabled
                        title="Disponible avec les promotions"
                      >
                        Promo −20 %
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondaire"
                        onClick={() => {
                          setMessage(null)
                          setARetirer(l)
                        }}
                      >
                        Retirer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="vide page-message">
        Le FEFO vend d’abord ces lots automatiquement. Les lots périmés ne sont plus vendus : retirez-les du
        rayon. Les promotions arriveront avec les promotions programmées.
      </p>
    </div>
  )
}

function FenetreRetrait(props: {
  lot: LotPerimable
  onValider: (lot: LotPerimable, quantite: number, commentaire: string) => Promise<void>
  onFermer: () => void
}): React.JSX.Element {
  const { lot } = props
  const [quantite, setQuantite] = useState(String(lot.restant).replace('.', ','))
  const [commentaire, setCommentaire] = useState('')
  const q = lireNombre(quantite)
  const auPoids = UNITES_FRACTIONNAIRES.includes(lot.unite)
  const valide =
    q !== null && Number.isFinite(q) && q > 0 && q <= lot.restant && (auPoids || Number.isInteger(q))
  const perte = valide && q !== null ? Math.round(q * lot.prixAchat) : 0

  return (
    <FenetreFormulaire
      titre={`Retirer « ${lot.produit} »${lot.numeroLot ? ` · lot ${lot.numeroLot}` : ''}`}
      libelleValider="Retirer du stock"
      attention
      valide={valide}
      onValider={() => props.onValider(lot, q ?? 0, commentaire)}
      onFermer={props.onFermer}
    >
      <p className="vide formulaire-bloc">
        {texteEcheance(lot.joursRestants)} · il reste {formaterQuantite(lot.restant)} dans ce lot. La sortie
        est enregistrée en perte, motif « Périmé ».
      </p>
      <label className="champ">
        Quantité à retirer
        <input
          inputMode="decimal"
          className="nombre"
          value={quantite}
          onChange={(e) => setQuantite(e.target.value)}
        />
        <span className="champ-aide">
          {valide
            ? `Perte au prix d’achat : ${formaterFCFA(perte)}.`
            : `Au plus ${formaterQuantite(lot.restant)}${auPoids ? '' : ', en nombre entier'}.`}
        </span>
      </label>
      <label className="champ champ-large">
        Commentaire (facultatif)
        <input
          placeholder="Ex. : emballages abîmés"
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
        />
      </label>
    </FenetreFormulaire>
  )
}
