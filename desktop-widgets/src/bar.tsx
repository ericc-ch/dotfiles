import { render } from "@opentui/solid"

import { ThemeProvider, useTheme } from "./providers/theme"
import { Clock } from "./components/bar/clock"
import { Stats } from "./components/bar/stats"

const App = () => {
  const theme = useTheme()

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
  },
)
