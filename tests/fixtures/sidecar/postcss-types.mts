import type { Root } from "postcss";

import helper from "./postcss-helper.cjs";

let factories = 0;
let calls = 0;
function plugin() {
  factories += 1;
  if (factories !== 1) throw new Error("plugin factory ran more than once");
  return {
    postcssPlugin: "factory-once",
    Once(root: Root) {
      calls += 1;
      root.append({
        selector: ".factory",
        nodes: [
          { prop: "order", value: String(calls) },
          { prop: "--module", value: JSON.stringify(import.meta.filename) },
          { prop: "--helper", value: JSON.stringify(helper.file) },
        ],
      });
    },
  };
}
plugin.postcss = true;
export default { plugins: [plugin], map: true };
