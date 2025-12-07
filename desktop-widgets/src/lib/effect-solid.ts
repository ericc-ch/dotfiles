/**
 * Solid bindings for @effect-atom/atom
 * Following the official React/Vue API patterns
 */
import * as AtomNs from "@effect-atom/atom/Atom"
import type * as AtomRefNs from "@effect-atom/atom/AtomRef"
import * as Registry from "@effect-atom/atom/Registry"
import type * as ResultNs from "@effect-atom/atom/Result"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import { globalValue } from "effect/GlobalValue"
import type { Accessor } from "solid-js"
import { createContext, createSignal, onCleanup, useContext } from "solid-js"

// Re-exports
export * as Atom from "@effect-atom/atom/Atom"
export * as AtomHttpApi from "@effect-atom/atom/AtomHttpApi"
export * as AtomRef from "@effect-atom/atom/AtomRef"
export * as AtomRpc from "@effect-atom/atom/AtomRpc"
export * as Hydration from "@effect-atom/atom/Hydration"
export * as Registry from "@effect-atom/atom/Registry"
export * as Result from "@effect-atom/atom/Result"

/**
 * Context for providing a custom registry
 */
export const RegistryContext = createContext<Registry.Registry>()

/**
 * Default global registry (singleton)
 */
export const defaultRegistry: Registry.Registry = globalValue(
  "@effect-atom/atom-solid/defaultRegistry",
  () => Registry.make(),
)

/**
 * Get the current registry from context or fall back to default
 */
export const useRegistry = (): Registry.Registry => {
  return useContext(RegistryContext) ?? defaultRegistry
}

/**
 * Subscribe to an atom's value reactively
 */
export const useAtomValue: {
  <A>(atom: AtomNs.Atom<A>): Accessor<A>
  <A, B>(atom: AtomNs.Atom<A>, f: (_: A) => B): Accessor<B>
} = <A, B>(atom: AtomNs.Atom<A>, f?: (_: A) => B): Accessor<A | B> => {
  const registry = useRegistry()

  if (f) {
    const mappedAtom = AtomNs.map(atom, f)
    const [value, setValue] = createSignal<B>(registry.get(mappedAtom))

    const unsubscribe = registry.subscribe(mappedAtom, (nextValue) => {
      setValue(() => nextValue)
    })
    onCleanup(unsubscribe)

    return value
  }

  const [value, setValue] = createSignal<A>(registry.get(atom))

  const unsubscribe = registry.subscribe(atom, (nextValue) => {
    setValue(() => nextValue)
  })
  onCleanup(unsubscribe)

  return value
}

/**
 * Mount an atom (keep it alive while component exists)
 */
export const useAtomMount = <A>(atom: AtomNs.Atom<A>): void => {
  const registry = useRegistry()
  const unmount = registry.mount(atom)
  onCleanup(unmount)
}

const flattenExit = <A, E>(exit: Exit.Exit<A, E>): A => {
  if (Exit.isSuccess(exit)) return exit.value
  throw Cause.squash(exit.cause)
}

/**
 * Get a setter function for a writable atom
 */
export const useAtomSet = <
  R,
  W,
  Mode extends "value" | "promise" | "promiseExit" = never,
>(
  atom: AtomNs.Writable<R, W>,
  options?: {
    readonly mode?: [R] extends [ResultNs.Result<any, any>] ? Mode
    : "value" | undefined
  },
): "promise" extends Mode ? (value: W) => Promise<ResultNs.Result.Success<R>>
: "promiseExit" extends Mode ?
  (
    value: W,
  ) => Promise<
    Exit.Exit<ResultNs.Result.Success<R>, ResultNs.Result.Failure<R>>
  >
