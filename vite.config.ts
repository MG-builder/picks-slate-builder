import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so the build works at any path (e.g. GitHub Pages at /picks-slate-builder/).
  base: "./",
  server: { port: 5180 },
});
