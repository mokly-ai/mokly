import test from "node:test";

test("reporter diagnostic fixture", () => {
  console.error("verification reporter stderr sentinel");
  throw new Error("verification reporter diagnostic sentinel");
});
