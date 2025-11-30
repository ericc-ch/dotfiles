import solidPlugin from "@opentui/solid/bun-plugin"

import path from "node:path"
import fs from "node:fs/promises"

const rootDir = path.join(import.meta.dir, "..")
const distDir = path.join(rootDir, "./dist/")

const entries = [
  { name: "dashboard", entry: "./src/dashboard.tsx" },
  { name: "bar", entry: "./src/bar.tsx" },
]

await fs.mkdir(distDir, { recursive: true })

for (const { name, entry } of entries) {
  await Bun.build({
    entrypoints: [path.join(rootDir, entry)],
    plugins: [solidPlugin],
    compile: {
      autoloadBunfig: false,
      autoloadDotenv: false,
      outfile: path.join(distDir, name),
    },
  })
  console.log(`Built ${name}`)
}
