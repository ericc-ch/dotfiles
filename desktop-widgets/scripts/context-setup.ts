#!/usr/bin/env bun
import path from "node:path"
import fs from "node:fs"

const rootDir = path.join(import.meta.dir, "..")
const gitRoot = await Bun.$`git rev-parse --show-toplevel`
  .text()
  .then((s) => s.trim())

interface ContextRepo {
  name: string
  remote: string
  branch: string
}

const repos: ContextRepo[] = [
  {
    name: "effect",
    remote: "https://github.com/Effect-TS/effect.git",
    branch: "main",
  },
  {
    name: "effect-atom",
    remote: "https://github.com/tim-smart/effect-atom.git",
    branch: "main",
  },
]

for (const repo of repos) {
  const contextDir = path.join(rootDir, ".context", repo.name)
  const subtreePrefix = path.relative(gitRoot, contextDir)

  // Add remote if not already added
  const remoteCheck = await Bun.$`git remote get-url ${repo.name}`
    .quiet()
    .nothrow()

  if (remoteCheck.exitCode !== 0) {
    console.log(`Adding ${repo.name} remote...`)
    await Bun.$`git remote add ${repo.name} ${repo.remote}`
  } else {
    console.log(`${repo.name} remote already exists, skipping...`)
  }

  // Add subtree if directory doesn't exist (must run from git root)
  if (!fs.existsSync(contextDir)) {
    console.log(`Adding ${repo.name} subtree...`)
    await Bun.$`git subtree add --prefix=${subtreePrefix} --squash ${repo.name} ${repo.branch}`.cwd(
      gitRoot,
    )
  } else {
    console.log(
      `.context/${repo.name} already exists, use context-pull.ts to update`,
    )
  }
}

console.log("Done!")
