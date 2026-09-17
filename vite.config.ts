import vinext from "vinext";
import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export default defineConfig(async ({ mode }) => {
  const isVercelBuild = mode === "vercel" || Boolean(process.env.VERCEL);
  // Vinext tidak selalu menginjeksi NEXT_PUBLIC_* seperti Next.js native.
  // Muat eksplisit hanya konfigurasi public yang memang dibutuhkan browser.
  const publicEnv = loadEnv(mode, process.cwd(), "NEXT_PUBLIC_");
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || publicEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  const appsScriptUrl = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || publicEnv.NEXT_PUBLIC_APPS_SCRIPT_URL || "";
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Vercel memakai output Nitro; preview Sites/Cloudflare tetap memakai plugin lama.
  const deploymentPlugins = isVercelBuild
    ? (await import("nitro/vite")).nitro({ preset: "vercel" })
    : [(await import("./build/sites-vite-plugin")).sites()];

  return {
    resolve: isVercelBuild ? {
      // Nitro membangun beberapa Vite environment; alias absolut menjaga import CSS paket tetap konsisten.
      alias: {
        tailwindcss: resolve(process.cwd(), "node_modules/tailwindcss/index.css"),
        "tw-animate-css": resolve(process.cwd(), "node_modules/tw-animate-css/dist/tw-animate.css"),
      },
    } : undefined,
    define: {
      "process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID": JSON.stringify(googleClientId),
      "process.env.NEXT_PUBLIC_APPS_SCRIPT_URL": JSON.stringify(appsScriptUrl),
    },
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      ...deploymentPlugins,
    ],
  };
});
