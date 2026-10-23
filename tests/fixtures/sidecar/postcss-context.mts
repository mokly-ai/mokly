import type { Root } from "postcss";

import helper from "./postcss-local/helper.cjs";

await Promise.resolve();
export default {
  plugins: [
    {
      postcssPlugin: "native-context",
      Once(root: Root) {
        root.append({
          selector: ".context",
          nodes: [{ prop: "--child", value: JSON.stringify(helper.file) }],
        });
      },
    },
  ],
};
