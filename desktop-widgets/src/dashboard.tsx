import { ConsolePosition } from "@opentui/core"
import { render, useKeyboard, useRenderer } from "@opentui/solid"
import { createSignal } from "solid-js"

import { AppLauncher } from "./components/dashboard/app-launcher"
import { Clock } from "./components/dashboard/clock"
import { RouterProvider } from "./providers/dashboard/router"
import { ThemeProvider, useTheme } from "./providers/theme"

const App = () => {
  const renderer = useRenderer()
  const theme = useTheme()

  const [showAppLauncher, setShowAppLauncher] = createSignal(false)

  useKeyboard((event) => {
    if (event.ctrl && event.name === "c" && !showAppLauncher()) {
      process.exit(0)
    }

    if (event.name === "f12") {
      renderer.console.toggle()
    }

    if (event.name === "space") {
      if (!showAppLauncher()) event.preventDefault()
      setShowAppLauncher(true)
    }
  })

  return (
    <box
      backgroundColor={theme().bg.normal}
      alignItems="center"
      justifyContent="center"
      flexGrow={1}
    >
      {/* Clock is the only static element */}
      <Clock />

      {/* This is an overlay + modal, absolute */}
      <AppLauncher
        show={showAppLauncher()}
        onClose={() => setShowAppLauncher(false)}
      />

      <box
        paddingLeft={1}
        paddingRight={1}
        position="absolute"
        bottom={0}
        width="100%"
      >
        <text fg={theme().fg.normal}>[q] Quit [space] App Launcher</text>
      </box>
    </box>
  )
}

render(
  () => (
    <ThemeProvider>
      <RouterProvider initialRoute="home">
        <App />
      </RouterProvider>
    </ThemeProvider>
  ),
  {
    exitOnCtrlC: false,
    useKittyKeyboard: true,
    consoleOptions: {
      sizePercent: 100,
      position: ConsolePosition.RIGHT,
    },
  },
)
