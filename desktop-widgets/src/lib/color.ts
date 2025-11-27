import { RGBA, type CliRenderer } from "@opentui/core"

/**
 * Default ANSI color values used as fallbacks
 */
export const DEFAULT_COLORS = {
  bg: "#000000",
  fg: "#ffffff",
  red: "#ff0000",
  brightRed: "#ff5555",
  green: "#00ff00",
  brightGreen: "#55ff55",
  yellow: "#ffff00",
  brightYellow: "#ffff55",
  blue: "#0000ff",
  brightBlue: "#5555ff",
  cyan: "#00ffff",
  brightCyan: "#55ffff",

  // Non-themed colors
  black: "#000000",
  white: "#ffffff",
} as const

/**
 * Terminal color palette data structure
 */
export interface TerminalPalette {
  /**
   * Default background color (hex format)
   */
  defaultBackground: string | null
  /**
   * Default foreground color (hex format)
   */
  defaultForeground: string | null
  /**
   * ANSI color palette (0-15)
   * Index mapping: 0=black, 1=red, 2=green, 3=yellow, 4=blue, 5=magenta, 6=cyan, 7=white
   * 8-15 are bright variants
   */
  palette: (string | null)[]
}

/**
 * Color shades for a semantic color (darker, normal, lighter)
 */
export interface ColorShades {
  darker: RGBA
  normal: RGBA
  lighter: RGBA
}

/**
 * Semantic color palette with named shades
 */
export interface ColorPalette {
  primary: ColorShades
  success: ColorShades
  error: ColorShades
  warning: ColorShades
  info: ColorShades
  bg: ColorShades
  fg: ColorShades
}

/**
 * Creates a default color palette with standard ANSI colors
 *
 * @returns ColorPalette with sensible default colors
 *
 * @example
 * ```typescript
 * const defaultTheme = createDefaultPalette()
 * ```
 */
export function createDefaultPalette(): ColorPalette {
  return {
    primary: createColorShades(DEFAULT_COLORS.cyan, DEFAULT_COLORS.brightCyan),
    success: createColorShades(
      DEFAULT_COLORS.green,
      DEFAULT_COLORS.brightGreen,
    ),
    error: createColorShades(DEFAULT_COLORS.red, DEFAULT_COLORS.brightRed),
    warning: createColorShades(
      DEFAULT_COLORS.yellow,
      DEFAULT_COLORS.brightYellow,
    ),
    info: createColorShades(DEFAULT_COLORS.blue, DEFAULT_COLORS.brightBlue),
    bg: {
      darker: darkenColor(RGBA.fromHex(DEFAULT_COLORS.bg), 0.2),
      normal: RGBA.fromHex(DEFAULT_COLORS.bg),
      lighter: lightenColor(RGBA.fromHex(DEFAULT_COLORS.bg), 0.1),
    },
    fg: {
      darker: darkenColor(RGBA.fromHex(DEFAULT_COLORS.fg), 0.2),
      normal: RGBA.fromHex(DEFAULT_COLORS.fg),
      lighter: lightenColor(RGBA.fromHex(DEFAULT_COLORS.fg), 0.1),
    },
  }
}

/**
 * Get the full terminal color palette
 *
 * @param renderer - The OpenTUI renderer instance
 * @returns Promise resolving to the terminal palette with background, foreground, and ANSI colors
 *
 * @example
 * ```typescript
 * const renderer = useRenderer()
 * const palette = await getTerminalPalette(renderer)
 * console.log(palette.defaultBackground) // "#1e1e1e"
 * console.log(palette.palette[1]) // "#ff0000" (red)
 * ```
 */
export async function getTerminalPalette(
  renderer: CliRenderer,
): Promise<TerminalPalette> {
  return await renderer.getPalette({ size: 16 })
}

/**
 * Darkens a color by moving RGB values toward black
 *
 * @param color - The RGBA color to darken
 * @param factor - Darkening factor (0.0-1.0, where 1.0 = fully black)
 * @returns Darkened RGBA color
 *
 * @example
 * ```typescript
 * const red = RGBA.fromInts(255, 0, 0, 255)
 * const darkRed = darkenColor(red, 0.3) // 30% darker
 * ```
 */
export function darkenColor(color: RGBA, factor: number): RGBA {
  const r = color.r * (1 - factor)
  const g = color.g * (1 - factor)
  const b = color.b * (1 - factor)
  return RGBA.fromValues(r, g, b, color.a)
}

/**
 * Lightens a color by moving RGB values toward white
 *
 * @param color - The RGBA color to lighten
 * @param factor - Lightening factor (0.0-1.0, where 1.0 = fully white)
 * @returns Lightened RGBA color
 *
 * @example
 * ```typescript
 * const red = RGBA.fromInts(255, 0, 0, 255)
 * const lightRed = lightenColor(red, 0.3) // 30% lighter
 * ```
 */
