// Behavioural test for the compiled plugin. No framework: `npm test` builds
// dist/ first, then this script stages a throwaway module tree, imports the real
// dist/tui.js and drives its `setup()` with a fake context + fake key emitter.
//
// 🔴 WHY A HAND-ROLLED HARNESS AND NOT A TUI. The gesture's only true test is a
// live PTY, which CI cannot have. What CAN be pinned deterministically is the
// logic the gesture turns on: the 800 ms window, the route gate, the
// fire-then-reset behaviour and teardown. That is what this asserts.
//
// 🔴 THE STUB IS A DELIBERATE LIE ABOUT ONE FILE. `@opencode/plugin/tui` is
// injected by the running opencode binary; here it is replaced by a module whose
// `Plugin.define` is the identity function. That is exactly what opencode's own
// runtime does for this call (define() returns the definition), so the plugin
// body under test is the real compiled one.

import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile, copyFile, readFile, rm } from "node:fs/promises"
import { existsSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BUILT = path.join(ROOT, "dist", "tui.js")
const SOURCE = path.join(ROOT, "src", "tui.ts")

const PLUGIN_ID = "opencode.double-esc-timeline"
const TIMELINE_COMMAND = "session.timeline"

const checks = []
const check = (name, ok) => {
  checks.push([name, ok])
}

async function stage() {
  const tmp = await mkdtemp(path.join(tmpdir(), "odeet-"))
  await writeFile(path.join(tmp, "package.json"), JSON.stringify({ type: "module" }))
  await mkdir(path.join(tmp, "dist"), { recursive: true })
  await copyFile(BUILT, path.join(tmp, "dist", "tui.js"))
  const pkg = path.join(tmp, "node_modules", "@opencode", "plugin")
  await mkdir(path.join(pkg, "tui"), { recursive: true })
  await writeFile(
    path.join(pkg, "package.json"),
    JSON.stringify({ name: "@opencode/plugin", version: "0.0.0", type: "module", exports: { "./tui": "./tui/index.js" } }),
  )
  await writeFile(path.join(pkg, "tui", "index.js"), "export const Plugin = { define: (p) => p };\n")
  return tmp
}

async function main() {
  assert.ok(existsSync(BUILT), `dist/tui.js missing — run \`npm run build\` first`)

  const tmp = await stage()
  try {
    const mod = await import(pathToFileURL(path.join(tmp, "dist", "tui.js")).href)
    const plugin = mod.default
    assert.ok(plugin && typeof plugin.setup === "function", "default export is not a plugin definition")
    check("plugin id", plugin.id === PLUGIN_ID)

    let routeType = "session"
    let now = 1_700_000_000_000
    const realNow = Date.now
    Date.now = () => now

    const listeners = new Set()
    const dispatched = []
    const layers = []
    const keyInput = {
      on(event, fn) {
        if (event === "keypress") listeners.add(fn)
      },
      off(event, fn) {
        if (event === "keypress") listeners.delete(fn)
      },
    }
    const context = {
      renderer: { keyInput },
      ui: { router: { current: () => ({ type: routeType }) } },
      keymap: {
        dispatch(id) {
          dispatched.push(id)
        },
        layer(factory) {
          layers.push(factory())
        },
      },
    }

    const cleanup = await plugin.setup(context)

    const press = (name = "escape") => {
      for (const fn of [...listeners]) fn({ name })
    }
    const jump = () => {
      now += 100_000_000 // far past any window: the next press is a fresh "first"
    }
    const reset = () => {
      dispatched.length = 0
    }
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

    check("one keymap layer registered", layers.length === 1)

    reset()
    jump()
    press()
    check("single press is inert", eq(dispatched, []))

    reset()
    jump()
    press()
    now += 500
    press()
    check("double press within window dispatches the timeline once", eq(dispatched, [TIMELINE_COMMAND]))

    reset()
    jump()
    press()
    now += 800
    press()
    const at800 = eq(dispatched, [TIMELINE_COMMAND]) // 800ms is INCLUSIVE
    reset()
    jump()
    press()
    now += 801
    press()
    const at801 = eq(dispatched, [])
    check("window boundary is inclusive at 800, exclusive at 801", at800 && at801)

    reset()
    jump()
    press()
    now += 500
    press()
    now += 100
    press() // must start a FRESH pair, not re-trigger
    check("pair resets after firing", eq(dispatched, [TIMELINE_COMMAND]))

    routeType = "home"
    reset()
    jump()
    press()
    now += 500
    press()
    check("gated to the session route", eq(dispatched, []))
    routeType = "session"

    reset()
    jump()
    press("return")
    now += 10
    press("return")
    check("only Escape counts", eq(dispatched, []))

    cleanup()
    check("cleanup detaches the listener", listeners.size === 0)

    Date.now = realNow

    // Pin the host command ASSIGNMENT (not the word): the same quoted literal
    // appears in src/tui.ts's comments, so a bare `includes` would stay green
    // after the constant is renamed — passing for the very change it guards.
    const source = await readFile(SOURCE, "utf8")
    check(
      "TIMELINE_COMMAND assignment pins the host command id",
      new RegExp(`^const TIMELINE_COMMAND = "${TIMELINE_COMMAND.replace(/\./g, "\\.")}"$`, "m").test(source),
    )
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }

  const failed = checks.filter(([, ok]) => !ok)
  for (const [name, ok] of checks) console.log(`${ok ? "ok  " : "FAIL"} ${name}`)
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
  if (failed.length) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
