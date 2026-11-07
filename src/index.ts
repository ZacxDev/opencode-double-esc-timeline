// opencode-double-esc-timeline — SERVER half. It does NOTHING, and that is the
// whole point: it exists ONLY so opencode's server plugin loader finds an
// entrypoint for this directory.
//
// 🔴 A DIRECTORY UNDER `plugins/` IS A TARGET FOR *BOTH* LOADERS.
//   * TUI loader — packages/tui/src/plugin/discovery.ts scans <config>/plugins/*
//     (directories or symlinks) and resolves the `tui` entrypoint via
//     Host.resolve (packages/plugin/src/host.ts), i.e. `<dir>/tui` -> tui.ts.
//     That is what we want loaded.
//   * SERVER loader — packages/core/src/plugin/source-directory.ts returns EVERY
//     DIRECTORY under `plugin/` OR `plugins/`
//     (`if (entry.type === "directory") return Option.some(entry.target)`), and
//     packages/core/src/plugin/module.ts raises
//       `Plugin entrypoint not found: <dir>`
//     when `Host.resolve(dir).server` is empty — and `server` resolves
//     `<dir>/server` then `<dir>` (dir/index). So a TUI-only directory with NO
//     index.ts ships a plugin-load error on every start.
//
// Delete this file and the plugin still "works" while opencode reports a broken
// plugin forever. Do not delete it.
//
// The `{ id, setup(ctx) }` default-export shape is the one opencode's own
// bundled server plugins use on v2.0.32; a no-op registration needs nothing more.

export default {
  id: "opencode.double-esc-timeline",
  async setup() {},
}
