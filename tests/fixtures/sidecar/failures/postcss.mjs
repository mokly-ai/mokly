export default {
  plugins: [
    {
      postcssPlugin: "throwing",
      Once() {
        throw new Error("fixture plugin failed");
      },
    },
  ],
};
