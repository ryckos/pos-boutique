/** Hachage des codes PIN (scrypt + sel aléatoire). Jamais de PIN en clair. ZONE PARTAGÉE. */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

export function hacherPin(pin: string): string {
  const sel = randomBytes(16).toString('hex')
  const hash = scryptSync(pin, sel, 32).toString('hex')
  return `${sel}:${hash}`
}

export function verifierPin(pin: string, stocke: string): boolean {
  const [sel, hash] = stocke.split(':')
  if (!sel || !hash) return false
  const attendu = Buffer.from(hash, 'hex')
  const calcule = scryptSync(pin, sel, attendu.length)
  return timingSafeEqual(attendu, calcule)
}
