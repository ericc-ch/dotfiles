import { createSignal } from "solid-js"
import { useTheme } from "../providers/theme"
import { Backdrop } from "./backdrop"
import { useTerminalDimensions } from "@opentui/solid"

export const AppLauncher = () => {
  const theme = useTheme()
  const dimensions = useTerminalDimensions()

  const minWidth = () => Math.min(64, dimensions().width - 8)
  const [search, setSearch] = createSignal("")

  return (
    <Backdrop>
      <box
        backgroundColor={theme().bg.normal}
        paddingTop={1}
        paddingRight={2}
        paddingBottom={1}
        paddingLeft={2}
        minWidth={minWidth()}
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
            flexGrow={1}
            placeholder="Search apps..."
            textColor={theme().fg.normal}
            focusedTextColor={theme().fg.normal}
            backgroundColor={theme().bg.normal}
            focusedBackgroundColor={theme().bg.normal}
            focused
            onInput={setSearch}
          />
          {/* acts as padding since input doesnt count as content */}
          <box height={1}></box>
        </box>
      </box>
    </Backdrop>
  )
}
