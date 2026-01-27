{ pkgs, inputs, ... }:
inputs.treefmt-nix.lib.mkWrapper pkgs {
  projectRootFile = "flake.nix";
  programs = {
    deadnix.enable = true;
    nixfmt.enable = true;
    shfmt.enable = true;
    statix.enable = true;
    yamlfmt.enable = true;
    yamlfmt.settings = {
      formatter = {
        type = "basic";
        indent = 2;
        retain_line_breaks = true;
      };
    };
  };
  settings.formatter = {
    deadnix.priority = 1;
    nixfmt.priority = 3;
    statix.priority = 2;
  };
}
