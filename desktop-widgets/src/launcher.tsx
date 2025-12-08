import { Atom, Result } from "@effect-atom/atom"
import { render, useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { Exit, pipe } from "effect"
import { createMemo, For, type Component } from "solid-js"
import { Applications, launchApp, listApps, type Application } from "./lib/apps"
import type { ColorPalette } from "./lib/color"
import { useAtom, useAtomSet, useAtomValue } from "./lib/effect-solid"
import { AtomRuntime } from "./lib/runtime"
import { truncate } from "./lib/truncate"
import { ThemeProvider, useTheme } from "./providers/theme"

const AppListItem: Component<{
  app: typeof Application.Type
  isHovered: boolean
  theme: ColorPalette
  itemHeight: number
}> = (props) => {
  const dimensions = useTerminalDimensions()
  const nameLength = () => Math.floor(0.6 * dimensions().width)
  const categoriesLength = () => Math.floor(0.4 * dimensions().width)

  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      height={props.itemHeight}
      paddingLeft={3}
      paddingRight={3}
      backgroundColor={
        props.isHovered ? props.theme.fg.darker : props.theme.bg.normal
      }
    >
      <text
        fg={props.isHovered ? props.theme.bg.darker : props.theme.fg.normal}
      >
        <strong>{truncate(props.app.name, nameLength())}</strong>
      </text>

      <text
        fg={props.isHovered ? props.theme.bg.normal : props.theme.fg.darker}
      >
        {truncate(
          props.app.categories.slice(0, 1).join(", "),
          categoriesLength(),
        )}
      </text>
    </box>
  )
}

export const Launcher = () => {
  const searchAtom = Atom.make("")
  const debouncedSearchAtom = Atom.debounce(searchAtom, 200)
  const hoveredAppAtom = Atom.make(0)

  const appsAtom = AtomRuntime.atom((get) => {
    const search = get(debouncedSearchAtom)
    return listApps(search)
  })

  const launchAppAtom = AtomRuntime.fn((name: string) => launchApp(name))

  const theme = useTheme()
  const dimensions = useTerminalDimensions()

  const width = () => dimensions().width
  const height = () => dimensions().height

  const layout = createMemo(() => {
    const config = {
      padding: { top: 1, bottom: 1 },
      spacing: { gap: 1 },
      elements: {
        input: 1,
        itemHeight: 1,
      },
    }

    const reservedHeight =
      config.padding.top
      + config.elements.input
      + config.spacing.gap
      + config.padding.bottom

    const availableHeight = height() - reservedHeight
    const maxItems = Math.floor(availableHeight / config.elements.itemHeight)

    return {
      ...config,
      reservedHeight,
      availableHeight,
      maxItems,
    }
  })

  const [search, setSearch] = useAtom(searchAtom)
  const [hoveredApp, setHoveredApp] = useAtom(hoveredAppAtom)
  const appsResult = useAtomValue(appsAtom)
  const launchAppTrigger = useAtomSet(launchAppAtom, {
    mode: "promiseExit",
  })

  const maxIndex = () => Math.min(apps().length, layout().maxItems) - 1

  const apps = () =>
    pipe(
      appsResult(),
      Result.getOrElse(() => [] as typeof Applications.Type),
    ).slice(0, layout().maxItems)

  useKeyboard((event) => {
    if (event.name === "escape") {
      process.exit(0)
    }

    if (event.name === "up") {
      setHoveredApp((prev) => (prev - 1 < 0 ? maxIndex() : prev - 1))
    }

    if (event.name === "down") {
      setHoveredApp((prev) => (prev + 1 > maxIndex() ? 0 : prev + 1))
    }
  })

  const handleLaunchApp = async () => {
    const appToLaunch = apps().at(hoveredApp())
    if (!appToLaunch) return

    const exit = await launchAppTrigger(appToLaunch.name)

    if (Exit.isSuccess(exit)) {
      process.exit(0)
    }
  }

  return (
    <box
      width={width()}
      height={height()}
      paddingTop={layout().padding.top}
      paddingBottom={layout().padding.bottom}
      gap={layout().spacing.gap}
      backgroundColor={theme().bg.normal}
    >
      <box
        flexDirection="row"
        gap={1}
        backgroundColor={theme().bg.normal}
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={theme().fg.normal}>{">"}</text>
        <input
          value={search()}
          onInput={setSearch}
          onSubmit={handleLaunchApp}
          focused
          placeholder="Search apps..."
          textColor={theme().fg.normal}
          focusedTextColor={theme().fg.normal}
          backgroundColor={theme().bg.normal}
          focusedBackgroundColor={theme().bg.normal}
          flexGrow={1}
        />
        {/* acts as padding since input doesnt count as content */}
        <box height={1}></box>
      </box>

      <box>
        <For each={apps()}>
          {(app, index) => (
            <AppListItem
              app={app}
              isHovered={index() === hoveredApp()}
              theme={theme()}
              itemHeight={layout().elements.itemHeight}
            />
          )}
        </For>
      </box>
    </box>
  )
}

render(
  () => (
    <ThemeProvider>
      <Launcher />
    </ThemeProvider>
  ),
  {
    exitOnCtrlC: true,
    useKittyKeyboard: true,
  },
)
