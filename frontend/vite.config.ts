import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig, loadEnv } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";

const root = path.dirname(fileURLToPath(import.meta.url));

const allowedHosts = [
  "on-prem.x-dcb.net",
  "localhost",
  "127.0.0.1",
  "10.138.21.235",
  "202.90.136.222",
];

const proxy = {
  "/api": { target: "http://127.0.0.1:4000", changeOrigin: true },
  "/uploads": { target: "http://127.0.0.1:4000", changeOrigin: true },
  "/socket.io": { target: "http://127.0.0.1:4001", ws: true, changeOrigin: true },
};

export default defineConfig(({ command, mode }) => {
  const loadedEnv = loadEnv(mode, root, "VITE_");
  const envDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(loadedEnv)) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  const plugins = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    ...tanstackStart({
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
      server: { entry: "server" },
    }),
    viteReact(),
  ];

  // Cloudflare adapter is only for a Workers deploy — skip it on-prem so
  // `vite build` + `vite preview` produce a fast local bundle.
  if (command === "build" && process.env.NMP_CLOUDFLARE === "1") {
    plugins.push(
      cloudflare({
        viteEnvironment: { name: "ssr" },
      }),
    );
  }

  return {
    define: envDefine,
    optimizeDeps: {
      // Pre-bundle so first load is a few chunks, not hundreds of raw modules.
      holdUntilCrawlEnd: false,
      include: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
        "@tanstack/react-router",
        "socket.io-client",
        "sonner",
        "lucide-react",
        "clsx",
        "tailwind-merge",
        "class-variance-authority",
        "date-fns",
        "zod",
        "react-hook-form",
      ],
    },
    resolve: {
      alias: { "@": path.join(root, "src") },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      // Never live-reload or Fast Refresh — in-progress form fills must survive.
      hmr: false,
      warmup: {
        clientFiles: [
          "./src/routes/__root.tsx",
          "./src/routes/login.tsx",
          "./src/components/auth/UnifiedLoginPage.tsx",
          "./src/styles.css",
        ],
      },
      watch: {
        ignored: ["**/.git/**", "**/.cursor/**", "**/laravel/**", "**/backend/**"],
      },
      allowedHosts,
      proxy,
    },
    preview: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      allowedHosts,
      proxy,
    },
    build: {
      // Keep previous hashed files so a running preview does not 404 after rebuild.
      emptyOutDir: false,
    },
    plugins: [
      ...plugins,
      {
        name: "nmp-html-no-store",
        configurePreviewServer(server) {
          server.middlewares.use((req, res, next) => {
            const pathname = req.url?.split("?")[0] ?? "";
            if (!/\.(js|css|png|jpe?g|webp|svg|gif|woff2?|mjs|map|ico)$/i.test(pathname)) {
              res.setHeader("Cache-Control", "no-store");
            }
            next();
          });
        },
      },
      {
        name: "nmp-no-auto-refresh",
        apply: "serve",
        handleHotUpdate() {
          // Never push HMR updates — filling a form must not lose in-progress work.
          return [];
        },
        configureServer(server) {
          const send = server.ws.send.bind(server.ws);
          server.ws.send = ((payload: unknown, ...rest: unknown[]) => {
            if (
              payload &&
              typeof payload === "object" &&
              "type" in payload &&
              (payload.type === "full-reload" ||
                payload.type === "update" ||
                payload.type === "prune")
            ) {
              return;
            }
            return send(payload as never, ...(rest as never[]));
          }) as typeof server.ws.send;
        },
      },
    ],
  };
});
