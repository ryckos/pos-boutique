/**
 * Aide contextuelle : le bouton « ? » d'une page ou d'une fenêtre ouvre la légende des icônes qu'on
 * y trouve, avec ce que fait chacune. ZONE PARTAGÉE (UI_UX § 4.2).
 *
 *   <AideIcones entrees={['exporter', 'modifier', ['ajouter', 'Ajouter un sous-rayon']]} />
 *
 * Une entrée est le nom d'une icône (son sens courant, ci-dessous) ou un couple [icône, texte] quand
 * la page lui donne un sens plus précis. La légende se ferme par le même bouton, par Échap ou par un
 * toucher à côté ; Échap ne ferme alors que la légende, pas la fenêtre qui la contient.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { BoutonIcone } from './BoutonIcone'
import { Icone, type NomIcone } from './Icone'

export type EntreeAide = NomIcone | readonly [NomIcone, string]

/** Sens courant de chaque icône d'action : le même partout dans l'application. */
const SENS: Partial<Record<NomIcone, string>> = {
  ajouter: 'Créer ou ajouter',
  modifier: 'Modifier',
  renommer: 'Renommer',
  desactiver: 'Désactiver, avec un motif : rien n’est effacé, l’historique reste',
  annuler: 'Annuler, avec un motif : l’opération reste visible et ne compte plus',
  supprimer: 'Retirer une ligne pas encore enregistrée',
  historique: 'Voir l’historique',
  retirer: 'Retirer',
  promotion: 'Mettre en promotion',
  remise: 'Faire une remise',
  ouvrir: 'Ouvrir',
  afficher: 'Voir le détail',
  payer: 'Payer',
  achats: 'Voir les achats et les prix d’achat',
  dettes: 'Voir les dettes, les règlements et les avoirs',
  facture: 'Faire une facture',
  importer: 'Importer depuis Excel',
  exporter: 'Exporter vers Excel ce que l’écran affiche, filtres compris',
  imprimer: 'Imprimer',
  rechercher: 'Rechercher',
  valider: 'Valider ou confirmer',
  fermer: 'Refuser',
  envoyer: 'Marquer comme envoyée',
  copier: 'Copier le texte',
  cloturer: 'Clôturer',
  cle: 'Réinitialiser le code',
  utilisateur: 'Changer le rôle',
  sauvegarder: 'Sauvegarder maintenant',
  restaurer: 'Restaurer ou refaire',
  dossier: 'Choisir un fichier ou un dossier',
  livrer: 'Livrer une commande attendue',
  generer: 'Générer un code-barres interne',
  inventaires: 'Compter',
  categories: 'Gérer les catégories',
  avertissement: 'Partir des produits en alerte',
  tiroir: 'Ouvrir le tiroir-caisse',
  suivant: 'Afficher la suite'
}

/** Actions sensibles : en rouge dans la légende, comme sur leurs boutons. */
const SENSIBLES: ReadonlySet<NomIcone> = new Set(['desactiver', 'annuler', 'supprimer', 'retirer'])

/** Texte d'une entrée : le sens donné par la page, sinon le sens courant de l'icône. */
export function texteAide(entree: EntreeAide): string {
  return typeof entree === 'string' ? (SENS[entree] ?? entree) : entree[1]
}

export function AideIcones(props: {
  entrees: EntreeAide[]
  /** Le tableau est paginé : on explique aussi les flèches sous le tableau. */
  pagination?: boolean
}): React.JSX.Element {
  const [ouverte, setOuverte] = useState(false)
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ouverte) return
    const dehors = (e: PointerEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOuverte(false)
    }
    // Phase de capture : Échap ferme la légende avant d'atteindre la fenêtre qui la contient.
    const echap = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOuverte(false)
    }
    document.addEventListener('pointerdown', dehors)
    window.addEventListener('keydown', echap, true)
    return () => {
      document.removeEventListener('pointerdown', dehors)
      window.removeEventListener('keydown', echap, true)
    }
  }, [ouverte])

  return (
    <div className="aide" ref={ref}>
      <BoutonIcone
        icone="aide"
        libelle={ouverte ? 'Masquer l’aide' : 'Aide : que veulent dire les icônes ?'}
        className={ouverte ? 'actif' : undefined}
        aria-expanded={ouverte}
        aria-controls={id}
        onClick={() => setOuverte((o) => !o)}
      />
      {ouverte && (
        <section id={id} className="aide-legende" aria-label="Légende des icônes">
          <h2>Que veulent dire les icônes ?</h2>
          <ul>
            {props.entrees.map((e) => {
              const nom = typeof e === 'string' ? e : e[0]
              return (
                <li key={`${nom}-${texteAide(e)}`}>
                  <span className={SENSIBLES.has(nom) ? 'aide-icone aide-icone-sensible' : 'aide-icone'}>
                    <Icone nom={nom} />
                  </span>
                  {texteAide(e)}
                </li>
              )
            })}
            {props.pagination && (
              <li>
                <span className="aide-icone">
                  <Icone nom="suivant" />
                </span>
                Sous le tableau : changer de page (première, précédente, suivante, dernière)
              </li>
            )}
          </ul>
          <p className="aide-note">
            Survolez une icône, ou gardez le doigt appuyé dessus, pour lire ce qu’elle fait.
          </p>
        </section>
      )}
    </div>
  )
}
