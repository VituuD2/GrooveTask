{pkgs}: {
  channel = "stable-24.05";
  packages = [
    pkgs.nodejs_20
  ];

  env = {
    UPSTASH_REDIS_REST_URL="https://oriented-escargot-7784.upstash.io";
    UPSTASH_REDIS_REST_TOKEN="AR5oAAImcDFiZGQ3YjIwZDg3ODI0OTdiOGIyYTBhY2FhZTQ5YjRlM3AxNzc4NA";
    JWT_SECRET="segredo-super-secreto-do-groove-123";
  };

  idx.extensions = [
    "svelte.svelte-vscode"
    "vue.volar"
  ];
  idx.previews = {
    previews = {
      web = {
        command = [
          "npm"
          "run"
          "dev"
          "--"
          "--port"
          "$PORT"
          "--host"
          "0.0.0.0"
        ];
        manager = "web";
      };
    };
  };
}