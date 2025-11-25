// https://github.com/sst/opentui/tree/main/packages/solid
// LMAO gotta make a PR for this
import solidPlugin from "../node_modules/@opentui/solid/scripts/solid-plugin"

import path from "node:path"
import fs from "node:fs/promises"

const rootDir = path.join(import.meta.dir, "..")
const distDir = path.join(rootDir, "./dist/")

const dashboardEntry = path.join(rootDir, "./src/main.tsx")
const dashboardOut = path.join(distDir, "./dashboard")

if (await fs.exists(distDir)) {
  fs.mkdir(distDir, { recursive: true })
}

await Bun.build({
  entrypoints: [dashboardEntry],
  plugins: [solidPlugin],
  compile: {
    autoloadBunfig: false,
    autoloadDotenv: false,
    outfile: dashboardOut,
  },
})
