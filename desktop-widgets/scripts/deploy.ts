#!/usr/bin/env bun
import path from "node:path"
import fs from "node:fs/promises"
import os from "node:os"

const rootDir = path.join(import.meta.dir, "..")
const distDir = path.join(rootDir, "dist")

// XDG-compliant: ~/.local/bin is the standard for user executables
const localBinDir =
  process.env.XDG_BIN_HOME ?? path.join(os.homedir(), ".local", "bin")

// Ensure bin directory exists
await fs.mkdir(localBinDir, { recursive: true })

// Binaries to deploy
const binaries = ["dashboard", "bar", "launcher"]

for (const binary of binaries) {
  const src = path.join(distDir, binary)
  const dest = path.join(localBinDir, binary)

  // Remove existing symlink/file if it exists
  try {
    await fs.unlink(dest)
  } catch {
    // Ignore if doesn't exist
  }

  // Create symlink
  await fs.symlink(src, dest)
  console.log(`Linked ${src} → ${dest}`)
}
