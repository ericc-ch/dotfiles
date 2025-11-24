import type { ParentComponent } from "solid-js"
import { RouterProvider } from "./router"
import { ThemeProvider } from "./theme"

/**
 * Wraps all application providers
 * @param props - Component props with children
 */
export const Providers: ParentComponent = (props) => {
  return (
    <ThemeProvider>
      <RouterProvider initialRoute="home">{props.children}</RouterProvider>
    </ThemeProvider>
  )
}
