/**
 * Réceptions de marchandise (B8, REGLES_METIER § 4, UI_UX § 5.6). Propriétaire : Dev B. Gérant.
 * La liste des réceptions validées, et la saisie d'une nouvelle réception : on saisit ce qu'on a devant
 * soi (3 cartons à 6 000) et l'écran convertit en direct. Le brouillon reste sur le poste jusqu'à la
 * validation ; le numéro RC n'est attribué qu'à ce moment-là.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Reception, ResumeReception } from '@shared/ipc/achats'
import type { Fournisseur } from '@shared/ipc/fournisseurs'
import type { ArticleCatalogue } from '@shared/types'
import { formaterDate, formaterFCFA, formaterQuantite } from '@shared/format'
import { appel } from '@renderer/lib/api'
import { useScanner } from '@renderer/lib/useScanner'
import { FenetreFormulaire } from '@renderer/ui/FenetreFormulaire'
import { FenetreDetailReception } from './FenetreDetailReception'
import { FenetreProduit } from '@renderer/modules/catalogue/FenetreProduit'
import { champsDepuisCodeScanne } from '@renderer/modules/catalogue/saisieProduit'
import {
  ajouterArticle,
  brouillonUtile,
  brouillonVide,
  etatLigne,
  lireBrouillon,
  manque,
  modifierLigne,
  retirerLigne,
  texteConversion,
  totalBrouillon,
  versSaisie,
  type Brouillon,
  type LigneBrouillon
} from './saisieReception'

const CLE_BROUILLON = 'pos.reception.brouillon'

// Le stockage du poste peut être indisponible : le brouillon est alors perdu à la fermeture, sans plus.
function brouillonGarde(): Brouillon | null {
  try {
    return lireBrouillon(localStorage.getItem(CLE_BROUILLON))
  } catch {
    return null
  }
}
function garderBrouillon(b: Brouillon | null): void {
  try {
    if (b && brouillonUtile(b)) localStorage.setItem(CLE_BROUILLON, JSON.stringify(b))
    else localStorage.removeItem(CLE_BROUILLON)
  } catch {
    /* stockage indisponible */
  }
}

/** Date du jour du poste, AAAA-MM-JJ. */
function aujourdhuiLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function PageReceptions(): React.JSX.Element {
  const [saisie, setSaisie] = useState<Brouillon | null>(() => brouillonGarde())
  const [reprise] = useState(() => saisie !== null)
  const [succes, setSucces] = useState<string | null>(null)

  if (saisie) {
    return (
      <SaisieReception
        initial={saisie}
        reprise={reprise}
        onTerminer={(message) => {
          garderBrouillon(null)
          setSaisie(null)
          setSucces(message)
        }}
      />
    )
  }
  return (
    <ListeReceptions
      succes={succes}
      onNouvelle={() => {
        setSucces(null)
        setSaisie(brouillonVide())
      }}
    />
  )
}

// ─── Liste des réceptions validées ────────────────────────────────────────────

