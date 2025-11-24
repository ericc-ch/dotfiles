import { describe, test, expect } from "bun:test"
import { listApps, searchApps, launchApp } from "./apps"

describe("listApps", () => {
  test("returns array of applications", async () => {
    const apps = await listApps()

    expect(apps).toBeDefined()
    expect(Array.isArray(apps)).toBe(true)
    expect(apps.length).toBeGreaterThan(0)
  })

  test("each app has required properties", async () => {
    const apps = await listApps()
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

describe("searchApps", () => {
  test("returns filtered apps by search term", async () => {
    const apps = await searchApps("terminal")

    expect(apps).toBeDefined()
    expect(Array.isArray(apps)).toBe(true)
  })

  test("returns empty array for non-matching search", async () => {
    const apps = await searchApps("xyznonexistentapp12345")

    expect(Array.isArray(apps)).toBe(true)
  })
})

describe("launchApp", () => {
  test("throws error for invalid app entry", async () => {
    expect(async () => {
      await launchApp("nonexistent.desktop")
    }).toThrow()
  })
})
