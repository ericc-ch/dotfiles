import {
  createEffect,
  createSignal,
  getOwner,
  onCleanup,
  type Accessor,
} from "solid-js"

export interface Scheduled<Args extends unknown[]> {
  (...args: Args): void
  clear: () => void
}

/**
 * Creates a callback that is debounced and cancellable. The debounced callback is called on trailing edge.
 *
 * The timeout will be automatically cleared on root dispose.
 *
 * @param callback The callback to debounce
 * @param wait The duration to debounce in milliseconds
 * @returns The debounced function
 *
 * @see https://github.com/solidjs-community/solid-primitives/tree/main/packages/scheduled#debounce
 *
 * @example
 * ```ts
 * const fn = debounce((message: string) => console.log(message), 250)
 * fn('Hello!')
 * fn.clear() // clears a timeout in progress
 * ```
 */
export function debounce<Args extends unknown[]>(
  callback: (...args: Args) => void,
  wait?: number,
): Scheduled<Args> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const clear = () => clearTimeout(timeoutId)

  if (getOwner()) onCleanup(clear)

  const debounced: typeof callback = (...args) => {
    if (timeoutId !== undefined) clear()
    timeoutId = setTimeout(() => callback(...args), wait)
  }

  return Object.assign(debounced, { clear })
}

/**
 * Creates a debounced signal that tracks changes to a source signal with a delay.
 *
 * @param source The source signal accessor to debounce
 * @param wait The duration to debounce in milliseconds
 * @returns An accessor for the debounced value
 *
 * @example
 * ```ts
 * const [search, setSearch] = createSignal("")
 * const debouncedSearch = debouncedSignal(search, 200)
 *
 * createResource(debouncedSearch, fetchResults)
 * ```
 */
export function debouncedSignal<T>(
  source: Accessor<T>,
  wait: number,
): Accessor<T> {
  const [debounced, setDebounced] = createSignal<T>(source(), {
    equals: false,
  })

  const debouncedUpdate = debounce(
    (value: T) => setDebounced(() => value),
    wait,
  )

  createEffect(() => {
    debouncedUpdate(source())
  })

  return debounced
}
