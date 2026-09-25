import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
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

export default defineConfig(({ mode }) => {
  const loadedEnv = loadEnv(mode, root, "VITE_");
  const envDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(loadedEnv)) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  const plugins = [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: false,
      routesDirectory: "./resources/js/routes",
      generatedRouteTree: "./resources/js/routeTree.gen.ts",
    }),
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    viteReact(),
  ];

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
      alias: { "@": path.join(root, "resources/js") },
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
          "./resources/js/routes/__root.tsx",
          "./resources/js/routes/login.tsx",
          "./resources/js/components/auth/UnifiedLoginPage.tsx",
          "./resources/js/styles.css",
        ],
      },
      watch: {
        ignored: ["**/.git/**", "**/.cursor/**", "**/backend/**", "**/vendor/**", "**/storage/**"],
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
    base: '/',
    build: {
      // Keep previous hashed files so a running preview does not 404 after rebuild.
      emptyOutDir: true,
      outDir: "dist",
      assetsDir: "assets",
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
