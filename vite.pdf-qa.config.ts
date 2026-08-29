import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    outDir: "qa-pdf-dist",
    emptyOutDir: true,
    lib: {
      entry: resolve(import.meta.dirname, "src/planningPdf.ts"),
      formats: ["es"],
      fileName: "planning-pdf-qa",
    },
  },
});
