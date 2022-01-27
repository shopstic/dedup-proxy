{ lib
, stdenv
, dumb-init
, kubectl
, writeTextFile
, buildahBuild
, dockerTools
, dedupProxy
}:
let
  name = "dedup-proxy";
  baseImage = buildahBuild
    {
      name = "${name}-base";
      context = ./context;
      buildArgs = {
        fromDigest = "sha256:626ffe58f6e7566e00254b638eb7e0f3b11d4da9675088f4781a50ae288f3322";
      };
      outputHash =
        if stdenv.isx86_64 then
          "sha256-NbUG+pCHWqhxFvTpxgZmSd1W0R3xDMgG309mQblJl7s=" else
          "sha256-Vnk5mPnOucUMJREytN7/dy9n3hOcL9S1xyKsgEJw6BM=";
    };
  entrypoint = writeTextFile {
    name = "entrypoint";
    executable = true;
    text = ''
      #!/usr/bin/env bash
      set -euo pipefail
      exec dumb-init -- ${dedupProxy}/bin/dedup-proxy start "$@"
    '';
  };    
  baseImageWithDeps = dockerTools.buildImage {
    inherit name;
    fromImage = baseImage;
    config = {
      Env = [
        "PATH=${lib.makeBinPath [ dumb-init ]}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
      ];
    };
  };
in
dockerTools.buildLayeredImage {
  inherit name;
  fromImage = baseImageWithDeps;
  config = {
    Entrypoint = [ entrypoint ];
  };
}

