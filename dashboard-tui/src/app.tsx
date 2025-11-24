import { useKeyboard, useRenderer } from "@opentui/solid"
import { createSignal } from "solid-js"
import { AppLauncher } from "./components/app-launcher"
import { Clock } from "./components/clock"
import { useTheme } from "./providers/theme"

export const App = () => {
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
      event.preventDefault()
      setShowAppLauncher(true)
    }

    if (event.name === "escape") {
      setShowAppLauncher(false)
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
      <AppLauncher show={showAppLauncher()} />

      <box position="absolute" bottom={0}>
        <text>Press [space] to open the app launcher</text>
      </box>
    </box>
  )
}
