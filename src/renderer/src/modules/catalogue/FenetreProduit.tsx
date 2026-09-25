/**
 * Fiche produit en fenêtre modale large : création et modification (UI_UX § 5.7). Propriétaire : Dev B.
 * L'« Unité » ×1 est toujours la première ligne, nom figé. La quantité d'un conditionnement déjà
 * enregistré ne se modifie pas (REGLES_METIER § 2.2) ; on le retire de la vente et on en crée un autre.
 */
import { useEffect, useState } from 'react'
import { alertesPrix } from '@shared/catalogue'
import type { AlertePrix } from '@shared/catalogue'
import type { Categorie, UniteBase } from '@shared/ipc/catalogue'
import { formaterFCFA } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import {
  champsDepuisCodeScanne,
  champsDepuisFiche,
  champsVides,
  lireNombre,
  LIBELLES_UNITE,
  nouveauConditionnement,
  prixParUnite,
  saisieComplete,
  versSaisie,
  type ChampsConditionnement,
  type ChampsProduit,
  type ChampsUnite
} from './saisieProduit'

export interface PropsFenetreProduit {
  /** Absent : nouveau produit. */
  produitId?: number
  /**
   * Création après le scan d'un code inconnu : le code est déjà celui de l'Unité et s'affiche en
   * pastille. Doit avoir un format valide (voir champsDepuisCodeScanne).
   */
  codeScanne?: string
  /** Après l'enregistrement : les alertes de prix éventuelles, à afficher sur la page. */
  onEnregistre: (nom: string, alertes: AlertePrix[]) => void
  onFermer: () => void
}

/** « Alimentation », puis « Alimentation › Conserves »… (catégories actives seulement). */
function optionsCategories(categories: Categorie[]): Array<{ id: number; libelle: string }> {
  const actives = categories.filter((c) => c.actif)
  const nom = (id: number | null): string => actives.find((c) => c.id === id)?.nom ?? ''
  return actives.map((c) => ({
    id: c.id,
    libelle: c.parentId === null ? c.nom : `${nom(c.parentId)} › ${c.nom}`
  }))
}

/** La douchette termine par Entrée : dans un champ de code, elle ne doit pas valider la fiche. */
const bloquerEntree = (e: React.KeyboardEvent): void => {
  if (e.key === 'Enter') e.preventDefault()
}

