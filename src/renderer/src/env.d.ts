/// <reference types="vite/client" />
import type { ApiPreload } from '../../preload/index'

declare global {
  interface Window {
    pos: ApiPreload
  }
}

export {}
