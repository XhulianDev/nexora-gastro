{ pkgs, ... }: {
  channel = "stable-24.05";

  packages = [
    pkgs.python3
  ];

  env = {};
  idx = {
    extensions = [];

    previews = {
      enable = true;
      previews = {
        web = {
          command = ["python3" "-m" "http.server" "$PORT" "--bind" "0.0.0.0"];
          manager = "web";
          env = {
            PORT = "$PORT";
          };
        };
      };
    };

    workspace = {
      onCreate = {};
      onStart = {};
    };
  };
}
