import fs from "node:fs";
import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig, normalizePath } from "vite";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "plugin-input",
      async transform(code, id) {
        if (!id.endsWith("/t.mockup.tsx")) return;
        const file = path.join(import.meta.dirname, "specs/h.ts");
        await this.load({ id: normalizePath(file) });
        return code.replace(
          '"__PLUGIN__"',
          JSON.stringify(fs.readFileSync(file, "utf8")),
        );
      },
    },
  ],
});
