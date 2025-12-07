import { render, useKeyboard, useTerminalDimensions } from "@opentui/solid"
import {
  createMemo,
  createResource,
  createSignal,
  For,
  type Component,
} from "solid-js"
import { launchApp, listApps, type Application } from "./lib/apps"
import type { ColorPalette } from "./lib/color"
import { debouncedSignal } from "./lib/debounce"
import { AppRuntime } from "./lib/runtime"
import { truncate } from "./lib/truncate"
import { ThemeProvider, useTheme } from "./providers/theme"

const AppListItem: Component<{
  app: typeof Application.Type
  isHovered: boolean
  theme: ColorPalette
  itemHeight: number
}> = (props) => {
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
        <strong>{truncate(props.app.name, 25)}</strong>
      </text>

      <text
        fg={props.isHovered ? props.theme.bg.normal : props.theme.fg.darker}
      >
        {props.app.categories.slice(0, 2).join(", ")}
      </text>
    </box>
  )
}

export const Launcher = () => {
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

  const [search, setSearch] = createSignal("")
  const debouncedSearch = debouncedSignal(search, 200)
  const [hoveredApp, setHoveredApp] = createSignal(0)

  const [apps] = createResource(
    debouncedSearch,
    (search) => AppRuntime.runPromise(listApps(search)),
    {
      initialValue: [],
    },
  )
  const trimmedApps = () => apps().slice(0, layout().maxItems)

  const closeLauncher = () => {
    setSearch("")
    setHoveredApp(0)
  }

  useKeyboard((event) => {
    if (event.ctrl && event.name === "c" && search() !== "") {
      event.preventDefault()
      setSearch("")
    }

    if (event.name === "escape") {
      closeLauncher()
    }

    if (event.name === "up") {
      setHoveredApp((prev) => {
        const next = prev - 1

        if (next < 0) {
          return trimmedApps().length - 1
        }
        return next
      })
    }

    if (event.name === "down") {
      setHoveredApp((prev) => {
        const next = prev + 1

        if (next >= trimmedApps().length) {
          return 0
        }
        return next
      })
    }
  })

  const handleLaunchApp = async () => {
    const appToLaunch = trimmedApps().at(hoveredApp())
    if (!appToLaunch) return

    try {
      await AppRuntime.runPromise(launchApp(appToLaunch.name))
      closeLauncher()
    } catch (error) {
      console.error("Failed to launch app:", error, JSON.stringify(error))
    }
  }

  return (
    <box
      width={width()}
      height={height()}
      paddingTop={layout().padding.top}
      paddingBottom={layout().padding.bottom}
      gap={layout().spacing.gap}
      backgroundColor={theme().bg.darker}
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
        <For each={trimmedApps()}>
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
