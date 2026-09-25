/**
 * Import du catalogue depuis Excel (B3, REGLES_METIER § 2.6, UI_UX § 5.14). Propriétaire : Dev B.
 * Deux temps : « Vérifier le fichier » montre le sort de chaque ligne sans rien écrire, puis
 * « Importer » enregistre tout ou rien. Le bouton d'import reste grisé tant qu'une ligne est en erreur.
 */
import { useState } from 'react'
import type { EtatLigneImport, RapportImport } from '@shared/ipc/catalogue'
import { appel } from '@renderer/lib/api'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'

const ETATS: Record<EtatLigneImport, { texte: string; classe: string }> = {
  a_creer: { texte: 'À créer', classe: 'pastille-ok' },
  cree: { texte: 'Créé', classe: 'pastille-ok' },
  ignoree: { texte: 'Ignorée', classe: 'pastille-inactif' },
  erreur: { texte: 'Erreur', classe: 'pastille-erreur' }
}

const pluriel = (n: number, mot: string): string => `${n} ${mot}${n > 1 ? 's' : ''}`

export function FenetreImport(props: {
  onFermer: () => void
  onImporte: (rapport: RapportImport) => void
}): React.JSX.Element {
  const [rapport, setRapport] = useState<RapportImport | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Les deux boutons ouvrent une fenêtre du système : un seul à la fois, et le message précédent s'efface.
  const lancer = (action: () => Promise<void>): void => {
    setOccupe(true)
    setErreur(null)
    setMessage(null)
    action()
      .catch((e: Error) => setErreur(e.message))
      .finally(() => setOccupe(false))
  }

  const telechargerModele = (): void =>
    lancer(async () => {
      const { enregistre } = await appel('catalogue:telechargerModeleImport')
      if (enregistre)
        setMessage('Modèle enregistré. Remplissez-le dans Excel, enregistrez-le, puis vérifiez-le ici.')
    })

  const verifier = (): void =>
    lancer(async () => {
      const r = await appel('catalogue:verifierImport')
      // Annulé : on garde le rapport précédent.
      if (r) setRapport(r)
    })

  const importer = async (): Promise<void> => {
    props.onImporte(await appel('catalogue:importerCatalogue'))
  }

  const pret = rapport !== null && rapport.nbErreurs === 0 && rapport.nbCrees > 0 && !occupe

  return (
    <FenetreFormulaire
      titre="Importer le catalogue depuis Excel"
      libelleValider={
        rapport && rapport.nbCrees > 0 ? `Importer ${pluriel(rapport.nbCrees, 'produit')}` : 'Importer'
      }
      valide={pret}
      large
      onValider={importer}
      onFermer={props.onFermer}
    >
      <div className="formulaire-bloc">
        <p className="vide">
          Partez du modèle : une ligne par produit, avec au moins le nom et le prix de vente. Chaque produit
          est créé avec son conditionnement « Unité ». Un produit dont le code est déjà au catalogue est
          ignoré ; une seule ligne en erreur empêche tout l’import.
        </p>
        <div className="tableau-actions">
          <button type="button" className="btn btn-secondaire" onClick={telechargerModele} disabled={occupe}>
            Télécharger le modèle
          </button>
          <button type="button" className="btn" onClick={verifier} disabled={occupe}>
            {rapport ? 'Vérifier un autre fichier' : 'Vérifier le fichier'}
          </button>
        </div>
      </div>

      {message && (
        <p className="succes formulaire-bloc" role="status">
          {message}
        </p>
      )}
      {erreur && (
        <p className="alerte formulaire-bloc" role="alert">
          {erreur}
        </p>
      )}

      {rapport && (
        <div className="formulaire-bloc">
          <h3>{rapport.nomFichier}</h3>
          <div className="tableau-actions">
            <span className="pastille pastille-ok">{pluriel(rapport.nbCrees, 'produit')} à créer</span>
            <span className="pastille pastille-inactif">
              {pluriel(rapport.nbIgnorees, 'ligne')} ignorée{rapport.nbIgnorees > 1 ? 's' : ''}
            </span>
            {rapport.nbErreurs > 0 && (
              <span className="pastille pastille-erreur">
                {pluriel(rapport.nbErreurs, 'ligne')} en erreur
              </span>
            )}
          </div>
          {rapport.nbErreurs > 0 ? (
            <p className="alerte" role="alert">
              Corrigez les lignes en erreur dans Excel, enregistrez le fichier, puis vérifiez-le à nouveau.
              Rien n’est importé tant qu’il en reste une.
            </p>
          ) : rapport.nbCrees === 0 ? (
            <p className="bandeau">
              Tous les produits de ce fichier sont déjà au catalogue : rien à importer.
            </p>
          ) : null}
          {rapport.nouvellesCategories.length > 0 && (
            <p className="vide">Catégories qui seront créées : {rapport.nouvellesCategories.join(', ')}.</p>
          )}
          <div className="tableau-cadre">
            <table className="tableau">
              <thead>
                <tr>
                  <th className="nombre">Ligne</th>
                  <th>Produit</th>
                  <th>État</th>
                  <th>Détail</th>
                </tr>
              </thead>
              <tbody>
                {/* Erreurs d'abord : ce sont elles qu'il faut corriger. */}
                {[...rapport.lignes]
                  .sort(
                    (a, b) => Number(b.etat === 'erreur') - Number(a.etat === 'erreur') || a.ligne - b.ligne
                  )
                  .map((l) => (
                    <tr key={l.ligne}>
                      <td className="nombre">{l.ligne}</td>
                      <td>{l.nom || '—'}</td>
                      <td>
                        <span className={`pastille ${ETATS[l.etat].classe}`}>{ETATS[l.etat].texte}</span>
                      </td>
                      <td>{l.motif ?? ''}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </FenetreFormulaire>
  )
}
