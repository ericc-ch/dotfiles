import type { ParentComponent } from "solid-js"
import { RouterProvider } from "./router"

/**
 * Wraps all application providers
 * @param props - Component props with children
 */
export const Providers: ParentComponent = (props) => {
  return <RouterProvider initialRoute="home">{props.children}</RouterProvider>
}
