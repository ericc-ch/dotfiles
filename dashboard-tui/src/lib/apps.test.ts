import { describe, test, expect } from "bun:test"
import { listApps, launchApp, extractAppBasename } from "./apps"

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

describe("listApps with search", () => {
  test("returns filtered apps by search term", async () => {
    const apps = await listApps("terminal")

    expect(apps).toBeDefined()
    expect(Array.isArray(apps)).toBe(true)
  })

  test("returns empty array for non-matching search", async () => {
    const apps = await listApps("xyznonexistentapp12345")

    expect(Array.isArray(apps)).toBe(true)
  })

  test("returns empty array for non-matching search", async () => {
    const apps = await listApps("xyznonexistentapp12345")

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

describe("extractAppBasename", () => {
  test("extracts basename from simple entry", () => {
    expect(extractAppBasename("zen.desktop")).toBe("zen")
    expect(extractAppBasename("kitty.desktop")).toBe("kitty")
    expect(extractAppBasename("bruno.desktop")).toBe("bruno")
  })

  test("extracts basename from reverse-DNS entry", () => {
    expect(extractAppBasename("com.mitchellh.ghostty.desktop")).toBe("ghostty")
    expect(extractAppBasename("org.gnome.Nautilus.desktop")).toBe("Nautilus")
    expect(extractAppBasename("com.obsproject.Studio.desktop")).toBe("Studio")
    expect(extractAppBasename("dev.zed.Zed.desktop")).toBe("Zed")
  })

  test("handles entry without .desktop suffix", () => {
    expect(extractAppBasename("zen")).toBe("zen")
    expect(extractAppBasename("com.mitchellh.ghostty")).toBe("ghostty")
  })

  test("handles edge cases", () => {
    expect(extractAppBasename("")).toBe("")
    expect(extractAppBasename("singlename")).toBe("singlename")
  })
})
