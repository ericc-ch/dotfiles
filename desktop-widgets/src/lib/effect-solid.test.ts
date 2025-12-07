import { describe, expect, test } from "bun:test"
import { AtomRef } from "@effect-atom/atom"
import { createRoot } from "solid-js"
import {
  Atom,
  defaultRegistry,
  Registry,
  useAtom,
  useAtomMount,
  useAtomRef,
  useAtomRefProp,
  useAtomRefPropValue,
  useAtomRefresh,
  useAtomSet,
  useAtomSubscribe,
  useAtomValue,
} from "./effect-solid"

describe("effect-solid", () => {
  describe("useAtomValue", () => {
    test("returns initial atom value", () => {
      const countAtom = Atom.make(42)

      createRoot((dispose) => {
        const count = useAtomValue(countAtom)
        expect(count()).toBe(42)
        dispose()
      })
    })

    test("updates when atom changes", () => {
      const registry = Registry.make()
      const countAtom = Atom.make(0)

      createRoot((dispose) => {
        // Use custom registry via context
        const count = (() => {
          // Manually set registry for test (simulating context)
          const originalGet = defaultRegistry.get
          ;(defaultRegistry as any).get = registry.get.bind(registry)
          ;(defaultRegistry as any).subscribe =
            registry.subscribe.bind(registry)
          ;(defaultRegistry as any).mount = registry.mount.bind(registry)
          ;(defaultRegistry as any).set = registry.set.bind(registry)

          const result = useAtomValue(countAtom)

          // Restore
          ;(defaultRegistry as any).get = originalGet

          return result
        })()

        expect(count()).toBe(0)

        registry.set(countAtom, 10)
        expect(count()).toBe(10)

        registry.set(countAtom, 99)
        expect(count()).toBe(99)

        dispose()
      })
    })

    test("works with derived atoms", () => {
      const countAtom = Atom.make(5)
      const doubledAtom = Atom.map(countAtom, (n) => n * 2)

      createRoot((dispose) => {
        const doubled = useAtomValue(doubledAtom)
        expect(doubled()).toBe(10)
        dispose()
      })
    })

    test("works with optional mapper function", () => {
      const countAtom = Atom.make(5)

      createRoot((dispose) => {
        const doubled = useAtomValue(countAtom, (n) => n * 2)
        expect(doubled()).toBe(10)
        dispose()
      })
    })
  })

  describe("useAtomSet", () => {
    test("returns a setter function", () => {
      const registry = Registry.make()
      const countAtom = Atom.make(0)

      createRoot((dispose) => {
        // Patch registry for test
        const origMount = defaultRegistry.mount
        const origSet = defaultRegistry.set
        const origGet = defaultRegistry.get
        ;(defaultRegistry as any).mount = registry.mount.bind(registry)
        ;(defaultRegistry as any).set = registry.set.bind(registry)
        ;(defaultRegistry as any).get = registry.get.bind(registry)

        const setCount = useAtomSet(countAtom)

        expect(typeof setCount).toBe("function")
        expect(registry.get(countAtom)).toBe(0)

        setCount(5)
        expect(registry.get(countAtom)).toBe(5)

        // Test function updater
        setCount((prev) => prev + 1)
        expect(registry.get(countAtom)).toBe(6)

        // Restore
        ;(defaultRegistry as any).mount = origMount
        ;(defaultRegistry as any).set = origSet
        ;(defaultRegistry as any).get = origGet

        dispose()
      })
    })
  })

  describe("useAtom", () => {
    test("returns value accessor and setter", () => {
      const registry = Registry.make()
      const countAtom = Atom.make(0)

      createRoot((dispose) => {
        // Patch registry for test
        const origMount = defaultRegistry.mount
        const origSet = defaultRegistry.set
        const origGet = defaultRegistry.get
        const origSubscribe = defaultRegistry.subscribe
        ;(defaultRegistry as any).mount = registry.mount.bind(registry)
        ;(defaultRegistry as any).set = registry.set.bind(registry)
        ;(defaultRegistry as any).get = registry.get.bind(registry)
        ;(defaultRegistry as any).subscribe = registry.subscribe.bind(registry)

        const [count, setCount] = useAtom(countAtom)

        expect(count()).toBe(0)

        setCount(10)
        expect(count()).toBe(10)
        expect(registry.get(countAtom)).toBe(10)

        setCount((prev) => prev * 2)
        expect(count()).toBe(20)

        // Restore
        ;(defaultRegistry as any).mount = origMount
        ;(defaultRegistry as any).set = origSet
        ;(defaultRegistry as any).get = origGet
        ;(defaultRegistry as any).subscribe = origSubscribe

        dispose()
      })
    })
  })

  describe("useAtomRefresh", () => {
    test("returns a refresh function", () => {
      const registry = Registry.make()
      let computeCount = 0
      const computedAtom = Atom.make(() => {
        computeCount++
        return computeCount
      })

      createRoot((dispose) => {
        // Patch registry for test
        const origMount = defaultRegistry.mount
        const origRefresh = defaultRegistry.refresh
        const origGet = defaultRegistry.get
        ;(defaultRegistry as any).mount = registry.mount.bind(registry)
        ;(defaultRegistry as any).refresh = registry.refresh.bind(registry)
        ;(defaultRegistry as any).get = registry.get.bind(registry)

        const refresh = useAtomRefresh(computedAtom)
        expect(typeof refresh).toBe("function")

        // Initial computation
        registry.get(computedAtom)
        const initialCount = computeCount

        // Refresh should recompute
        refresh()
        const value2 = registry.get(computedAtom)
        expect(value2).toBe(initialCount + 1)

        // Restore
        ;(defaultRegistry as any).mount = origMount
        ;(defaultRegistry as any).refresh = origRefresh
        ;(defaultRegistry as any).get = origGet

        dispose()
      })
    })
  })

  describe("useAtomMount", () => {
    test("mounts the atom without returning value", () => {
      const registry = Registry.make()
      let mountCalled = false
      const origMount = defaultRegistry.mount

      createRoot((dispose) => {
        ;(defaultRegistry as any).mount = (atom: any) => {
          mountCalled = true
          return registry.mount(atom)
        }

        const countAtom = Atom.make(42)
        useAtomMount(countAtom)

        expect(mountCalled).toBe(true)

        // Restore
        ;(defaultRegistry as any).mount = origMount

        dispose()
      })
    })
  })

  describe("useAtomSubscribe", () => {
    test("subscribes to atom changes with callback", () => {
      const registry = Registry.make()
      const countAtom = Atom.make(0)
      const values: number[] = []

      createRoot((dispose) => {
        // Patch registry for test
        const origSubscribe = defaultRegistry.subscribe
        ;(defaultRegistry as any).subscribe = registry.subscribe.bind(registry)

        useAtomSubscribe(countAtom, (value) => {
          values.push(value)
        })

        registry.set(countAtom, 1)
        registry.set(countAtom, 2)
        registry.set(countAtom, 3)

        expect(values).toEqual([1, 2, 3])

        // Restore
        ;(defaultRegistry as any).subscribe = origSubscribe

        dispose()
      })
    })

    test("supports immediate option", () => {
      const registry = Registry.make()
      const countAtom = Atom.make(42)
      const values: number[] = []

      createRoot((dispose) => {
        // Patch registry for test
        const origSubscribe = defaultRegistry.subscribe
        ;(defaultRegistry as any).subscribe = registry.subscribe.bind(registry)

        useAtomSubscribe(
          countAtom,
          (value) => {
            values.push(value)
          },
          { immediate: true },
        )

        // With immediate: true, should receive current value immediately
        expect(values).toEqual([42])

        // Restore
        ;(defaultRegistry as any).subscribe = origSubscribe

        dispose()
      })
    })
  })

  describe("useAtomRef", () => {
    test("subscribes to AtomRef value", () => {
      const ref = AtomRef.make(10)

      createRoot((dispose) => {
        const value = useAtomRef(ref)
        expect(value()).toBe(10)

        ref.set(20)
        expect(value()).toBe(20)

        dispose()
      })
    })
  })

  describe("useAtomRefProp", () => {
    test("returns a prop lens from AtomRef", () => {
      const ref = AtomRef.make({ name: "test", count: 5 })

      createRoot((dispose) => {
        const countRef = useAtomRefProp(ref, "count")

        expect(countRef.value).toBe(5)

        countRef.set(10)
        expect(ref.value.count).toBe(10)

        dispose()
      })
    })
  })

  describe("useAtomRefPropValue", () => {
    test("returns reactive prop value from AtomRef", () => {
      const ref = AtomRef.make({ name: "test", count: 5 })

      createRoot((dispose) => {
        const count = useAtomRefPropValue(ref, "count")

        expect(count()).toBe(5)

        ref.set({ ...ref.value, count: 15 })
        expect(count()).toBe(15)

        dispose()
      })
    })
  })

  describe("with SubscriptionRef pattern", () => {
    test("Atom.subscriptionRef creates writable atom from SubscriptionRef", async () => {
      const { Effect, SubscriptionRef } = await import("effect")
      const registry = Registry.make()

      // Create a SubscriptionRef
      const ref = Effect.runSync(SubscriptionRef.make("initial"))

      // Wrap it in an atom
      const stateAtom = Atom.subscriptionRef(ref)

      // Get initial value directly from registry
      const initialValue = registry.get(stateAtom)
      expect(initialValue).toBe("initial")

      // Update via SubscriptionRef
      Effect.runSync(SubscriptionRef.set(ref, "updated"))

      // Wait for subscription to propagate
      await new Promise((resolve) => setTimeout(resolve, 50))

      // The atom should reflect the change
      const updatedValue = registry.get(stateAtom)
      expect(updatedValue).toBe("updated")
    })
  })
})
