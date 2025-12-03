#!/usr/bin/env bun
import path from "node:path"
import fs from "node:fs"

const rootDir = path.join(import.meta.dir, "..")
const gitRoot = await Bun.$`git rev-parse --show-toplevel`.text().then(s => s.trim())
const contextDir = path.join(rootDir, ".context/effect")

// Subtree prefix is relative to git root
const subtreePrefix = path.relative(gitRoot, contextDir)

// Add effect remote if not already added
const remoteCheck = await Bun.$`git remote get-url effect`.quiet().nothrow()

if (remoteCheck.exitCode !== 0) {
  console.log("Adding effect remote...")
  await Bun.$`git remote add effect https://github.com/Effect-TS/effect.git`
} else {
  console.log("effect remote already exists, skipping...")
}

// Add subtree if directory doesn't exist (must run from git root)
if (!fs.existsSync(contextDir)) {
  console.log("Adding effect subtree...")
  await Bun.$`git subtree add --prefix=${subtreePrefix} --squash effect main`.cwd(gitRoot)
} else {
  console.log(".context/effect already exists, use context-pull.ts to update")
}

console.log("Done!")