export function FenetreProduit(props: PropsFenetreProduit): React.JSX.Element {
  const [champs, setChamps] = useState<ChampsProduit | null>(
    props.produitId !== undefined
      ? null
      : (props.codeScanne !== undefined && champsDepuisCodeScanne(props.codeScanne)) || champsVides()
  )
  const [categories, setCategories] = useState<Categorie[]>([])
  const [erreurChargement, setErreurChargement] = useState<string | null>(null)

  useEffect(() => {
    appel('catalogue:categories')
      .then(setCategories)
      .catch((e: Error) => setErreurChargement(e.message))
    if (props.produitId !== undefined) {
      appel('catalogue:ficheProduit', { id: props.produitId })
        .then((f) => setChamps(champsDepuisFiche(f)))
        .catch((e: Error) => setErreurChargement(e.message))
    } else {
      // Nouveau produit : TVA proposée selon les paramètres (18 % tant qu'ils ne sont pas lus).
      appel('parametres:lire')
        .then((p) => setChamps((c) => c && { ...c, tauxTva: p.tvaDefaut }))
        .catch(() => undefined)
    }
  }, [props.produitId])

  const creation = props.produitId === undefined

  if (!champs) {
    return (
      <FenetreFormulaire
        key="chargement"
        titre="Fiche produit"
        libelleValider="Enregistrer les modifications"
        valide={false}
        large
        onValider={async () => undefined}
        onFermer={props.onFermer}
      >
        <p className={erreurChargement ? 'alerte formulaire-bloc' : 'vide formulaire-bloc'}>
          {erreurChargement ?? 'Chargement de la fiche…'}
        </p>
      </FenetreFormulaire>
    )
  }

  const modifier = (m: Partial<ChampsProduit>): void => setChamps({ ...champs, ...m })
  const modifierUnite = (m: Partial<ChampsUnite>): void =>
    setChamps({ ...champs, uniteVente: { ...champs.uniteVente, ...m } })
  const modifierLigne = (cle: string, m: Partial<ChampsConditionnement>): void =>
    setChamps({
      ...champs,
      conditionnements: champs.conditionnements.map((l) => (l.cle === cle ? { ...l, ...m } : l))
    })

  const genererCode = async (appliquer: (code: string) => void): Promise<void> => {
    try {
      appliquer((await appel('catalogue:genererCodeInterne')).code)
    } catch (e) {
      setErreurChargement((e as Error).message)
    }
  }

  // Garde-fou en direct : même règle que le principal, sur ce qui est tapé.
  const saisie = versSaisie(champs)
  const alertes = Number.isFinite(saisie.uniteVente.prixVente)
    ? alertesPrix(
        saisie.uniteVente.prixVente,
        saisie.conditionnements.filter((c) => c.actif && Number.isFinite(c.prixVente))
      )
    : []

  const enregistrer = async (): Promise<void> => {
    if (creation) {
      const r = await appel('catalogue:creerProduit', saisie)
      props.onEnregistre(saisie.nom.trim(), r.alertesPrix)
    } else {
      const r = await appel('catalogue:modifierProduit', { ...saisie, id: props.produitId! })
      props.onEnregistre(saisie.nom.trim(), r.alertesPrix)
    }
  }

  return (
    <FenetreFormulaire
      key="fiche"
      titre={creation ? 'Nouveau produit' : `Modifier « ${champs.nom} »`}
      pastille={
        creation &&
        props.codeScanne !== undefined && (
          <span className="pastille pastille-ok">Code scanné : {props.codeScanne}</span>
        )
      }
      libelleValider={creation ? 'Créer le produit' : 'Enregistrer les modifications'}
      valide={saisieComplete(champs)}
      large
      onValider={enregistrer}
      onFermer={props.onFermer}
    >
      <label className="champ champ-large">
        Nom
        <input value={champs.nom} onChange={(e) => modifier({ nom: e.target.value })} />
      </label>
      <label className="champ">
        Catégorie
        <select
          value={champs.categorieId ?? ''}
          onChange={(e) => modifier({ categorieId: e.target.value === '' ? null : Number(e.target.value) })}
        >
          <option value="">Non classé</option>
          {optionsCategories(categories).map((o) => (
            <option key={o.id} value={o.id}>
              {o.libelle}
            </option>
          ))}
        </select>
      </label>
      <label className="champ">
        Unité de base
        <select value={champs.unite} onChange={(e) => modifier({ unite: e.target.value as UniteBase })}>
          {(Object.keys(LIBELLES_UNITE) as UniteBase[]).map((u) => (
            <option key={u} value={u}>
              {LIBELLES_UNITE[u]}
            </option>
          ))}
        </select>
      </label>
      <label className="champ">
        TVA
        <select value={champs.tauxTva} onChange={(e) => modifier({ tauxTva: Number(e.target.value) })}>
          <option value={18}>18 %</option>
          <option value={0}>0 % (exonéré)</option>
        </select>
      </label>
      <label className="champ champ-etroit">
        Seuil d’alerte
        <input
          inputMode="decimal"
          value={champs.seuil}
          onChange={(e) => modifier({ seuil: e.target.value })}
        />
      </label>
      <label className="case">
        <input
          type="checkbox"
          checked={champs.suiviPeremption}
          onChange={(e) => modifier({ suiviPeremption: e.target.checked })}
        />
        Suivi de péremption (lot et date exigés à la réception)
      </label>

      <div className="formulaire-bloc">
        <h3>Conditionnements</h3>
        <div className="tableau-cadre">
          <table className="tableau tableau-saisie">
            <thead>
              <tr>
                <th>Nom</th>
                <th className="nombre">Contient</th>
                <th className="nombre">Prix de vente</th>
                <th className="nombre">Par unité</th>
                <th>Code-barres</th>
                <th>PLU</th>
                <th>Bouton caisse</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Unité</strong>
                </td>
                <td className="nombre">×1</td>
                <td>
                  <input
                    className="nombre"
                    inputMode="numeric"
                    aria-label="Prix de l’unité"
                    value={champs.uniteVente.prix}
                    onChange={(e) => modifierUnite({ prix: e.target.value })}
                  />
                </td>
                <td className="nombre montant">
                  {Number.isFinite(lireNombre(champs.uniteVente.prix)) &&
                    formaterFCFA(lireNombre(champs.uniteVente.prix))}
                </td>
                <CellulesCodes
                  champs={champs.uniteVente}
                  quoi="l’unité"
                  onChange={modifierUnite}
                  onGenerer={() => genererCode((code) => modifierUnite({ codeBarres: code }))}
                />
                <td />
              </tr>
              {champs.conditionnements.map((l) => {
                const parUnite = prixParUnite(l.prix, l.quantite)
                return (
                  <tr key={l.cle} className={l.actif ? undefined : 'inactif'}>
                    <td>
                      <input
                        aria-label="Nom du conditionnement"
                        placeholder="Pack de 6"
                        value={l.nom}
                        onChange={(e) => modifierLigne(l.cle, { nom: e.target.value })}
                      />
                    </td>
                    <td className="nombre">
                      {l.id === undefined ? (
                        <input
                          className="nombre champ-quantite"
                          inputMode="decimal"
                          aria-label="Nombre d’unités contenues"
                          value={l.quantite}
                          onChange={(e) => modifierLigne(l.cle, { quantite: e.target.value })}
                        />
                      ) : (
                        `×${l.quantite}`
                      )}
                    </td>
                    <td>
                      <input
                        className="nombre"
                        inputMode="numeric"
                        aria-label={`Prix de ${l.nom || 'ce conditionnement'}`}
                        value={l.prix}
                        onChange={(e) => modifierLigne(l.cle, { prix: e.target.value })}
                      />
                    </td>
                    <td className="nombre montant">{parUnite !== null && formaterFCFA(parUnite)}</td>
                    <CellulesCodes
                      champs={l}
                      quoi={l.nom || 'ce conditionnement'}
                      onChange={(m) => modifierLigne(l.cle, m)}
                      onGenerer={() => genererCode((code) => modifierLigne(l.cle, { codeBarres: code }))}
                    />
                    <td>
                      {l.id === undefined ? (
                        <button
                          type="button"
                          className="btn btn-secondaire"
                          onClick={() =>
                            modifier({
                              conditionnements: champs.conditionnements.filter((x) => x.cle !== l.cle)
                            })
                          }
                        >
                          Enlever
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={l.actif ? 'btn btn-attention' : 'btn btn-secondaire'}
                          onClick={() => modifierLigne(l.cle, { actif: !l.actif })}
                        >
                          {l.actif ? 'Retirer de la vente' : 'Remettre en vente'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="btn btn-secondaire"
          onClick={() =>
            modifier({ conditionnements: [...champs.conditionnements, nouveauConditionnement()] })
          }
        >
          + Ajouter un conditionnement
        </button>
        {alertes.map((a) => (
          <p key={a.conditionnement} className="bandeau" role="status">
            « {a.conditionnement} » à {formaterFCFA(a.prixVente)} coûte plus cher que la même quantité à
            l’unité ({formaterFCFA(a.prixALUnite)}). Vérifiez le prix ; vous pouvez enregistrer si c’est
            voulu.
          </p>
        ))}
        {erreurChargement && <p className="alerte">{erreurChargement}</p>}
      </div>
    </FenetreFormulaire>
  )
}

/** Code-barres (+ « Générer »), PLU et bouton de caisse d'une ligne. */
function CellulesCodes(props: {
  champs: ChampsUnite
  quoi: string
  onChange: (m: Partial<ChampsUnite>) => void
  onGenerer: () => void
}): React.JSX.Element {
  const c = props.champs
  return (
    <>
      <td>
        <div className="champ-avec-action">
          <input
            data-scan
            inputMode="numeric"
            aria-label={`Code-barres de ${props.quoi}`}
            placeholder="Scanner ou taper"
            value={c.codeBarres}
            onKeyDown={bloquerEntree}
            onChange={(e) => props.onChange({ codeBarres: e.target.value })}
          />
          {c.codeBarres === '' && (
            <button type="button" className="btn btn-secondaire" onClick={props.onGenerer}>
              Générer
            </button>
          )}
        </div>
      </td>
      <td>
        <input
          className="champ-plu"
          inputMode="numeric"
          aria-label={`Code PLU de ${props.quoi}`}
          value={c.codePlu}
          onKeyDown={bloquerEntree}
          onChange={(e) => props.onChange({ codePlu: e.target.value })}
        />
      </td>
      <td>
        <div className="champ-avec-action">
          {/* Toute l'étiquette est la cible (48 px) : une case seule est trop petite pour le doigt. */}
          <label className="case case-cellule" title={`Afficher ${props.quoi} en bouton à la caisse`}>
            <input
              type="checkbox"
              checked={c.bouton}
              onChange={(e) => props.onChange({ bouton: e.target.checked })}
            />
            En bouton
          </label>
          {c.bouton && (
            <input
              className="nombre champ-ordre"
              inputMode="numeric"
              aria-label={`Ordre du bouton de ${props.quoi}`}
              title="Ordre du bouton dans la grille de la caisse"
              value={c.ordre}
              onChange={(e) => props.onChange({ ordre: e.target.value })}
            />
          )}
        </div>
      </td>
    </>
  )
}
