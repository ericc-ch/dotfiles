#!/usr/bin/env bun
import path from "node:path"
import fs from "node:fs"

const rootDir = path.join(import.meta.dir, "..")
const gitRoot = await Bun.$`git rev-parse --show-toplevel`
  .text()
  .then((s) => s.trim())

interface ContextRepo {
  name: string
  branch: string
}

const repos: ContextRepo[] = [
  { name: "effect", branch: "main" },
  { name: "effect-atom", branch: "main" },
]

for (const repo of repos) {
  const contextDir = path.join(rootDir, ".context", repo.name)
  const subtreePrefix = path.relative(gitRoot, contextDir)

  // Check if remote exists
  const remoteCheck = await Bun.$`git remote get-url ${repo.name}`
    .quiet()
    .nothrow()

  if (remoteCheck.exitCode !== 0) {
    console.log(`${repo.name} remote not found, run context-setup.ts first`)
    continue
  }

  if (!fs.existsSync(contextDir)) {
    console.log(`.context/${repo.name} not found, run context-setup.ts first`)
    continue
  }

  console.log(`Pulling ${repo.name} subtree updates...`)
  await Bun.$`git subtree pull --prefix=${subtreePrefix} --squash ${repo.name} ${repo.branch}`.cwd(
    gitRoot,
  )
}

console.log("Done!")
