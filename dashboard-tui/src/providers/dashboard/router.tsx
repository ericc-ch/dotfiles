import type { ParentComponent } from "solid-js"
import { createContext, createSignal, useContext } from "solid-js"

export type Route = "home" | "audio" | "settings"

interface RouterContextValue {
  currentRoute: () => Route
  setRoute: (route: Route) => void
}

const RouterContext = createContext<RouterContextValue>()

export const RouterProvider: ParentComponent<{
  initialRoute?: Route
}> = (props) => {
  const [currentRoute, setRoute] = createSignal<Route>(
    props.initialRoute ?? "home",
  )

  return (
    <RouterContext.Provider value={{ currentRoute, setRoute }}>
      {props.children}
    </RouterContext.Provider>
  )
}

/**
 * Hook to access router context
 * @returns Router context value with currentRoute and setRoute
 * @throws Error if used outside RouterProvider
 */
export const useRouter = (): RouterContextValue => {
  const context = useContext(RouterContext)
  if (!context) {
    throw new Error("useRouter must be used within a RouterProvider")
  }
  return context
}
