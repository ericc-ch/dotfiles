import { useRenderer } from "@opentui/solid"
import {
  createContext,
  createResource,
  useContext,
  type ParentComponent,
} from "solid-js"
import {
  createColorPalette,
  createDefaultPalette,
  type ColorPalette,
} from "../lib/color"

/**
 * Theme context providing access to the color palette
 */
const ThemeContext = createContext<() => ColorPalette>()

/**
 * Hook to access the current theme palette
 *
 * @returns ColorPalette with semantic colors and shades
 *
 * @example
 * ```typescript
 * const theme = useTheme()
 * <box backgroundColor={theme.bg.normal} />
 * ```
 */
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }

  return context
}

/**
 * Provides theme context to the application
 */
export const ThemeProvider: ParentComponent = (props) => {
  const renderer = useRenderer()

  const [theme] = createResource(renderer, createColorPalette, {
    initialValue: createDefaultPalette(),
  })

  return (
    <ThemeContext.Provider value={theme}>
      {props.children}
    </ThemeContext.Provider>
  )
}
