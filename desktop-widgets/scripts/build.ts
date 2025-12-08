#!/usr/bin/env bun

import solidPlugin from "@opentui/solid/bun-plugin"

import path from "node:path"
import fs from "node:fs/promises"

const rootDir = path.join(import.meta.dir, "..")
const distDir = path.join(rootDir, "./dist/")

const entries = [
  { name: "dashboard", entry: "./src/dashboard.tsx" },
  { name: "bar", entry: "./src/bar.tsx" },
  { name: "launcher", entry: "./src/launcher.tsx" },
]

await fs.mkdir(distDir, { recursive: true })

await Promise.all(
  entries.map(async ({ name, entry }) => {
    await Bun.build({
      entrypoints: [path.join(rootDir, entry)],
      plugins: [solidPlugin],
      minify: true,
      compile: {
        autoloadBunfig: false,
        autoloadDotenv: false,
        outfile: path.join(distDir, name),
      },
    })
    console.log(`Built ${name}`)
  }),
)
