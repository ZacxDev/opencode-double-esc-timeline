// opencode-double-esc-timeline — TUI half.
//
// Double-tap Escape in an opencode session opens the session timeline: the
// searchable list of the prompts YOU sent, with select -> Revert / Copy. This
// is Claude Code's double-Escape message-history surface, ported to opencode
// as a plugin (no fork, no patched binary).
//
// See README.md for the full story. The short version of the design:
//
// 🔴 THE FEATURE ALREADY EXISTS; ONLY THE GESTURE WAS MISSING.
// opencode V2 ships `session.timeline` — a dialog that lists the session's USER
// messages (`if (message.type !== "user") continue`) and opens a Revert/Copy
// menu on select — reachable via `/timeline` or `<leader>g` (ctrl+x g). What it
// has no binding for is Claude Code's double-Escape. Upstream issue #14037 asked
// for exactly that and was closed by automation as `completed` without a
// matching binding ever shipping (verified absent in v2.0.32: no timed two-press
// handling anywhere in packages/tui/src or packages/app/src). A keybind cannot
// express it either: `escape` is a single bound key, and a keymap SEQUENCE would
// swallow the first press, breaking `session.interrupt`.
//
// 🔴 THE HOOK IS THE RAW RENDERER KEY STREAM — NOT A KEYMAP LAYER.
// `context.renderer.keyInput` is an emitter that opencode's own keymap ALSO
// subscribes to; LISTENING DOES NOT CONSUME THE EVENT. So this plugin is
// strictly ADDITIVE: every built-in Escape behaviour (interrupt a running turn,
// close a dialog, clear a pending key sequence) is untouched, and we only ever
// ADD the timeline on a second press inside the window.
//
// 🔴 SINGLE ESCAPE IS PRESERVED BY CONSTRUCTION: we act ONLY on the second
// press. Consequence to accept: two quick Escapes to interrupt a RUNNING turn
// also open the timeline; closing it is one more Escape.
//
// Not implemented, on purpose: "don't trigger while a dialog is open". The
// plugin Context exposes no dialog-open query, and `dispatch` already no-ops
// when the command is unreachable — which a modal dialog's keymap mode makes it.

import { Plugin } from "@opencode/plugin/tui"

// The double-tap window, in milliseconds. Long enough to feel like a double tap,
// short enough not to fire on two deliberate, separate interrupts.
const DOUBLE_TAP_WINDOW_MS = 800

// 🔴 THE CONTRACT WITH OPENCODE. This is the host command id the session route
// registers (packages/tui/src/routes/session/index.tsx: `id: "session.timeline"`).
// If upstream renames it the gesture silently stops working — `dispatch` no-ops
// on an unknown id, so it will NOT throw. test/run.mjs pins the literal so the
// rename is a red test rather than a dead keybinding.
const TIMELINE_COMMAND = "session.timeline"

// Command id for the palette entry. Plugin-prefixed so it cannot collide with a
// host command.
const OPEN_COMMAND_ID = "opencode.double-esc-timeline.open"

type KeyListener = (event: { readonly name?: string } | undefined) => void

// The slice of OpenTUI's KeyInput we use. It is an EventEmitter in the version
// opencode bundles (its own tests use `renderer.keyInput.on("keypress", …)`),
// so `off` is the expected unsubscribe; `removeListener` is the EventEmitter
// spelling we fall back to so a hot reload cannot leak the listener if `off` is
// ever absent.
type KeyEmitter = {
  readonly on?: (event: "keypress", listener: KeyListener) => void
  readonly off?: (event: "keypress", listener: KeyListener) => void
  readonly removeListener?: (event: "keypress", listener: KeyListener) => void
}

export default Plugin.define({
  id: "opencode.double-esc-timeline",
  setup(context) {
    let lastEscape = 0
    let disposed = false

    const onKeypress: KeyListener = (event) => {
      if (disposed || event?.name !== "escape") return
      const now = Date.now()
      if (now - lastEscape <= DOUBLE_TAP_WINDOW_MS) {
        // Reset so a third press starts a fresh pair rather than re-triggering.
        lastEscape = 0
        if (context.ui.router.current().type === "session") context.keymap.dispatch(TIMELINE_COMMAND)
        return
      }
      lastEscape = now
    }

    const keyInput = context.renderer?.keyInput as KeyEmitter | undefined
    keyInput?.on?.("keypress", onKeypress)

    // A palette entry (Ctrl+P -> "Open message timeline") for the SAME action:
    // discoverability for people who do not know the gesture, and the manual
    // lever that separates "the gesture is not firing" from "`dispatch` is wrong"
    // when something breaks.
    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: OPEN_COMMAND_ID,
          title: "Open message timeline",
          description: "List the messages you sent in this session (same as double-Escape)",
          group: "Session",
          palette: true,
          run: () => {
            context.keymap.dispatch(TIMELINE_COMMAND)
          },
        },
      ],
    }))

    return () => {
      disposed = true
      if (keyInput?.off) keyInput.off("keypress", onKeypress)
      else keyInput?.removeListener?.("keypress", onKeypress)
    }
  },
})
