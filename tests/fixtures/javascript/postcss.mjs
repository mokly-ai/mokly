import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const tokensFile = fileURLToPath(new URL("./tokens.json", import.meta.url));
const tokens = JSON.parse(readFileSync(tokensFile, "utf8"));

export default {
  plugins: [
    {
      postcssPlugin: "fixture-colors",
      Once(root, { result }) {
        result.messages.push({
          type: "dependency",
          plugin: "fixture-colors",
          file: tokensFile,
        });
      },
      Rule(rule) {
        if (tokens.className && rule.selector === ".chip")
          rule.selector = `.${tokens.className}`;
      },
      Declaration(declaration) {
        if (declaration.value === "MOKLY_COLOR")
          declaration.value = tokens.color;
      },
    },
  ],
};
