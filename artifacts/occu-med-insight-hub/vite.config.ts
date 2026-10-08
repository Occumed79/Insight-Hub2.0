import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";

const isDev = process.env.NODE_ENV !== "production";

// PORT is only needed for the dev server; not required during a static build
const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 3000;

// BASE_PATH defaults to "/" for standard deployments (Render, Netlify, etc.)
const basePath = process.env.BASE_PATH ?? "/";

function splitVendorChunk(id: string): string | undefined {
  if (!id.includes("node_modules")) return undefined;
  if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react-vendor";
  if (id.includes("node_modules/@tanstack/")) return "query-vendor";
  if (id.includes("node_modules/@radix-ui/")) return "radix-vendor";
  if (id.includes("node_modules/framer-motion/")) return "motion-vendor";
  if (id.includes("node_modules/lucide-react/")) return "icons-vendor";
  if (id.includes("node_modules/wouter/")) return "router-vendor";
  if (/node_modules\/cesium\//.test(id)) return "cesium-vendor";
  return undefined;
}

export default defineConfig({
  base: basePath,
  // CesiumJS loads workers, assets and widget CSS at runtime from CESIUM_BASE_URL.
  define: {
    CESIUM_BASE_URL: JSON.stringify(`${basePath.endsWith("/") ? basePath : `${basePath}/`}cesium`),
  },
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: ["Workers", "ThirdParty", "Assets", "Widgets"].map((directory) => ({
        src: `node_modules/cesium/Build/Cesium/${directory}`,
        dest: "cesium",
      })),
    }),
    // Replit-specific plugins — dev only
    ...(isDev
      ? [
          await import("@replit/vite-plugin-runtime-error-modal").then((m) =>
            m.default(),
          ),
          ...(process.env.REPL_ID !== undefined
            ? [
                await import("@replit/vite-plugin-cartographer").then((m) =>
                  m.cartographer({
                    root: path.resolve(import.meta.dirname, ".."),
                  }),
                ),
                await import("@replit/vite-plugin-dev-banner").then((m) =>
                  m.devBanner(),
                ),
              ]
            : []),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: splitVendorChunk,
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
