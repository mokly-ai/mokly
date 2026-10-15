import fs from "node:fs";
import { createInterface } from "node:readline";

const { version } = JSON.parse(
  fs.readFileSync(
    new URL("../../../packages/mokly/package.json", import.meta.url),
    "utf8",
  ),
);
createInterface({ input: process.stdin }).on("line", (line) => {
  const request = JSON.parse(line);
  if (request.method === "hello")
    process.stdout.write(
      JSON.stringify({ id: request.id, result: { version } }) + "\n",
    );
  else process.exit(42);
});
