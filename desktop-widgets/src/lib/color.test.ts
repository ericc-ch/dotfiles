import { RGBA } from "@opentui/core"
import { describe, expect, test } from "bun:test"
import {
  createColorPalette,
  createColorShades,
  darkenColor,
  lightenColor,
  withAlpha,
} from "./color"

describe("withAlpha", () => {
  test("modifies alpha to 0.5", () => {
    const color = RGBA.fromInts(255, 128, 64, 255)
    const result = withAlpha(color, 0.5)

    expect(result.r).toBeCloseTo(1.0, 5)
    expect(result.g).toBeCloseTo(0.5, 2)
    expect(result.b).toBeCloseTo(0.25, 2)
    expect(result.a).toBe(0.5)
  })

  test("sets alpha to full opacity (1.0)", () => {
    const color = RGBA.fromInts(100, 150, 200, 128)
    const result = withAlpha(color, 1.0)

    expect(result.a).toBe(1.0)
    expect(result.r).toBeCloseTo(color.r, 5)
    expect(result.g).toBeCloseTo(color.g, 5)
    expect(result.b).toBeCloseTo(color.b, 5)
  })

  test("sets alpha to full transparency (0.0)", () => {
    const color = RGBA.fromInts(255, 255, 255, 255)
    const result = withAlpha(color, 0.0)

    expect(result.a).toBe(0.0)
    expect(result.r).toBe(1.0)
    expect(result.g).toBe(1.0)
    expect(result.b).toBe(1.0)
  })

  test("preserves RGB values", () => {
    const color = RGBA.fromInts(123, 45, 67, 200)
    const result = withAlpha(color, 0.75)

    expect(result.r).toBeCloseTo(color.r, 5)
    expect(result.g).toBeCloseTo(color.g, 5)
    expect(result.b).toBeCloseTo(color.b, 5)
  })

  test("does not modify original color", () => {
    const color = RGBA.fromInts(255, 128, 64, 255)
    const originalAlpha = color.a

    withAlpha(color, 0.3)

    expect(color.a).toBe(originalAlpha)
  })

  test("works with various alpha values", () => {
    const color = RGBA.fromInts(200, 100, 50, 255)

    const quarter = withAlpha(color, 0.25)
    expect(quarter.a).toBe(0.25)

    const threeQuarters = withAlpha(color, 0.75)
    expect(threeQuarters.a).toBe(0.75)

    const tenth = withAlpha(color, 0.1)
    expect(tenth.a).toBeCloseTo(0.1, 5)
  })
})

describe("darkenColor", () => {
  test("darkens red color by 30%", () => {
    const red = RGBA.fromInts(255, 0, 0, 255)
    const darkRed = darkenColor(red, 0.3)

    expect(darkRed.r).toBeCloseTo(0.7, 2) // 1.0 * 0.7
    expect(darkRed.g).toBe(0)
    expect(darkRed.b).toBe(0)
    expect(darkRed.a).toBe(1.0)
  })

  test("darkens white color by 50%", () => {
    const white = RGBA.fromInts(255, 255, 255, 255)
    const gray = darkenColor(white, 0.5)

    expect(gray.r).toBeCloseTo(0.5, 2) // 1.0 * 0.5
    expect(gray.g).toBeCloseTo(0.5, 2)
    expect(gray.b).toBeCloseTo(0.5, 2)
    expect(gray.a).toBe(1.0)
  })

  test("preserves alpha channel", () => {
    const semiTransparent = RGBA.fromInts(100, 150, 200, 128)
    const darkened = darkenColor(semiTransparent, 0.2)

    expect(darkened.a).toBeCloseTo(0.5, 1) // 128/255 ≈ 0.5
  })

  test("handles factor of 0 (no change)", () => {
    const color = RGBA.fromInts(100, 150, 200, 255)
    const result = darkenColor(color, 0)

    expect(result.r).toBeCloseTo(color.r, 5)
    expect(result.g).toBeCloseTo(color.g, 5)
    expect(result.b).toBeCloseTo(color.b, 5)
  })

  test("handles factor of 1 (fully black)", () => {
    const color = RGBA.fromInts(100, 150, 200, 255)
    const black = darkenColor(color, 1)

    expect(black.r).toBe(0)
    expect(black.g).toBe(0)
    expect(black.b).toBe(0)
  })
})

