// Ambient types for the module opencode injects into every plugin at runtime.
//
// 🔴 WHY THIS FILE EXISTS AND IS NOT A DEPENDENCY. `@opencode/plugin/tui` is
// resolved by the running opencode binary, not by node_modules — opencode
// registers it in its plugin runtime (`additional: { "@opencode/plugin/tui": … }`
// in its own runtime-plugin-support). Installing the real package would drag in
// its peer dependency graph (`@opentui/core`, `@opentui/solid`, `solid-js`) which
// a TUI-only plugin never links against. So the API surface we use is declared
// here instead.
//
// 🔴 THIS IS A HAND-MAINTAINED MIRROR: it is a claim about opencode's API, and
// nothing keeps it in step automatically. It is deliberately minimal — only the
// three things src/tui.ts touches (renderer.keyInput, ui.router, keymap). Widen
// it when the plugin uses more; if a field here is wrong, the failure is a
// runtime error in a live TUI that these types would have hidden.

declare module "@opencode/plugin/tui" {
  export interface TuiKeyEvent {
    readonly name?: string
  }

  export interface TuiKeyInput {
    on?(event: "keypress", listener: (event: TuiKeyEvent) => void): void
    off?(event: "keypress", listener: (event: TuiKeyEvent) => void): void
    removeListener?(event: "keypress", listener: (event: TuiKeyEvent) => void): void
  }

  export interface TuiContext {
    readonly renderer?: { readonly keyInput?: TuiKeyInput }
    readonly ui: {
      readonly router: { current(): { readonly type: string } }
    }
    readonly keymap: {
      dispatch(id: string, input?: string): void
      layer(factory: () => unknown): void
    }
  }

  export interface TuiPluginDefinition {
    readonly id: string
    readonly setup: (context: TuiContext) => void | (() => void) | Promise<void | (() => void)>
  }

  export const Plugin: {
    define(plugin: TuiPluginDefinition): unknown
  }
}
