{
  description = "opencode plugin: double-tap Escape opens the session timeline (the messages you sent) — Claude Code's double-Esc message history.";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      # A plain directory holding the plugin, ready to be dropped into
      # ~/.config/opencode/plugins/<name>/ — see the homeManagerModules output
      # for the one-line install.
      packages = forAllSystems (pkgs: {
        default = self.packages.${pkgs.stdenv.hostPlatform.system}.opencode-double-esc-timeline;
        opencode-double-esc-timeline = pkgs.runCommandLocal "opencode-double-esc-timeline" { } ''
          mkdir -p $out
          install -m644 ${./src/tui.ts} $out/tui.ts
          install -m644 ${./src/index.ts} $out/index.ts
          install -m644 ${./package.json} $out/package.json
          install -m644 ${./README.md} $out/README.md
        '';
      });

      # `imports = [ inputs.opencode-double-esc-timeline.homeManagerModules.default ];`
      # then `home-manager switch`. Installs the plugin for the current user.
      homeManagerModules.default =
        { pkgs, ... }:
        {
          home.file.".config/opencode/plugins/opencode-double-esc-timeline" = {
            source = self.packages.${pkgs.stdenv.hostPlatform.system}.default;
            recursive = true;
          };
        };
      homeManagerModules.opencode-double-esc-timeline = self.homeManagerModules.default;
    };
}