describe("lightenColor", () => {
  test("lightens red color by 30%", () => {
    const red = RGBA.fromInts(255, 0, 0, 255)
    const lightRed = lightenColor(red, 0.3)

    expect(lightRed.r).toBe(1.0) // Already at max
    expect(lightRed.g).toBeCloseTo(0.3, 2) // 0 + (1.0 - 0) * 0.3
    expect(lightRed.b).toBeCloseTo(0.3, 2)
    expect(lightRed.a).toBe(1.0)
  })

  test("lightens black color by 50%", () => {
    const black = RGBA.fromInts(0, 0, 0, 255)
    const gray = lightenColor(black, 0.5)

    expect(gray.r).toBeCloseTo(0.5, 2) // 0 + 1.0 * 0.5
    expect(gray.g).toBeCloseTo(0.5, 2)
    expect(gray.b).toBeCloseTo(0.5, 2)
    expect(gray.a).toBe(1.0)
  })

  test("preserves alpha channel", () => {
    const semiTransparent = RGBA.fromInts(100, 150, 200, 128)
    const lightened = lightenColor(semiTransparent, 0.2)

    expect(lightened.a).toBeCloseTo(0.5, 1) // 128/255 ≈ 0.5
  })

  test("handles factor of 0 (no change)", () => {
    const color = RGBA.fromInts(100, 150, 200, 255)
    const result = lightenColor(color, 0)

    expect(result.r).toBeCloseTo(color.r, 5)
    expect(result.g).toBeCloseTo(color.g, 5)
    expect(result.b).toBeCloseTo(color.b, 5)
  })

  test("handles factor of 1 (fully white)", () => {
    const color = RGBA.fromInts(100, 150, 200, 255)
    const white = lightenColor(color, 1)

    expect(white.r).toBe(1.0)
    expect(white.g).toBe(1.0)
    expect(white.b).toBe(1.0)
  })
})

describe("createColorShades", () => {
  test("creates shades with bright color provided", () => {
    const shades = createColorShades("#ff0000", "#ff5555")

    // Normal should be the normal color
    expect(shades.normal.r).toBe(1.0)
    expect(shades.normal.g).toBe(0)
    expect(shades.normal.b).toBe(0)

    // Lighter should be the bright color
    expect(shades.lighter.r).toBe(1.0)
    expect(shades.lighter.g).toBeCloseTo(0.33, 1) // 85/255 ≈ 0.33
    expect(shades.lighter.b).toBeCloseTo(0.33, 1)

    // Darker should be darkened normal
    expect(shades.darker.r).toBeCloseTo(0.7, 2) // 1.0 * 0.7
    expect(shades.darker.g).toBe(0)
    expect(shades.darker.b).toBe(0)
  })

  test("creates shades without bright color (fallback)", () => {
    const shades = createColorShades("#0000ff", null)

    // Normal should be the normal color
    expect(shades.normal.r).toBe(0)
    expect(shades.normal.g).toBe(0)
    expect(shades.normal.b).toBe(1.0)

    // Lighter should be computed from normal
    expect(shades.lighter.r).toBeGreaterThan(0)
    expect(shades.lighter.g).toBeGreaterThan(0)
    expect(shades.lighter.b).toBe(1.0)

    // Darker should be darkened normal
    expect(shades.darker.r).toBe(0)
    expect(shades.darker.g).toBe(0)
    expect(shades.darker.b).toBeCloseTo(0.7, 2) // 1.0 * 0.7
  })

  test("creates shades without bright color (undefined)", () => {
    const shades = createColorShades("#00ff00")

    expect(shades.normal.g).toBe(1.0)
    expect(shades.lighter.g).toBe(1.0)
    expect(shades.darker.g).toBeCloseTo(0.7, 2)
  })
})