export function lightenColor(color: RGBA, factor: number): RGBA {
  const r = color.r + (1.0 - color.r) * factor
  const g = color.g + (1.0 - color.g) * factor
  const b = color.b + (1.0 - color.b) * factor
  return RGBA.fromValues(r, g, b, color.a)
}

/**
 * Creates color shades (darker, normal, lighter) from ANSI colors
 *
 * @param normalColor - The normal color (ANSI 0-7)
 * @param brightColor - The bright variant (ANSI 8-15), if available
 * @returns ColorShades object with darker, normal, and lighter variants
 *
 * @example
 * ```typescript
 * const redShades = createColorShades("#ff0000", "#ff5555")
 * ```
 */
export function createColorShades(
  normalColor: string,
  brightColor?: string | null,
): ColorShades {
  const normal = RGBA.fromHex(normalColor)
  const darker = darkenColor(normal, 0.3)
  const lighter =
    brightColor ? RGBA.fromHex(brightColor) : lightenColor(normal, 0.3)

  return { darker, normal, lighter }
}

/**
 * Creates a new RGBA color with a modified alpha value
 *
 * @param color - The RGBA color to modify
 * @param alpha - The new alpha value (0.0-1.0, where 0.0 = fully transparent, 1.0 = fully opaque)
 * @returns New RGBA color with the specified alpha value
 *
 * @example
 * ```typescript
 * const theme = useTheme()
 * const semitransparent = withAlpha(theme().fg.normal, 0.5) // 50% opacity
 * <box backgroundColor={semitransparent} />
 * ```
 */
export function withAlpha(color: RGBA, alpha: number): RGBA {
  return RGBA.fromValues(color.r, color.g, color.b, alpha)
}

/**
 * Creates a semantic color palette from terminal colors
 *
 * @param renderer - The OpenTUI renderer instance
 * @returns Promise resolving to a ColorPalette with semantic colors and shades
 *
 * @see {@link ColorPalette} for the structure of the returned palette
 *
 * @example
 * ```typescript
 * const renderer = useRenderer()
 * const palette = await createColorPalette(renderer)
 *
 * // Use semantic colors with named shades
 * <box backgroundColor={palette.success.normal}>Success!</box>
 * <text fg={palette.error.darker}>Dark error text</text>
 * <box border borderColor={palette.primary.lighter}>Light border</box>
 * ```
 */
export async function createColorPalette(
  renderer: CliRenderer,
): Promise<ColorPalette> {
  const terminal = await getTerminalPalette(renderer)

  // Fallback colors if terminal doesn't provide them
  const defaultBg = terminal.defaultBackground ?? DEFAULT_COLORS.bg
  const defaultFg = terminal.defaultForeground ?? DEFAULT_COLORS.fg

  // ANSI color mapping with fallbacks
  const ansiRed = terminal.palette[1] ?? DEFAULT_COLORS.red
  const ansiBrightRed = terminal.palette[9]

  const ansiGreen = terminal.palette[2] ?? DEFAULT_COLORS.green
  const ansiBrightGreen = terminal.palette[10]

  const ansiYellow = terminal.palette[3] ?? DEFAULT_COLORS.yellow
  const ansiBrightYellow = terminal.palette[11]

  const ansiBlue = terminal.palette[4] ?? DEFAULT_COLORS.blue
  const ansiBrightBlue = terminal.palette[12]

  const ansiCyan = terminal.palette[6] ?? DEFAULT_COLORS.cyan
  const ansiBrightCyan = terminal.palette[14]

  // Create bg/fg shades
  // For bg: darker = normal bg, normal = slightly lighter, lighter = more lighter
  // For fg: darker = slightly darker, normal = normal fg, lighter = slightly lighter
  const bgBase = RGBA.fromHex(defaultBg)
  const fgBase = RGBA.fromHex(defaultFg)

  return {
    primary: createColorShades(ansiCyan, ansiBrightCyan),
    success: createColorShades(ansiGreen, ansiBrightGreen),
    error: createColorShades(ansiRed, ansiBrightRed),
    warning: createColorShades(ansiYellow, ansiBrightYellow),
    info: createColorShades(ansiBlue, ansiBrightBlue),
    bg: {
      darker: darkenColor(bgBase, 0.2),
      normal: bgBase,
      lighter: lightenColor(bgBase, 0.1),
    },
    fg: {
      darker: darkenColor(fgBase, 0.2),
      normal: fgBase,
      lighter: lightenColor(fgBase, 0.1),
    },
  }
}
