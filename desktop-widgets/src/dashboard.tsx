import { ConsolePosition, type CliRendererConfig } from "@opentui/core"
import { render, useKeyboard, useRenderer } from "@opentui/solid"
import { Effect } from "effect"
import { For } from "solid-js"
import { Clock } from "./components/dashboard/clock"
import { DaemonManager, type Daemon } from "./lib/daemon-manager"
import { Atom, Result, useAtomSet, useAtomValue } from "./lib/effect-solid"
import { AppRuntime, AtomRuntime } from "./lib/runtime"
import { RouterProvider } from "./providers/dashboard/router"
import { ThemeProvider, useTheme } from "./providers/theme"

const App = () => {
  const daemonsAtom = AtomRuntime.atom(
    Effect.gen(function* () {
      const dm = yield* DaemonManager
      return Array.from(yield* dm.list())
    }),
  )

  const startBarAtom = AtomRuntime.fn(
    Effect.fn(function* () {
      const dm = yield* DaemonManager
      yield* dm.start("status-bar")
    }),
  )

  const startBarTrigger = useAtomSet(startBarAtom, { mode: "promiseExit" })

  const renderer = useRenderer()
  const theme = useTheme()

  const daemonsResult = useAtomValue(daemonsAtom)
  const daemons = () => Result.getOrElse(daemonsResult(), () => [] as Daemon[])

  useKeyboard((event) => {
    if (event.name === "f12") {
      renderer.console.toggle()
    }

    if (event.name === "space") {
      startBarTrigger().then((exit) => {
        console.log("Bar exited with", JSON.stringify(exit))
      })
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

void AppRuntime.runPromise(
  Effect.gen(function* () {
    const dm = yield* DaemonManager
    yield* dm.set({
      name: "status-bar",
      command: ["kitten", "panel", "bar"],
    })
  }),
)

void render(
  () => (
    <ThemeProvider>
      <RouterProvider initialRoute="home">
        <App />
      </RouterProvider>
    </ThemeProvider>
  ),
  {
    exitOnCtrlC: true,
    useConsole: true,
    onDestroy: () => {
      void AppRuntime.dispose()
    },
    useKittyKeyboard: true,
    consoleOptions: {
      sizePercent: 100,
      position: ConsolePosition.RIGHT,
    },
  } satisfies CliRendererConfig,
)