describe("createColorPalette", () => {
  test("creates palette from full terminal colors", async () => {
    // Mock renderer with full ANSI palette
    const mockRenderer = {
      getPalette: async () => ({
        defaultBackground: "#1e1e1e",
        defaultForeground: "#d4d4d4",
        palette: [
          "#000000", // 0: black
          "#ff0000", // 1: red
          "#00ff00", // 2: green
          "#ffff00", // 3: yellow
          "#0000ff", // 4: blue
          "#ff00ff", // 5: magenta
          "#00ffff", // 6: cyan
          "#ffffff", // 7: white
          "#808080", // 8: bright black
          "#ff5555", // 9: bright red
          "#55ff55", // 10: bright green
          "#ffff55", // 11: bright yellow
          "#5555ff", // 12: bright blue
          "#ff55ff", // 13: bright magenta
          "#55ffff", // 14: bright cyan
          "#ffffff", // 15: bright white
        ],
      }),
    }

    const palette = await createColorPalette(mockRenderer as any)

    // Check background and foreground
    expect(palette.bg.normal.r).toBeCloseTo(0.12, 1) // Base bg
    expect(palette.bg.darker.r).toBeLessThan(palette.bg.normal.r) // Darker
    expect(palette.bg.lighter.r).toBeGreaterThan(palette.bg.normal.r) // Lighter

    expect(palette.fg.normal.r).toBeCloseTo(0.83, 1) // Base fg
    expect(palette.fg.darker.r).toBeLessThan(palette.fg.normal.r) // Darker
    expect(palette.fg.lighter.r).toBeGreaterThan(palette.fg.normal.r) // Lighter

    // Check primary (cyan)
    expect(palette.primary.normal.b).toBe(1.0)
    expect(palette.primary.lighter.b).toBe(1.0)

    // Check success (green)
    expect(palette.success.normal.g).toBe(1.0)
    expect(palette.success.lighter.g).toBe(1.0)

    // Check error (red)
    expect(palette.error.normal.r).toBe(1.0)
    expect(palette.error.lighter.r).toBe(1.0)

    // Check warning (yellow)
    expect(palette.warning.normal.r).toBe(1.0)
    expect(palette.warning.normal.g).toBe(1.0)

    // Check info (blue)
    expect(palette.info.normal.b).toBe(1.0)
    expect(palette.info.lighter.b).toBe(1.0)
  })

  test("creates palette with missing bright colors (fallback)", async () => {
    // Mock renderer with only basic ANSI colors
    const mockRenderer = {
      getPalette: async () => ({
        defaultBackground: "#000000",
        defaultForeground: "#ffffff",
        palette: [
          "#000000", // 0: black
          "#ff0000", // 1: red
          "#00ff00", // 2: green
          "#ffff00", // 3: yellow
          "#0000ff", // 4: blue
          "#ff00ff", // 5: magenta
          "#00ffff", // 6: cyan
          "#ffffff", // 7: white
          null, // 8-15: missing bright variants
          null,
          null,
          null,
          null,
          null,
          null,
          null,
        ],
      }),
    }

    const palette = await createColorPalette(mockRenderer as any)

    // Should still work with computed lighter colors
    expect(palette.primary.normal).toBeDefined()
    expect(palette.primary.lighter).toBeDefined()
    expect(palette.primary.darker).toBeDefined()

    expect(palette.success.normal.g).toBe(1.0)
    expect(palette.error.normal.r).toBe(1.0)
  })

  test("creates palette with null background/foreground (fallback)", async () => {
    const mockRenderer = {
      getPalette: async () => ({
        defaultBackground: null,
        defaultForeground: null,
        palette: Array(16).fill(null),
      }),
    }

    const palette = await createColorPalette(mockRenderer as any)

    // Should use fallback colors - black bg
    expect(palette.bg.darker.r).toBe(0)
    expect(palette.bg.darker.g).toBe(0)
    expect(palette.bg.darker.b).toBe(0)

    // bg.normal should be base (black)
    expect(palette.bg.normal.r).toBe(0)

    // Should use fallback colors - white fg
    expect(palette.fg.normal.r).toBe(1.0)
    expect(palette.fg.normal.g).toBe(1.0)
    expect(palette.fg.normal.b).toBe(1.0)

    // fg.darker should be darker than normal
    expect(palette.fg.darker.r).toBeLessThan(palette.fg.normal.r)
  })

  test("bg/fg shades are properly generated", async () => {
    const mockRenderer = {
      getPalette: async () => ({
        defaultBackground: "#1e1e1e",
        defaultForeground: "#d4d4d4",
        palette: Array(16).fill("#000000"),
      }),
    }

    const palette = await createColorPalette(mockRenderer as any)

    // Background shades: darker < normal (base) < lighter
    expect(palette.bg.darker).toBeDefined()
    expect(palette.bg.normal).toBeDefined()
    expect(palette.bg.lighter).toBeDefined()

    expect(palette.bg.normal.r).toBeGreaterThan(palette.bg.darker.r)
    expect(palette.bg.lighter.r).toBeGreaterThan(palette.bg.normal.r)

    // Foreground shades: darker < normal (base) < lighter
    expect(palette.fg.darker).toBeDefined()
    expect(palette.fg.normal).toBeDefined()
    expect(palette.fg.lighter).toBeDefined()

    expect(palette.fg.darker.r).toBeLessThan(palette.fg.normal.r)
    expect(palette.fg.lighter.r).toBeGreaterThan(palette.fg.normal.r)
  })
})