: (value: W | ((prev: R) => W)) => void => {
  const registry = useRegistry()

  // Mount the atom (keeps it alive while component exists)
  const unmount = registry.mount(atom)
  onCleanup(unmount)

  if (options?.mode === "promise" || options?.mode === "promiseExit") {
    return ((value: W) => {
      registry.set(atom, value)
      const promise = Effect.runPromiseExit(
        Registry.getResult(
          registry,
          atom as AtomNs.Atom<ResultNs.Result<any, any>>,
          { suspendOnWaiting: true },
        ),
      )
      return options.mode === "promise" ? promise.then(flattenExit) : promise
    }) as any
  }

  return ((value: W | ((prev: R) => W)) => {
    registry.set(
      atom,
      typeof value === "function" ?
        (value as (prev: R) => W)(registry.get(atom))
      : value,
    )
  }) as any
}

/**
 * Refresh an atom (re-run its effect/computation)
 */
export const useAtomRefresh = <A>(atom: AtomNs.Atom<A>): (() => void) => {
  const registry = useRegistry()

  // Mount the atom
  const unmount = registry.mount(atom)
  onCleanup(unmount)

  return () => registry.refresh(atom)
}

/**
 * Subscribe to an atom's value and get a setter (for writable atoms)
 */
export const useAtom = <
  R,
  W,
  const Mode extends "value" | "promise" | "promiseExit" = never,
>(
  atom: AtomNs.Writable<R, W>,
  options?: {
    readonly mode?: [R] extends [ResultNs.Result<any, any>] ? Mode
    : "value" | undefined
  },
): readonly [
  value: Accessor<R>,
  write: "promise" extends Mode ?
    (value: W) => Promise<ResultNs.Result.Success<R>>
  : "promiseExit" extends Mode ?
    (
      value: W,
    ) => Promise<
      Exit.Exit<ResultNs.Result.Success<R>, ResultNs.Result.Failure<R>>
    >
  : (value: W | ((value: R) => W)) => void,
] => {
  const registry = useRegistry()
  const [value, setValue] = createSignal<R>(registry.get(atom))

  // Mount the atom
  const unmount = registry.mount(atom)
  onCleanup(unmount)

  // Subscribe to changes
  const unsubscribe = registry.subscribe(atom, (nextValue) => {
    setValue(() => nextValue)
  })
  onCleanup(unsubscribe)

  let setter: any

  if (options?.mode === "promise" || options?.mode === "promiseExit") {
    setter = (newValue: W) => {
      registry.set(atom, newValue)
      const promise = Effect.runPromiseExit(
        Registry.getResult(
          registry,
          atom as AtomNs.Atom<ResultNs.Result<any, any>>,
          { suspendOnWaiting: true },
        ),
      )
      return options.mode === "promise" ? promise.then(flattenExit) : promise
    }
  } else {
    setter = (newValue: W | ((prev: R) => W)) => {
      registry.set(
        atom,
        typeof newValue === "function" ?
          (newValue as (prev: R) => W)(registry.get(atom))
        : newValue,
      )
    }
  }

  return [value, setter] as const
}

/**
 * Subscribe to atom changes with a callback
 */
export const useAtomSubscribe = <A>(
  atom: AtomNs.Atom<A>,
  f: (_: A) => void,
  options?: { readonly immediate?: boolean },
): void => {
  const registry = useRegistry()
  const unsubscribe = registry.subscribe(atom, f, options)
  onCleanup(unsubscribe)
}

/**
 * Subscribe to an AtomRef's value reactively
 */
export const useAtomRef = <A>(ref: AtomRefNs.ReadonlyRef<A>): Accessor<A> => {
  const [value, setValue] = createSignal<A>(ref.value)
  const unsubscribe = ref.subscribe((next) => {
    setValue(() => next)
  })
  onCleanup(unsubscribe)
  return value
}

/**
 * Get a prop lens from an AtomRef
 */
export const useAtomRefProp = <A, K extends keyof A>(
  ref: AtomRefNs.AtomRef<A>,
  prop: K,
): AtomRefNs.AtomRef<A[K]> => ref.prop(prop)

/**
 * Get a prop value from an AtomRef
 */
export const useAtomRefPropValue = <A, K extends keyof A>(
  ref: AtomRefNs.AtomRef<A>,
  prop: K,
): Accessor<A[K]> => useAtomRef(useAtomRefProp(ref, prop))
