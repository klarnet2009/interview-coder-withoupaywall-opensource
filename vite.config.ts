// vite.config.ts
import { defineConfig } from "vite"
import electron from "vite-plugin-electron"
import react from "@vitejs/plugin-react"
import path from "path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const packageJson = require("./package.json") as { dependencies?: Record<string, string> }
const externalDeps = Object.keys(packageJson.dependencies || {})

const rendererManualChunks = (id: string): string | undefined => {
  if (!id.includes("node_modules")) {
    return undefined
  }
  if (
    id.includes("react-syntax-highlighter") ||
    id.includes("react-code-blocks") ||
    id.includes("highlight.js") ||
    id.includes("refractor")
  ) {
    return "code-highlighting"
  }
  if (id.includes("@radix-ui")) {
    return "radix-ui"
  }
  if (id.includes("@tanstack/react-query")) {
    return "react-query"
  }
  if (id.includes("react-i18next") || id.includes("i18next")) {
    return "i18n"
  }
  if (id.includes("react-dom") || id.includes("react")) {
    return "react-core"
  }
  return "vendor"
}

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // main.ts
        entry: "electron/main.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            sourcemap: true,
            minify: false,
            rollupOptions: {
              external: [
                "electron",
                "bufferutil",
                "utf-8-validate",
                ...externalDeps
              ]
            }
          }
        }
      },
      {
        // preload.ts
        entry: "electron/preload.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            sourcemap: true,
            rollupOptions: {
              external: ["electron"]
            }
          }
        }
      }
    ])
  ],
  base: process.env.NODE_ENV === "production" ? "./" : "/",
  server: {
    port: 54321,
    strictPort: true,
    watch: {
      usePolling: true
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    // Disable modulePreload — Electron loads from file:// where crossorigin fails
    modulePreload: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
})
