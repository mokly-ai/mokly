let calls = 0;
export default {
  plugins: [
    {
      postcssPlugin: "fixture",
      Once(root, { result }) {
        calls += 1;
        root.append({
          selector: ".calls",
          nodes: [{ prop: "order", value: String(calls) }],
        });
        result.messages.push({
          type: "dependency",
          plugin: "fixture",
          file: "./content.txt",
        });
        result.messages.push({
          type: "dir-dependency",
          plugin: "fixture",
          dir: "./content",
          glob: "**/*.html",
        });
      },
    },
  ],
};
