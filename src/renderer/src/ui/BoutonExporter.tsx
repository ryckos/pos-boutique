/**
 * Bouton « Exporter vers Excel » (B15). ZONE PARTAGÉE — à placer dans l'en-tête d'une page.
 * `demande` construit l'export au moment du clic, à partir de ce que l'écran affiche ; elle peut lire
 * d'autres pages au besoin (journal). Le message de succès ou d'erreur s'affiche à côté du bouton.
 */
import { useState } from 'react'
import type { DemandeExport } from '@shared/ipc/exports'
import { MESSAGE_EXPORT, exporterExcel } from '@renderer/lib/exportExcel'

interface Proprietes {
  demande: () => DemandeExport | Promise<DemandeExport>
  /** Grisé tant que la liste n'est pas chargée. */
  desactive?: boolean
}

export function BoutonExporter({ demande, desactive }: Proprietes): React.JSX.Element {
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)

  const exporter = async (): Promise<void> => {
    setEnCours(true)
    setMessage(null)
    try {
      if (await exporterExcel(await demande())) setMessage({ ok: true, texte: MESSAGE_EXPORT })
    } catch (e) {
      setMessage({ ok: false, texte: (e as Error).message })
    } finally {
      setEnCours(false)
    }
  }

  return (
    <>
      {message && (
        <span className={message.ok ? 'succes' : 'alerte'} role={message.ok ? 'status' : 'alert'}>
          {message.texte}
        </span>
      )}
      <button
        type="button"
        className="btn btn-secondaire"
        disabled={desactive || enCours}
        onClick={() => void exporter()}
      >
        {enCours ? 'Export en cours…' : 'Exporter vers Excel'}
      </button>
    </>
  )
}
