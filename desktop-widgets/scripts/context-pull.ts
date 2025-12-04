#!/usr/bin/env bun
import path from "node:path"

const rootDir = path.join(import.meta.dir, "..")
const gitRoot = await Bun.$`git rev-parse --show-toplevel`
  .text()
  .then((s) => s.trim())
const contextDir = path.join(rootDir, ".context/effect")

// Subtree prefix is relative to git root
const subtreePrefix = path.relative(gitRoot, contextDir)

// Check if effect remote exists
const remoteCheck = await Bun.$`git remote get-url effect`.quiet().nothrow()

if (remoteCheck.exitCode !== 0) {
  console.log("effect remote not found, run context-setup.ts first")
  process.exit(1)
}

// Must run from git root
console.log("Pulling effect subtree updates...")
await Bun.$`git subtree pull --prefix=${subtreePrefix} --squash effect main`.cwd(
  gitRoot,
)

console.log("Done!")
