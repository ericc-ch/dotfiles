import { useKeyboard, useRenderer } from "@opentui/solid"
import { createResource, createSignal } from "solid-js"
import { AppLauncher } from "./components/app-launcher"
import { Clock } from "./components/clock"
import { getDefaultSink, listSinks } from "./lib/audio"
import { useTheme } from "./providers/theme"

export const App = () => {
  const [hoveredDevice, setHoveredDevice] = createSignal(0)

  const [defaultSink, { refetch: refetchDefaultSink }] = createResource(() =>
    getDefaultSink(),
  )
  const [sinks, { refetch: refetchSinks }] = createResource(() => listSinks())

  const renderer = useRenderer()

  useKeyboard((event) => {
    if (event.name === "f12") {
      renderer.console.toggle()
    }
  })

  const theme = useTheme()

  return (
    <box alignItems="center" justifyContent="center" flexGrow={1}>
      <Clock />

      <AppLauncher />
    </box>
  )
}
