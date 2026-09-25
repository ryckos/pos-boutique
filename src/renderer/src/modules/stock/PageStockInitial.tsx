/**
 * Stock initial de démarrage (B6, REGLES_METIER § 9.1, UI_UX § 5.15). Propriétaire : Dev B.
 * Gérant. On compte rayon par rayon ; chaque produit s'enregistre dès qu'il est compté, pour ne rien
 * perdre si le courant coupe.
 */
import { useCallback, useEffect, useState } from 'react'
import type { EtatStockInitialBoutique, FicheStockInitial, LigneStockInitial } from '@shared/ipc/stock'
import { formaterFCFA, formaterQuantite } from '@shared/format'
import { normaliserRecherche } from '@shared/texte'
import { appel } from '@renderer/lib/api'
import { useScanner } from '@renderer/lib/useScanner'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import { champsDepuisFiche, coutSaisi, manque, totalComptage, versSaisie } from './saisieStockInitial'

type Filtre = 'a_faire' | 'fait' | 'tous'

type Action =
  { type: 'compter'; fiche: FicheStockInitial } | { type: 'annuler'; ligne: LigneStockInitial } | null

const ETATS: Record<LigneStockInitial['etat'], { texte: string; classe: string }> = {
  a_faire: { texte: 'À compter', classe: 'pastille-alerte' },
  fait: { texte: 'Compté', classe: 'pastille-ok' },
  non_concerne: { texte: 'Déjà réceptionné', classe: 'pastille-inactif' }
}

