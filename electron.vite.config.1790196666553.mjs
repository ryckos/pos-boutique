// electron.vite.config.ts
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
var __electron_vite_injected_dirname = "E:\\SOWADAN_SEDZRO\\Dev\\pos-boutique";
var alias = {
  "@shared": resolve(__electron_vite_injected_dirname, "src/shared"),
  "@renderer": resolve(__electron_vite_injected_dirname, "src/renderer/src")
};
var electron_vite_config_default = defineConfig({
  main: { plugins: [externalizeDepsPlugin()], resolve: { alias } },
  preload: { plugins: [externalizeDepsPlugin()], resolve: { alias } },
  renderer: {
    resolve: { alias },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__electron_vite_injected_dirname, "src/renderer/index.html"),
          client: resolve(__electron_vite_injected_dirname, "src/renderer/client.html")
        }
      }
    }
  }
});
export {
  electron_vite_config_default as default
};
