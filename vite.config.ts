import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const copyStaticData = () => ({
  name: "copy-static-data",
  async closeBundle() {
    await mkdir(resolve("dist/data"), { recursive: true });
    await cp(resolve("data/app-data.json"), resolve("dist/data/app-data.json"));
  },
});

export default defineConfig({
  plugins: [react(), copyStaticData()],
  server: { host: "0.0.0.0" },
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/recharts") || id.includes("node_modules/d3-")) return "charts";
          if (id.includes("node_modules/react") || id.includes("node_modules/scheduler")) return "react";
        },
      },
    },
  },
});