export function PageStockInitial(): React.JSX.Element {
  const [etat, setEtat] = useState<EtatStockInitialBoutique | null>(null)
  const [filtre, setFiltre] = useState<Filtre>('a_faire')
  const [rayon, setRayon] = useState('')
  const [recherche, setRecherche] = useState('')
  const [action, setAction] = useState<Action>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)

  const charger = useCallback(() => {
    appel('stock:stockInitial')
      .then(setEtat)
      .catch((e: Error) => setErreur(e.message))
  }, [])
  useEffect(charger, [charger])

  const fermer = (): void => setAction(null)

  const ouvrirComptage = (produitId: number): void => {
    setErreur(null)
    setSucces(null)
    appel('stock:ficheStockInitial', { produitId })
      .then((fiche) => {
        if (fiche.etat === 'a_faire') setAction({ type: 'compter', fiche })
        else if (fiche.etat === 'fait') {
          setErreur(`Le stock initial de « ${fiche.nom} » est déjà enregistré. Annulez-le pour le refaire.`)
        } else setErreur(`« ${fiche.nom} » a déjà reçu une livraison : son stock vient des réceptions.`)
      })
      .catch((e: Error) => setErreur(e.message))
  }

  // Un scan ouvre directement le comptage du produit.
  const traiterCode = (code: string): void => {
    setRecherche('')
    appel('catalogue:rechercherCode', { code })
      .then((article) => {
        if (article) ouvrirComptage(article.produitId)
        else setErreur(`Code ${code} inconnu : créez d’abord le produit (page Produits).`)
      })
      .catch((e: Error) => setErreur(e.message))
  }
  useScanner(traiterCode, { actif: action === null })

  const surToucheRecherche = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    const code = recherche.trim()
    if (e.key === 'Enter' && /^\d+$/.test(code)) {
      e.preventDefault()
      traiterCode(code)
    }
  }

  const apres = (message: string): void => {
    setAction(null)
    setSucces(message)
    setErreur(null)
    charger()
  }

  const lignes = etat?.lignes ?? []
  const rayons = [...new Set(lignes.map((l) => l.rayon).filter((r): r is string => r !== null))].sort(
    (a, b) => a.localeCompare(b, 'fr')
  )
  const cle = normaliserRecherche(recherche.trim())
  const visibles = lignes.filter(
    (l) =>
      (filtre === 'tous' || l.etat === filtre) &&
      (rayon === '' || l.rayon === rayon) &&
      (cle === '' || normaliserRecherche(l.nom).includes(cle))
  )
  const nbConcernes = etat ? etat.nbFaits + etat.nbAFaire : 0

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Stock initial</h1>
        {etat && (
          <div className="tableau-actions">
            <span className="pastille pastille-ok">
              {etat.nbFaits} / {nbConcernes} produits comptés
            </span>
            <span className="montant">Valeur : {formaterFCFA(etat.valeurTotale)}</span>
          </div>
        )}
      </header>

      <p className="vide page-message">
        Comptez ce qu’il y a en rayon, produit par produit : chaque produit est enregistré dès que vous le
        validez. Le coût saisi devient son coût moyen d’achat. Scannez un article pour l’ouvrir directement.
      </p>
      {succes && (
        <p className="succes page-message" role="status">
          {succes}
        </p>
      )}
      {erreur && (
        <p className="alerte page-message" role="alert">
          {erreur}
        </p>
      )}

      {action?.type === 'compter' && (
        <FenetreComptage
          key={action.fiche.produitId}
          fiche={action.fiche}
          onFermer={fermer}
          onEnregistre={(q, valeur) =>
            apres(
              `« ${action.fiche.nom} » : ${formaterQuantite(q)} en stock, pour ${formaterFCFA(valeur)}. Au suivant !`
            )
          }
        />
      )}
      {action?.type === 'annuler' && (
        <FenetreAnnulation
          ligne={action.ligne}
          onFermer={fermer}
          onValider={async (motif) => {
            await appel('stock:annulerStockInitial', { produitId: action.ligne.produitId, motif })
            apres(
              `Le stock initial de « ${action.ligne.nom} » est annulé : vous pouvez le compter à nouveau.`
            )
          }}
        />
      )}

      <div className="filtres">
        <label className="champ champ-large">
          Rechercher
          <input
            placeholder="Nom du produit, ou code puis Entrée"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            onKeyDown={surToucheRecherche}
          />
        </label>
        <label className="champ">
          Rayon
          <select value={rayon} onChange={(e) => setRayon(e.target.value)}>
            <option value="">Tous les rayons</option>
            {rayons.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="champ">
          Afficher
          <select value={filtre} onChange={(e) => setFiltre(e.target.value as Filtre)}>
            <option value="a_faire">À compter</option>
            <option value="fait">Déjà comptés</option>
            <option value="tous">Tous les produits</option>
          </select>
        </label>
      </div>

      {etat === null ? null : visibles.length === 0 ? (
        <p className="vide">
          {filtre === 'a_faire' && etat.nbAFaire === 0
            ? 'Plus aucun produit à compter.'
            : 'Aucun produit ne correspond à ces filtres.'}
        </p>
      ) : (
        <div className="tableau-cadre">
          <table className="tableau">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Rayon</th>
                <th>État</th>
                <th className="nombre">Compté</th>
                <th className="nombre">Coût unitaire</th>
                <th className="nombre">Valeur</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibles.map((l) => (
                <tr key={l.produitId} className={l.etat === 'non_concerne' ? 'inactif' : undefined}>
                  <td>{l.nom}</td>
                  <td>{l.rayon ?? 'Non classé'}</td>
                  <td>
                    <span className={`pastille ${ETATS[l.etat].classe}`}>{ETATS[l.etat].texte}</span>
                  </td>
                  <td className="nombre">{l.quantite !== null ? formaterQuantite(l.quantite) : ''}</td>
                  <td className="nombre montant">
                    {l.coutUnitaire !== null ? formaterFCFA(l.coutUnitaire) : ''}
                  </td>
                  <td className="nombre montant">
                    {l.quantite !== null && l.coutUnitaire !== null
                      ? formaterFCFA(l.quantite * l.coutUnitaire)
                      : ''}
                  </td>
                  <td>
                    {l.etat === 'a_faire' && (
                      <button className="btn" onClick={() => ouvrirComptage(l.produitId)}>
                        Compter
                      </button>
                    )}
                    {l.etat === 'fait' && (
                      <button
                        className="btn btn-attention"
                        onClick={() => {
                          setErreur(null)
                          setSucces(null)
                          setAction({ type: 'annuler', ligne: l })
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
    </div>
  )
}

function FenetreComptage(props: {
  fiche: FicheStockInitial
  onFermer: () => void
  onEnregistre: (quantite: number, valeur: number) => void
}): React.JSX.Element {
  const { fiche } = props
  const [champs, setChamps] = useState(() => champsDepuisFiche(fiche))
  const total = totalComptage(fiche.conditionnements, champs.nombres)
  const cout = coutSaisi(champs.cout)
  const aCorriger = manque(fiche, champs)

  const enregistrer = async (): Promise<void> => {
    const r = await appel('stock:enregistrerStockInitial', versSaisie(fiche, champs))
    props.onEnregistre(r.quantiteBase, r.valeur)
  }

  return (
    <FenetreFormulaire
      titre={`Stock initial — ${fiche.nom}`}
      libelleValider="Enregistrer le stock de ce produit"
      valide={aCorriger === null}
      onValider={enregistrer}
      onFermer={props.onFermer}
    >
      {fiche.stockActuel !== 0 && (
        <p className="bandeau formulaire-bloc">
          Des mouvements existent déjà (stock calculé : {formaterQuantite(fiche.stockActuel)}), par exemple
          des ventes faites avant le comptage. Le stock sera remis exactement à ce que vous comptez.
        </p>
      )}
      {fiche.conditionnements.map((c) => (
        <label key={c.id} className="champ champ-etroit">
          {c.quantiteBase === 1 ? c.nom : `${c.nom} (×${formaterQuantite(c.quantiteBase)})`}
          <input
            inputMode="decimal"
            className="nombre"
            value={champs.nombres[c.id] ?? ''}
            onChange={(e) => setChamps({ ...champs, nombres: { ...champs.nombres, [c.id]: e.target.value } })}
          />
        </label>
      ))}
      <p className="formulaire-bloc montant">
        {Number.isNaN(total)
          ? 'Quantité illisible'
          : `= ${formaterQuantite(total)} unité${total > 1 ? 's' : ''}`}
      </p>
      <label className="champ champ-etroit">
        Coût d’achat par unité (F)
        <input
          inputMode="numeric"
          value={champs.cout}
          onChange={(e) => setChamps({ ...champs, cout: e.target.value })}
        />
      </label>
      {fiche.suiviPeremption && (
        <>
          <label className="champ">
            Date de péremption
            <input
              type="date"
              value={champs.datePeremption}
              onChange={(e) => setChamps({ ...champs, datePeremption: e.target.value })}
            />
          </label>
          <label className="champ">
            N° de lot (facultatif)
            <input
              value={champs.numeroLot}
              onChange={(e) => setChamps({ ...champs, numeroLot: e.target.value })}
            />
          </label>
        </>
      )}
      <div className="formulaire-bloc">
        {!Number.isNaN(total) && total > 0 && !Number.isNaN(cout) && (
          <p className="montant">Valeur du stock : {formaterFCFA(total * cout)}</p>
        )}
        {!Number.isNaN(cout) && fiche.prixUnite > 0 && cout >= fiche.prixUnite && (
          <p className="bandeau" role="status">
            Attention : ce coût ({formaterFCFA(cout)}) atteint ou dépasse le prix de vente de l’unité (
            {formaterFCFA(fiche.prixUnite)}). Vérifiez-le si ce n’est pas voulu.
          </p>
        )}
        {aCorriger && <p className="vide">{aCorriger}</p>}
      </div>
    </FenetreFormulaire>
  )
}

function FenetreAnnulation(props: {
  ligne: LigneStockInitial
  onValider: (motif: string) => Promise<void>
  onFermer: () => void
}): React.JSX.Element {
  const [motif, setMotif] = useState('')
  const { ligne } = props
  return (
    <FenetreFormulaire
      titre={`Annuler le stock initial de « ${ligne.nom} »`}
      libelleValider="Annuler le stock initial"
      attention
      valide={motif.trim() !== ''}
      onValider={() => props.onValider(motif)}
      onFermer={props.onFermer}
    >
      <p className="vide formulaire-bloc">
        Le comptage ({formaterQuantite(ligne.quantite ?? 0)} à {formaterFCFA(ligne.coutUnitaire ?? 0)}) est
        annulé par un mouvement inverse ; rien n’est effacé. Le produit repasse « à compter ».
      </p>
      <label className="champ champ-large">
        Motif
        <input
          placeholder="Ex. : carton compté deux fois"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
        />
      </label>
    </FenetreFormulaire>
  )
}
