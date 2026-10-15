import { readFileSync } from "node:fs";

const tokens = JSON.parse(
  readFileSync(new URL("./tokens.json", import.meta.url), "utf8"),
);

export default {
  plugins: [
    {
      postcssPlugin: "fixture-colors",
      Once(root, { result }) {
        result.messages.push({
          type: "dependency",
          plugin: "fixture-colors",
          file: new URL("./tokens.json", import.meta.url).pathname,
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
