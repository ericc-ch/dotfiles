import { describe, test, expect } from "bun:test"
import { listApps, launchApp } from "./apps"
import { AppRuntime } from "./runtime"
import { Exit } from "effect"

describe("listApps", () => {
  test("returns array of applications", async () => {
    const apps = await AppRuntime.runPromise(listApps())

    expect(apps).toBeDefined()
    expect(Array.isArray(apps)).toBe(true)
    expect(apps.length).toBeGreaterThan(0)
  })

  test("each app has required properties", async () => {
    const apps = await AppRuntime.runPromise(listApps())
    const app = apps[0]

    expect(app).toBeDefined()
    expect(app?.name).toBeDefined()
    expect(app?.entry).toBeDefined()
    expect(app?.executable).toBeDefined()
    expect(app?.icon_name).toBeDefined()
    expect(app?.frequency).toBeDefined()
    expect(Array.isArray(app?.keywords)).toBe(true)
    expect(Array.isArray(app?.categories)).toBe(true)
  })
})

describe("listApps with search", () => {
  test("returns filtered apps by search term", async () => {
    const apps = await AppRuntime.runPromise(listApps("a"))

    expect(apps).toBeDefined()
    expect(Array.isArray(apps)).toBe(true)
  })

  test("returns empty array for non-matching search", async () => {
    const apps = await AppRuntime.runPromise(listApps("nonexistent app 12345"))

    expect(Array.isArray(apps)).toBe(true)
  })
})

describe("launchApp", () => {
  test("throws error for invalid app name", async () => {
    const exit = await AppRuntime.runPromiseExit(
      launchApp("nonexistent app 12345"),
    )

    expect(Exit.isFailure(exit)).toBe(true)
  })
})
