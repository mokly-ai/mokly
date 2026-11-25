export const fixtures = Object.defineProperty([], "0", {
  get() {
    throw new Error("fixture entry export failed");
  },
});
