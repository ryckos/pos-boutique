/**
 * Icônes de l'application. ZONE PARTAGÉE.
 *
 * Dessinées ici en SVG (trait de 2 px, grille de 24) plutôt que tirées d'une bibliothèque : aucune
 * dépendance, rien à télécharger, et un style uniforme. La couleur suit le texte (`currentColor`).
 * Une icône est toujours décorative (`aria-hidden`) : le nom de l'action est porté par le bouton
 * (texte visible ou `aria-label` de `BoutonIcone`).
 */

const TRACES = {
  // ─── Actions ───
  ajouter: <path d="M12 5v14M5 12h14" />,
  modifier: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  renommer: (
    <>
      <path d="M3 6h10M8 6v13" />
      <path d="M14 20h3l4-4-3-3-4 4v3z" />
    </>
  ),
  desactiver: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </>
  ),
  annuler: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
    </>
  ),
  supprimer: (
    <>
      <path d="M4 7h16M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13M10 11v6M14 11v6" />
    </>
  ),
  historique: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 3" />
    </>
  ),
  retirer: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" />
    </>
  ),
  promotion: (
    <>
      <path d="M3 12V4h8l10 10-8 8L3 12z" />
      <circle cx="7.5" cy="8" r="1.5" />
    </>
  ),
  remise: (
    <>
      <path d="M19 5L5 19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </>
  ),
  ouvrir: (
    <>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 14v6H4V6h6" />
    </>
  ),
  afficher: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  payer: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
  achats: (
    <>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M2 3h3l2.5 12h11.5l2-8H6.2" />
    </>
  ),
  dettes: (
    <>
      <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </>
  ),
  facture: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
      <path d="M14 2v6h6M8 13h8M8 17h8" />
    </>
  ),
  importer: <path d="M12 15V3M7 8l5-5 5 5M4 15v5h16v-5" />,
  exporter: <path d="M12 3v12M7 10l5 5 5-5M4 15v5h16v-5" />,
  imprimer: (
    <>
      <path d="M6 9V3h12v6M6 18H4v-7h16v7h-2" />
      <path d="M6 14h12v7H6z" />
    </>
  ),
  rechercher: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </>
  ),
  fermer: <path d="M6 6l12 12M18 6L6 18" />,
  valider: <path d="M5 12l5 5 9-10" />,
  envoyer: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />,
  copier: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </>
  ),
  cloturer: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  cle: (
    <>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M10.7 12.3L20 3M16 7l3 3M18.5 4.5l2 2" />
    </>
  ),
  sauvegarder: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </>
  ),
  restaurer: (
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </>
  ),
  dossier: <path d="M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" />,
  livrer: (
    <>
      <path d="M2 6h12v10H2zM14 10h4l3 3v3h-7" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  generer: <path d="M3 5v14M6 5v14M10 5v14M12 5v14M16 5v14M18 5v14M21 5v14" />,
  attente: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 9v6M14 9v6" />
    </>
  ),
  tiroir: (
    <>
      <rect x="2" y="12" width="20" height="9" rx="1" />
      <path d="M5 12V8h14v4M9 16.5h6" />
    </>
  ),
  ecran: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
  utilisateur: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </>
  ),
  conditionnement: (
    <>
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8M12 13v8" />
    </>
  ),
  aide: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4M12 17.5v.01" />
    </>
  ),
  avertissement: (
    <>
      <path d="M12 3l10 18H2L12 3z" />
      <path d="M12 10v5M12 18v.01" />
    </>
  ),

  // ─── Menu ───
  caisse: (
    <>
      <rect x="3" y="10" width="18" height="11" rx="1.5" />
      <path d="M7 10V4h10v6M7 14h2M11 14h2M15 14h2M7 17.5h10" />
    </>
  ),
  produits: (
    <>
      <path d="M3 12V4h8l10 10-8 8L3 12z" />
      <circle cx="7.5" cy="8" r="1.5" />
    </>
  ),
  categories: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  stock: <path d="M12 2l10 5-10 5L2 7l10-5zM2 12l10 5 10-5M2 17l10 5 10-5" />,
  peremptions: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4M12 13v3M12 18.5v.01" />
    </>
  ),
  sorties: (
    <>
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
      <path d="M8 12h8" />
    </>
  ),
  inventaires: (
    <>
      <rect x="5" y="4" width="14" height="18" rx="2" />
      <path d="M9 2h6v4H9zM9 13l2 2 4-4" />
    </>
  ),
  commandes: (
    <>
      <rect x="5" y="4" width="14" height="18" rx="2" />
      <path d="M9 2h6v4H9zM9 11h6M9 15h6" />
    </>
  ),
  fournisseurs: <path d="M3 21h18M5 21V9l5 3V9l5 3V4h4v17" />,
  depenses: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 10h18M15 15h3" />
    </>
  ),
  rapports: <path d="M3 21h18M6 17v-6M11 17V5M16 17v-9M21 17v-3" />,
  comptes: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21c0-4 3-6 7-6s7 2 7 6M16 4a4 4 0 0 1 0 8M19 15c2 .6 3 2.5 3 6" />
    </>
  ),
  journal: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  parametres: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
  materiel: (
    <>
      <path d="M6 9V3h12v6M6 18H4v-7h16v7h-2" />
      <path d="M6 14h12v7H6z" />
    </>
  ),
  deconnexion: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </>
  ),
  boutique: (
    <>
      <path d="M3 9l1.5-5h15L21 9" />
      <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 12v9h14v-9M10 21v-5h4v5" />
    </>
  ),

  // ─── Pagination ───
  precedent: <path d="M15 18l-6-6 6-6" />,
  suivant: <path d="M9 18l6-6-6-6" />,
  premier: <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />,
  dernier: <path d="M13 17l5-5-5-5M6 17l5-5-5-5" />
} as const

export type NomIcone = keyof typeof TRACES

export function Icone(props: { nom: NomIcone; taille?: number }): React.JSX.Element {
  const taille = props.taille ?? 20
  return (
    <svg
      className="icone"
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TRACES[props.nom]}
    </svg>
  )
}