function ListeReceptions(props: { succes: string | null; onNouvelle: () => void }): React.JSX.Element {
  const [receptions, setReceptions] = useState<ResumeReception[] | null>(null)
  const [detail, setDetail] = useState<Reception | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    appel('achats:listeReceptions')
      .then(setReceptions)
      .catch((e: Error) => setErreur(e.message))
  }, [])

  const ouvrir = (id: number): void => {
    appel('achats:reception', { id })
      .then(setDetail)
      .catch((e: Error) => setErreur(e.message))
  }

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Réceptions</h1>
        <button className="btn" onClick={props.onNouvelle}>
          Nouvelle réception
        </button>
      </header>
      {props.succes && (
        <p className="succes page-message" role="status">
          {props.succes}
        </p>
      )}
      {erreur && (
        <p className="alerte page-message" role="alert">
          {erreur}
        </p>
      )}
      {detail && <FenetreDetailReception reception={detail} onFermer={() => setDetail(null)} />}

      {receptions === null ? null : receptions.length === 0 ? (
        <p className="vide">
          Aucune réception pour l’instant. Touchez « Nouvelle réception » à l’arrivée de la prochaine
          livraison.
        </p>
      ) : (
        <div className="tableau-cadre">
          <table className="tableau">
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Date</th>
                <th>Fournisseur</th>
                <th className="nombre">Articles</th>
                <th className="nombre">Total</th>
                <th>À payer avant le</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {receptions.map((r) => (
                <tr key={r.id}>
                  <td>{r.numero}</td>
                  <td>
                    {formaterDate(r.dateReception)}
                    <span className="detail">par {r.utilisateur}</span>
                  </td>
                  <td>{r.fournisseur}</td>
                  <td className="nombre">{r.nbLignes}</td>
                  <td className="nombre montant">{formaterFCFA(r.total)}</td>
                  <td>{r.dateEcheance ? formaterDate(r.dateEcheance) : ''}</td>
                  <td>
                    <button className="btn btn-secondaire" onClick={() => ouvrir(r.id)}>
                      Voir le détail
                    </button>
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

// ─── Saisie d'une nouvelle réception ──────────────────────────────────────────

type Fenetre =
  | { type: 'creerProduit'; code: string }
  | { type: 'modifierProduit'; produitId: number; nom: string }
  | { type: 'valider' }
  | { type: 'abandonner' }
  | null

function SaisieReception(props: {
  initial: Brouillon
  reprise: boolean
  onTerminer: (message: string | null) => void
}): React.JSX.Element {
  const [b, setB] = useState<Brouillon>(props.initial)
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [seuil, setSeuil] = useState(15)
  const [options, setOptions] = useState<Record<number, ArticleCatalogue[]>>({})
  const [recherche, setRecherche] = useState('')
  const [resultats, setResultats] = useState<ArticleCatalogue[]>([])
  const [codeInconnu, setCodeInconnu] = useState<string | null>(null)
  const [fenetre, setFenetre] = useState<Fenetre>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(
    props.reprise ? 'Réception en cours reprise là où vous l’aviez laissée.' : null
  )
  const aujourdhui = aujourdhuiLocal()

  // Chaque changement est gardé sur le poste : une coupure ne fait pas perdre la saisie.
  useEffect(() => garderBrouillon(b), [b])

  useEffect(() => {
    appel('fournisseurs:liste')
      .then((liste) => setFournisseurs(liste.filter((f) => f.actif)))
      .catch((e: Error) => setErreur(e.message))
    appel('parametres:lire')
      .then((p) => setSeuil(p.peremptionSeuilJours))
      .catch(() => undefined)
  }, [])

  // Conditionnements proposés pour chaque produit du brouillon (changer carton / unité sur une ligne).
  const chargerOptions = useCallback((produitId: number) => {
    appel('catalogue:conditionnementsProduit', { produitId })
      .then((liste) => setOptions((o) => ({ ...o, [produitId]: liste })))
      .catch(() => undefined)
  }, [])
  const aCharger = [...new Set(b.lignes.map((l) => l.article.produitId))].filter((id) => !(id in options))
  const cleACharger = aCharger.join(',')
  useEffect(() => {
    if (cleACharger) cleACharger.split(',').map(Number).forEach(chargerOptions)
  }, [cleACharger, chargerOptions])

  const ajouter = (conditionnementId: number): void => {
    appel('achats:articleReception', { conditionnementId })
      .then((article) => {
        if (!article) {
          setErreur('Cet article n’est plus en vente : réactivez-le ou choisissez-en un autre.')
          return
        }
        setB((x) => ajouterArticle(x, article))
        setErreur(null)
        setInfo(null)
      })
      .catch((e: Error) => setErreur(e.message))
  }

  // La douchette écrit dans le champ puis envoie Entrée : le code peut arriver par le lecteur et par
  // la touche Entrée du champ. On ignore le second passage du même code.
  const dernierCode = useRef({ code: '', instant: 0 })
  const traiterCode = (code: string): void => {
    const maintenant = Date.now()
    if (dernierCode.current.code === code && maintenant - dernierCode.current.instant < 500) return
    dernierCode.current = { code, instant: maintenant }
    setRecherche('')
    setResultats([])
    setCodeInconnu(null)
    appel('catalogue:rechercherCode', { code })
      .then((article) => {
        if (article) ajouter(article.conditionnementId)
        else setCodeInconnu(code)
      })
      .catch((e: Error) => setErreur(e.message))
  }
  useScanner(traiterCode, { actif: fenetre === null })

  // Recherche par nom dès 2 lettres.
  useEffect(() => {
    const t = recherche.trim()
    if (t.length < 2 || /^\d+$/.test(t)) {
      setResultats([])
      return
    }
    let annule = false
    appel('catalogue:rechercher', { texte: t })
      .then((r) => !annule && setResultats(r))
      .catch(() => undefined)
    return () => {
      annule = true
    }
  }, [recherche])

  const surToucheRecherche = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const t = recherche.trim()
    if (/^\d+$/.test(t)) traiterCode(t)
    else if (resultats.length > 0) choisir(resultats[0])
  }
  const choisir = (a: ArticleCatalogue): void => {
    setRecherche('')
    setResultats([])
    ajouter(a.conditionnementId)
  }

  const changerConditionnement = (l: LigneBrouillon, conditionnementId: number): void => {
    appel('achats:articleReception', { conditionnementId })
      .then((article) => {
        if (!article) return
        setB((x) =>
          modifierLigne(x, l.cle, {
            article,
            prix: article.prixPropose !== null ? String(article.prixPropose) : ''
          })
        )
      })
      .catch((e: Error) => setErreur(e.message))
  }

  const total = totalBrouillon(b, aujourdhui, seuil)
  const aCorriger = manque(b, aujourdhui, seuil)
  const fournisseur = fournisseurs.find((f) => f.id === b.fournisseurId)

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Nouvelle réception</h1>
        <span className="pastille pastille-alerte">Brouillon · numéro attribué à la validation</span>
      </header>
      {info && (
        <p className="succes page-message" role="status">
          {info}
        </p>
      )}
      {erreur && (
        <p className="alerte page-message" role="alert">
          {erreur}
        </p>
      )}

      <div className="filtres">
        <label className="champ">
          Fournisseur
          <select
            value={b.fournisseurId ?? ''}
            onChange={(e) => setB({ ...b, fournisseurId: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Choisissez le fournisseur</option>
            {fournisseurs.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="champ champ-large">
          Ajouter un article
          <input
            data-scan
            placeholder="Scannez ou tapez un nom"
            value={recherche}
            onChange={(e) => {
              setRecherche(e.target.value)
              setCodeInconnu(null)
            }}
            onKeyDown={surToucheRecherche}
          />
        </label>
      </div>

      {resultats.length > 0 && (
        <div className="tableau-cadre page-message">
          <ul className="recherche-resultats">
            {resultats.map((a) => (
              <li key={a.conditionnementId}>
                <button className="recherche-resultat" onClick={() => choisir(a)}>
                  <span>{a.designation}</span>
                  <span className="vide">{a.codeBarres ?? a.codePlu ?? ''}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {codeInconnu !== null &&
        (champsDepuisCodeScanne(codeInconnu) ? (
          <div className="bandeau bandeau-action page-message">
            <span>
              Code {codeInconnu} inconnu. Nouveau produit : créez-le. Carton d’un produit connu : cherchez le
              produit par son nom, puis « Modifier la fiche » pour ajouter ce conditionnement.
            </span>
            <button className="btn" onClick={() => setFenetre({ type: 'creerProduit', code: codeInconnu })}>
              Créer le produit
            </button>
          </div>
        ) : (
          <p className="alerte page-message" role="alert">
            Code {codeInconnu} illisible : un code-barres a 8 à 14 chiffres, un code PLU 1 à 5. Scannez à
            nouveau.
          </p>
        ))}

      {b.lignes.length === 0 ? (
        <p className="vide page-message">
          Scannez le code du carton (ou du produit) reçu, puis saisissez la quantité et le prix du bon de
          livraison.
        </p>
      ) : (
        <div className="tableau-cadre page-message">
          <table className="tableau tableau-saisie">
            <thead>
              <tr>
                <th>Article</th>
                <th className="nombre">Qté reçue</th>
                <th className="nombre">Prix d’achat</th>
                <th className="nombre">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {b.lignes.map((l) => (
                <LigneSaisie
                  key={l.cle}
                  ligne={l}
                  options={options[l.article.produitId] ?? []}
                  aujourdhui={aujourdhui}
                  seuil={seuil}
                  onModifier={(champs) => setB((x) => modifierLigne(x, l.cle, champs))}
                  onConditionnement={(id) => changerConditionnement(l, id)}
                  onFiche={() =>
                    setFenetre({
                      type: 'modifierProduit',
                      produitId: l.article.produitId,
                      nom: l.article.produit
                    })
                  }
                  onRetirer={() => setB((x) => retirerLigne(x, l.cle))}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="filtres">
        <label className="champ champ-large">
          Commentaire (facultatif)
          <input
            placeholder="Ex. : bon de livraison n° 457"
            value={b.commentaire}
            onChange={(e) => setB({ ...b, commentaire: e.target.value })}
          />
        </label>
      </div>

      <div className="page-entete">
        <span className="vide">
          {b.lignes.length} ligne{b.lignes.length > 1 ? 's' : ''} · à comparer au bon de livraison
        </span>
        <div className="tableau-actions">
          <span className="montant">
            <strong>Total : {formaterFCFA(total)}</strong>
          </span>
          <button
            className="btn btn-secondaire"
            onClick={() => (brouillonUtile(b) ? setFenetre({ type: 'abandonner' }) : props.onTerminer(null))}
          >
            {brouillonUtile(b) ? 'Abandonner la saisie' : 'Retour à la liste'}
          </button>
          <button
            className="btn"
            disabled={aCorriger !== null}
            onClick={() => setFenetre({ type: 'valider' })}
          >
            Valider la réception
          </button>
        </div>
      </div>
      {aCorriger && <p className="vide">{aCorriger}</p>}

      {fenetre?.type === 'creerProduit' && (
        <FenetreProduit
          codeScanne={fenetre.code}
          libelleValider="Enregistrer et ajouter à la réception"
          onFermer={() => setFenetre(null)}
          onEnregistre={() => {
            const code = fenetre.code
            setFenetre(null)
            setCodeInconnu(null)
            appel('catalogue:rechercherCode', { code })
              .then((a) => a && ajouter(a.conditionnementId))
              .catch((e: Error) => setErreur(e.message))
          }}
        />
      )}
      {fenetre?.type === 'modifierProduit' && (
        <FenetreProduit
          produitId={fenetre.produitId}
          onFermer={() => setFenetre(null)}
          onEnregistre={() => {
            chargerOptions(fenetre.produitId)
            setInfo(
              `Fiche de « ${fenetre.nom} » enregistrée : choisissez le conditionnement reçu sur la ligne.`
            )
            setFenetre(null)
          }}
        />
      )}
      {fenetre?.type === 'valider' && (
        <FenetreFormulaire
          titre="Valider la réception"
          libelleValider="Valider la réception"
          valide
          onFermer={() => setFenetre(null)}
          onValider={async () => {
            const r = await appel('achats:validerReception', versSaisie(b))
            props.onTerminer(
              `Réception ${r.numero} validée : stock mis à jour, ${formaterFCFA(r.total)} dus à ${
                fournisseur?.nom ?? 'ce fournisseur'
              }, à payer avant le ${formaterDate(r.dateEcheance)}.`
            )
          }}
        >
          <p className="formulaire-bloc">
            {b.lignes.length} ligne{b.lignes.length > 1 ? 's' : ''} de {fournisseur?.nom} pour{' '}
            <strong className="montant">{formaterFCFA(total)}</strong>. Le total correspond-il au bon de
            livraison ? Une réception validée ne se modifie plus : une erreur se corrigera par un retour ou un
            inventaire.
          </p>
        </FenetreFormulaire>
      )}
      {fenetre?.type === 'abandonner' && (
        <FenetreFormulaire
          titre="Abandonner la saisie"
          libelleValider="Abandonner la saisie"
          attention
          valide
          onFermer={() => setFenetre(null)}
          onValider={async () => props.onTerminer(null)}
        >
          <p className="formulaire-bloc">
            Les {b.lignes.length} ligne{b.lignes.length > 1 ? 's' : ''} saisie{b.lignes.length > 1 ? 's' : ''}{' '}
            seront perdues. Rien n’a encore été enregistré : le stock ne change pas.
          </p>
        </FenetreFormulaire>
      )}
    </div>
  )
}

function LigneSaisie(props: {
  ligne: LigneBrouillon
  options: ArticleCatalogue[]
  aujourdhui: string
  seuil: number
  onModifier: (champs: Partial<LigneBrouillon>) => void
  onConditionnement: (conditionnementId: number) => void
  onFiche: () => void
  onRetirer: () => void
}): React.JSX.Element {
  const { ligne: l, options } = props
  const a = l.article
  const e = etatLigne(l, props.aujourdhui, props.seuil)
  const conversion = e.conversion && texteConversion(a, e.conversion)
  const entame = l.quantite !== '' || l.numeroLot !== '' || l.datePeremption !== ''
  // La douchette finit par Entrée : dans un champ de la ligne, elle ne doit rien valider.
  const bloquerEntree = (ev: React.KeyboardEvent): void => {
    if (ev.key === 'Enter') ev.preventDefault()
  }

  return (
    <tr>
      <td>
        <strong>{a.produit}</strong>
        <div className="champ-avec-action">
          <select
            aria-label="Conditionnement reçu"
            value={a.conditionnementId}
            onChange={(ev) => props.onConditionnement(Number(ev.target.value))}
          >
            {options.length === 0 && <option value={a.conditionnementId}>{a.conditionnement}</option>}
            {options.map((o) => (
              <option key={o.conditionnementId} value={o.conditionnementId}>
                {o.conditionnement}
                {o.quantiteBase !== 1 ? ` (×${formaterQuantite(o.quantiteBase)})` : ''}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-discret" onClick={props.onFiche}>
            Modifier la fiche
          </button>
        </div>
        {conversion && <span className="detail montant">⇄ {conversion}</span>}
        {a.suiviPeremption && (
          <div className="champ-avec-action">
            <label className="champ">
              N° de lot
              <input
                value={l.numeroLot}
                onKeyDown={bloquerEntree}
                onChange={(ev) => props.onModifier({ numeroLot: ev.target.value })}
              />
            </label>
            <label className="champ">
              Périme le
              <input
                type="date"
                min={props.aujourdhui}
                value={l.datePeremption}
                onChange={(ev) => props.onModifier({ datePeremption: ev.target.value })}
              />
            </label>
          </div>
        )}
        {e.alertes.map((t) => (
          <span key={t} className="pastille pastille-alerte">
            {t}
          </span>
        ))}
        {e.erreur && entame && <span className="detail">À compléter : {e.erreur}</span>}
      </td>
      <td className="nombre">
        <input
          className="nombre champ-quantite"
          inputMode="decimal"
          aria-label="Quantité reçue"
          value={l.quantite}
          onKeyDown={bloquerEntree}
          onChange={(ev) => props.onModifier({ quantite: ev.target.value })}
        />
      </td>
      <td className="nombre">
        <input
          className="nombre"
          inputMode="numeric"
          aria-label="Prix d’achat"
          value={l.prix}
          onKeyDown={bloquerEntree}
          onChange={(ev) => props.onModifier({ prix: ev.target.value })}
        />
      </td>
      <td className="nombre montant">{e.conversion ? formaterFCFA(e.conversion.total) : ''}</td>
      <td>
        <button type="button" className="btn btn-secondaire" onClick={props.onRetirer}>
          Retirer
        </button>
      </td>
    </tr>
  )
}
