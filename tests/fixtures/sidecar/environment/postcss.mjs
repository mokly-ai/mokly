const absent = "__mokly_env_absent__";

export default {
  plugins: [
    {
      postcssPlugin: "environment-fixture",
      Once(root) {
        root.append({
          selector: ".environment",
          nodes: [
            { prop: "token", value: process.env.MOKLY_TOKEN ?? absent },
            { prop: "endpoint", value: process.env.MOKLY_ENDPOINT ?? absent },
            { prop: "phases", value: process.env.MOKLY_POSTCSS_PHASES ?? absent },
            {
              prop: "fixture",
              value: process.env.FIXTURE_ENVIRONMENT_VALUE ?? absent,
            },
          ],
        });
      },
    },
  ],
};
