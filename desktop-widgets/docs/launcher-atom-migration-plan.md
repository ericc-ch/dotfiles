# Launcher Atom Migration Plan

Migrate `src/launcher.tsx` from SolidJS signals and `createResource` to Effect-Atom patterns for reactive state management and async data fetching.

## Goals

1. **Replace signals with Atoms** — Use `@effect-atom/atom` for all reactive state
2. **Use `AtomRuntime` for async operations** — Leverage existing runtime with proper Effect integration
3. **Display errors in UI** — Replace `console.error` with `Result` pattern for user-visible error states
4. **Remove dead code** — Clean up `closeLauncher` function and unused patterns
5. **Add debouncing via Atom combinator** — Use built-in `Atom.debounce` instead of custom `debouncedSignal`

## Current State

### File: `src/launcher.tsx`

**Current patterns:**

- `createSignal` for `search` and `hoveredApp` state
- `debouncedSignal` (custom utility) for debouncing search input
- `createResource` with `AppRuntime.runPromise()` for fetching apps
- `closeLauncher` function that only resets state (doesn't actually close)
- Error handling via `console.error` (not user-visible)

**Imports:**

```typescript
import {
  createMemo,
  createResource,
  createSignal,
  For,
  type Component,
} from "solid-js"
import { debouncedSignal } from "./lib/debounce"
import { AppRuntime } from "./lib/runtime"
```

### File: `src/lib/apps.ts`

- `listApps(search?)` returns `Effect<Application[], ParseError | PlatformError>`
- `launchApp(name)` returns `Effect<void, CommandError>`
- Already Effect-native, perfect fit for Atom integration

### File: `src/lib/runtime.ts`

**Already configured:**

```typescript
export const AtomRuntime = Atom.context({ memoMap: sharedMemoMap })(AppLayer)
```

This provides:

- `AtomRuntime.atom(effect)` — Create atoms that run Effects with full service access
- `AtomRuntime.atom((get) => effect)` — Create derived atoms with dependencies
- Shared memo map with `AppRuntime` for consistent layer caching

---

## Architecture

### Atom Definitions (Module-Level)

```
┌─────────────────────────────────────────────────────────────┐
│                     Module-Level Atoms                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  searchAtom           hoveredAppAtom                         │
│  Atom<string>         Atom<number>                           │
│       │                                                      │
│       │ Atom.debounce(200)                                   │
│       ▼                                                      │
│  debouncedSearchAtom                                         │
│  Atom<string>                                                │
│       │                                                      │
│       │ AtomRuntime.atom((get) => ...)                       │
│       ▼                                                      │
│  appsAtom                                                    │
│  Atom<Result.Result<Application[], Error>>                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User types in input
       │
       ▼
searchAtom.set(value)
       │
       │ 200ms debounce (trailing edge)
       ▼
debouncedSearchAtom updates
       │
       │ triggers re-computation
       ▼
appsAtom fetches listApps(search)
       │
       │ Effect runs via AtomRuntime
       ▼
Result.Result<Application[], Error>
       │
       │ Result.match in UI
       ▼
Render: Loading | Error | App List
```

---

## Implementation

### Step 1: Define Atoms

Create module-level atoms at the top of `launcher.tsx`:

```typescript
import {
  Atom,
  useAtom,
  useAtomValue,
  RegistryProvider,
  Result,
} from "./lib/effect-solid"
import { AtomRuntime } from "./lib/runtime"
import { Cause } from "effect"

// -----------------------------------------------------------------------------
// Atoms (module-level singletons)
// -----------------------------------------------------------------------------

/** Current search input value */
const searchAtom = Atom.of("")

/** Debounced search value (200ms trailing edge) */
const debouncedSearchAtom = searchAtom.pipe(Atom.debounce(200))

/** Currently hovered app index */
const hoveredAppAtom = Atom.of(0)

/**
 * App list fetched from astal-apps.
 * Automatically refetches when debouncedSearchAtom changes.
 * Returns Result for loading/error/success states.
 */
const appsAtom = AtomRuntime.atom((get) => {
  const search = get(debouncedSearchAtom)
  return listApps(search)
})
```

**Key points:**

- `Atom.of("")` creates a writable atom with initial value
- `Atom.debounce(200)` creates a derived atom that debounces updates (trailing edge)
- `AtomRuntime.atom((get) => Effect)` creates an async atom that:
  - Tracks dependencies via `get()`
  - Returns `Result.Result<A, E>` for loading/error/success states
  - Has access to `AppLayer` services (BunContext, DaemonManager)

### Step 2: Update Component to Use Atoms

Replace signal usage with Atom hooks:

```typescript
export const Launcher = () => {
  const theme = useTheme()
  const dimensions = useTerminalDimensions()

  // Layout calculation (unchanged)
  const width = () => dimensions().width
  const height = () => dimensions().height
  const layout = createMemo(() => {
    /* ... same ... */
  })

  // Use atoms instead of signals
  const [search, setSearch] = useAtom(searchAtom)
  const [hoveredApp, setHoveredApp] = useAtom(hoveredAppAtom)
  const appsResult = useAtomValue(appsAtom)

  // ... rest of component
}
```

**Hook comparison:**

| Before                                                 | After                                             |
| ------------------------------------------------------ | ------------------------------------------------- |
| `const [search, setSearch] = createSignal("")`         | `const [search, setSearch] = useAtom(searchAtom)` |
| `const debouncedSearch = debouncedSignal(search, 200)` | _(handled by debouncedSearchAtom)_                |
| `const [apps] = createResource(debouncedSearch, ...)`  | `const appsResult = useAtomValue(appsAtom)`       |

### Step 3: Remove `closeLauncher` Function

**Before (dead code):**

```typescript
const closeLauncher = () => {
  setSearch("")
  setHoveredApp(0)
}
```

This function doesn't actually close anything — it just resets state. Remove it and inline the reset logic where needed.

**After:**

```typescript
// In escape key handler
if (event.name === "escape") {
  setSearch("")
  setHoveredApp(0)
}

// In ctrl+c handler
if (event.ctrl && event.name === "c" && search() !== "") {
  event.preventDefault()
  setSearch("")
}
```

### Step 4: Update Keyboard Handler

The keyboard handler remains mostly the same, just uses atom setters:

```typescript
useKeyboard((event) => {
  // Clear search on Ctrl+C (if search is not empty)
  if (event.ctrl && event.name === "c" && search() !== "") {
    event.preventDefault()
    setSearch("")
  }

  // Reset on Escape
  if (event.name === "escape") {
    setSearch("")
    setHoveredApp(0)
  }

  // Navigate up
  if (event.name === "up") {
    setHoveredApp((prev) => {
      const apps = getAppsFromResult(appsResult())
      const maxIndex = Math.min(apps.length, layout().maxItems) - 1
      return prev <= 0 ? maxIndex : prev - 1
    })
  }

  // Navigate down
  if (event.name === "down") {
    setHoveredApp((prev) => {
      const apps = getAppsFromResult(appsResult())
      const maxIndex = Math.min(apps.length, layout().maxItems) - 1
      return prev >= maxIndex ? 0 : prev + 1
    })
  }
})
```

**Helper function for safe app access:**

```typescript
/** Extract apps array from Result, returning empty array for non-success states */
const getAppsFromResult = (
  result: Result.Result<Application[], unknown>,
): Application[] => (Result.isSuccess(result) ? result.value : [])
```

### Step 5: Update App List Rendering with Result

Replace direct array access with `Result.match` for proper loading/error/success handling:

**Before:**

```typescript
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
```

**After:**

```typescript
{Result.match(appsResult(), {
  onInitial: () => (
    <text fg={theme().fg.darker} paddingLeft={3}>
      Loading...
    </text>
  ),
  onWaiting: (prev) => (
    // Show previous results while fetching new ones (optimistic UI)
    <For each={prev.value.slice(0, layout().maxItems)}>
      {(app, index) => (
        <AppListItem
          app={app}
          isHovered={index() === hoveredApp()}
          theme={theme()}
          itemHeight={layout().elements.itemHeight}
        />
      )}
    </For>
  ),
  onFailure: (cause) => (
    <box paddingLeft={3}>
      <text fg={theme().fg.normal}>
        Failed to load apps: {Cause.pretty(cause)}
      </text>
    </box>
  ),
  onSuccess: (apps) => (
    <For each={apps.slice(0, layout().maxItems)}>
      {(app, index) => (
        <AppListItem
          app={app}
          isHovered={index() === hoveredApp()}
          theme={theme()}
          itemHeight={layout().elements.itemHeight}
        />
      )}
    </For>
  ),
})}
```

**Result states:**

- `onInitial` — First load, no data yet
- `onWaiting` — Refetching, has previous data (`prev.value`)
- `onFailure` — Effect failed, has `Cause` with error details
- `onSuccess` — Has data (`apps` array)

### Step 6: Update `handleLaunchApp`

Update to safely access apps from Result:

**Before:**

```typescript
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
```

**After:**

```typescript
const handleLaunchApp = async () => {
  const result = appsResult()
  if (!Result.isSuccess(result)) return

  const apps = result.value.slice(0, layout().maxItems)
  const appToLaunch = apps.at(hoveredApp())
  if (!appToLaunch) return

  try {
    await AppRuntime.runPromise(launchApp(appToLaunch.name))
    // Reset state after successful launch
    setSearch("")
    setHoveredApp(0)
  } catch (error) {
    // Error is still logged for debugging, but UI shows Result state
    console.error("Failed to launch app:", error)
  }
}
```

**Note:** `launchApp` errors are one-shot operations, not part of the `appsAtom` Result. Consider adding a separate error display for launch failures if needed.

### Step 7: Wrap with RegistryProvider

Update the render call to include `RegistryProvider`:

**Before:**

```typescript
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
```

**After:**

```typescript
render(
  () => (
    <RegistryProvider>
      <ThemeProvider>
        <Launcher />
      </ThemeProvider>
    </RegistryProvider>
  ),
  {
    exitOnCtrlC: true,
    useKittyKeyboard: true,
  },
)
```

**Why RegistryProvider?**

- Provides the Atom registry context to all `useAtom`/`useAtomValue` hooks
- Manages atom lifecycle and subscriptions
- Without it, atoms use the default global registry (which works but is less explicit)

---

## Import Changes

### Remove

```typescript
import { createResource, createSignal } from "solid-js" // Remove these
import { debouncedSignal } from "./lib/debounce" // Remove
import { AppRuntime } from "./lib/runtime" // Keep for launchApp
```

### Add

```typescript
import {
  Atom,
  useAtom,
  useAtomValue,
  RegistryProvider,
  Result,
} from "./lib/effect-solid"
import { AtomRuntime } from "./lib/runtime"
import { Cause } from "effect"
```

### Final Imports

```typescript
import { render, useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { createMemo, For, type Component } from "solid-js"
import { Cause } from "effect"
import { launchApp, listApps, type Application } from "./lib/apps"
import type { ColorPalette } from "./lib/color"
import {
  Atom,
  useAtom,
  useAtomValue,
  RegistryProvider,
  Result,
} from "./lib/effect-solid"
import { AppRuntime, AtomRuntime } from "./lib/runtime"
import { truncate } from "./lib/truncate"
import { ThemeProvider, useTheme } from "./providers/theme"
```

---

## Effect-Atom Patterns Reference

### `Atom.of(initial)` — Create Writable Atom

```typescript
const searchAtom = Atom.of("")

// In component:
const [value, setValue] = useAtom(searchAtom)
setValue("new value")
setValue((prev) => prev + "!") // Updater function
```

### `Atom.debounce(duration)` — Debounce Combinator

```typescript
const debouncedAtom = sourceAtom.pipe(Atom.debounce(200))
// or
const debouncedAtom = Atom.debounce(sourceAtom, 200)
```

**Behavior:**

- Trailing edge debounce (updates after `duration` ms of no changes)
- Automatically cleans up timeouts on disposal
- Returns the same type as the source atom

### `AtomRuntime.atom((get) => Effect)` — Async Derived Atom

```typescript
const dataAtom = AtomRuntime.atom((get) => {
  const query = get(queryAtom) // Dependency tracking
  return fetchData(query) // Returns Effect
})

// Type: Atom<Result.Result<Data, Error>>
```

**Key points:**

- `get(atom)` tracks dependencies — atom re-runs when dependencies change
- Returned Effect runs via AtomRuntime (has access to AppLayer services)
- Result type wraps success/failure/loading states

### `Result.match` — Pattern Match on Result

```typescript
Result.match(result, {
  onInitial: () => /* loading, no data */,
  onWaiting: (prev) => /* loading, has previous data in prev.value */,
  onFailure: (cause) => /* error, cause has details */,
  onSuccess: (value) => /* success, value is the data */,
})
```

### `Result.isSuccess` — Type Guard

```typescript
if (Result.isSuccess(result)) {
  // result.value is typed as the success type
  console.log(result.value)
}
```

---

## Testing Considerations

After migration, verify:

1. **Initial load** — Shows "Loading..." then app list
2. **Search debounce** — Typing fast doesn't spam API calls
3. **Error display** — Simulate error (e.g., `astal-apps` not installed)
4. **Navigation** — Up/Down arrows work correctly with Result states
5. **Launch** — Selecting app launches it and resets state
6. **Keyboard shortcuts** — Escape and Ctrl+C still work

---

## Future Improvements

### Launch Error Display

Currently `launchApp` errors are only logged. Consider:

```typescript
const launchErrorAtom = Atom.of<string | null>(null)

const handleLaunchApp = async () => {
  // ... get app ...
  const exit = await AppRuntime.runPromiseExit(launchApp(appToLaunch.name))
  if (Exit.isFailure(exit)) {
    setLaunchError(Cause.pretty(exit.cause))
    return
  }
  setSearch("")
  setHoveredApp(0)
}

// In UI:
{launchError() && (
  <text fg={theme().accent.normal}>{launchError()}</text>
)}
```

### Optimistic Updates

For instant feedback during search:

```typescript
const appsAtom = AtomRuntime.atom((get) => {
  const search = get(debouncedSearchAtom)
  return listApps(search)
}).pipe(Atom.keepAlive) // Prevent disposal between renders
```

### Move Atoms to Separate Module

If launcher state needs to be accessed elsewhere:

```typescript
// src/atoms/launcher.ts
export const searchAtom = Atom.of("")
export const debouncedSearchAtom = searchAtom.pipe(Atom.debounce(200))
export const hoveredAppAtom = Atom.of(0)
export const appsAtom = AtomRuntime.atom(...)
```
