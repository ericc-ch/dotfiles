import { render, useKeyboard, useRenderer } from "@opentui/solid"

import { ThemeProvider, useTheme } from "./providers/theme"
import { Clock } from "./components/bar/clock"
import { Stats } from "./components/bar/stats"
import { ConsolePosition } from "@opentui/core"

const App = () => {
  const renderer = useRenderer()
  const theme = useTheme()

  useKeyboard((event) => {
    if (event.name === "f12") {
      renderer.console.toggle()
    }
  })

  return (
    <box
      height={1}
      width="100%"
      backgroundColor={theme().bg.normal}
      flexDirection="row"
      justifyContent="space-between"
    >
      <Clock />
      <Stats />
    </box>
  )
}

render(
  () => (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  ),
  {
    useKittyKeyboard: true,
    consoleOptions: {
      sizePercent: 100,
      position: ConsolePosition.RIGHT,
    },
  },
)
