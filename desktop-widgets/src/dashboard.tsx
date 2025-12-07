import { ConsolePosition } from "@opentui/core"
import { render, useKeyboard, useRenderer } from "@opentui/solid"
import { Effect } from "effect"
import process from "node:process"
import { createSignal, For } from "solid-js"
import { AppLauncher } from "./components/dashboard/app-launcher"
import { Clock } from "./components/dashboard/clock"
import { DaemonManager, type Daemon } from "./lib/daemon-manager"
import { Atom, Result, useAtomValue } from "./lib/effect-solid"
import { AppRuntime, AtomRuntime } from "./lib/runtime"
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

const daemonsAtom = AtomRuntime.atom(
  Effect.gen(function* () {
    const dm = yield* DaemonManager
    return Array.from(yield* dm.list())
  }),
)

const App = () => {
  const renderer = useRenderer()
  const theme = useTheme()

  const [showAppLauncher, setShowAppLauncher] = createSignal(false)

  const daemonsResult = useAtomValue(daemonsAtom)
  const daemons = () => Result.getOrElse(daemonsResult(), () => [] as Daemon[])

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
          const stateAtom = Atom.subscriptionRef(daemon.state)
          const state = useAtomValue(stateAtom)

          return (
            <box>
              <text fg={theme().fg.normal}>
                {daemon.name}: {state()}
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
