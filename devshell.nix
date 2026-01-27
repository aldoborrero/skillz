{
  pkgs,
  perSystem,
}:
pkgs.mkShellNoCC {
  packages = [ ];
  shellHook = ''
    export PRJ_ROOT=$PWD
  '';
}
