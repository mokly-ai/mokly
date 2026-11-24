import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  resolve: {
    alias: {
      "@fixture/message": path.resolve(import.meta.dirname, "src/message.js"),
    },
  },
  plugins: [react(), svgr()],
});
