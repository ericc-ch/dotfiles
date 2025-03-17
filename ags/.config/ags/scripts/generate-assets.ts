#!/usr/bin/env -S deno run --allow-read --allow-write

import * as path from "jsr:@std/path";

const dirname = import.meta.dirname;

if (!dirname) throw new Error("Failed to get directory name");

const assetsDir = path.join(dirname, "../assets");
const outputDir = path.join(dirname, "../styles");
const outputFile = path.join(outputDir, "assets.scss");

async function getAllFiles(dir: string): Promise<Array<string>> {
  const files: Array<string> = [];

  for await (const entry of Deno.readDir(dir)) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory) {
      files.push(...(await getAllFiles(entryPath)));
    } else {
      files.push(entryPath);
    }
  }

  return files;
}

function createScssVariableName(filePath: string): string {
  const relativePath = path.relative(assetsDir, filePath);

  return (
    "$" + relativePath.replaceAll("/", "-").replaceAll(".", "-").toLowerCase()
  );
}

async function generateAssetsScss() {
  try {
    console.log(`Scanning assets directory: ${assetsDir}`);

    // Ensure assets directory exists
    try {
      await Deno.stat(assetsDir);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        console.error(`Assets directory not found: ${assetsDir}`);
        return;
      }
      throw error;
    }

    // Get all files
    const files = await getAllFiles(assetsDir);

    // Generate SCSS content
    let scssContent =
      "// Auto-generated assets paths - DO NOT EDIT\n// Generated at: " +
      new Date().toISOString() +
      "\n\n";

    for (const file of files) {
      const variableName = createScssVariableName(file);
      scssContent += `${variableName}: "file://${file}";\n`;
    }

    // Write the file
    await Deno.writeTextFile(outputFile, scssContent);

    console.log(
      `Generated SCSS file with ${files.length} asset paths: ${outputFile}`
    );
  } catch (error) {
    console.error("Error generating assets.scss:", error);
  }
}

// Execute the main function
generateAssetsScss();
