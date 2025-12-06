import { ConsolePosition } from "@opentui/core"
import { render, useKeyboard, useRenderer } from "@opentui/solid"
import { Effect, SubscriptionRef } from "effect"
import process from "node:process"
import { createResource, createSignal, For } from "solid-js"
import { AppLauncher } from "./components/dashboard/app-launcher"
import { Clock } from "./components/dashboard/clock"
import { DaemonManager } from "./lib/daemon-manager"
import { AppRuntime } from "./lib/runtime"
import { RouterProvider } from "./providers/dashboard/router"
import { ThemeProvider, useTheme } from "./providers/theme"

const main = Effect.gen(function* () {
  const dm = yield* DaemonManager
  yield* dm.set({
    name: "status-bar",
    command: ["kitten", "panel", "bar"],
  })
})

await AppRuntime.runPromise(main)

const App = () => {
  const renderer = useRenderer()
  const theme = useTheme()

  const [showAppLauncher, setShowAppLauncher] = createSignal(false)

  const [daemons] = createResource(
    () =>
      AppRuntime.runPromise(
        Effect.gen(function* () {
          const dm = yield* DaemonManager
          return yield* dm.list()
        }),
      ),
    {
      initialValue: [],
    },
  )

  useKeyboard((event) => {
    if (event.ctrl && event.name === "c" && !showAppLauncher()) {
      AppRuntime.dispose().finally(() => process.exit(0))
    }

    if (event.name === "f12") {
      renderer.console.toggle()
    }

    if (event.name === "space") {
      if (!showAppLauncher()) event.preventDefault()
      setShowAppLauncher(true)
    }

    if (event.name === "a") {
      AppRuntime.runPromise(
        Effect.gen(function* () {
          const dm = yield* DaemonManager
          const daemons = yield* dm.list()

          const statusBar = daemons.at(0)
          if (!statusBar) return

          const state = yield* SubscriptionRef.get(statusBar.state)
          console.log(`Status bar is currently: ${state}`)

          yield* dm.start("status-bar")
        }),
      ).catch(console.error)
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

      <For each={daemons()}>
        {(daemon) => {
          return (
            <box
              position="absolute"
              top={0}
              left={0}
              width="100%"
              height="100%"
            >
              <text fg={theme().fg.normal} bg={theme().bg.normal}>
                [Daemon: {daemon.name}: {}]
              </text>
            </box>
          )
        }}
      </For>

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
