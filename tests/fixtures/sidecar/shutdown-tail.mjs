import fs from "node:fs";
import { createInterface } from "node:readline";

createInterface({ input: process.stdin }).on("line", (line) => {
  const request = JSON.parse(line);
  if (request.method === "hello") {
    process.stdout.write(
      JSON.stringify({ id: request.id, result: { version: "drain-fixture" } }) +
        "\n",
    );
  } else if (request.method === "shutdown") {
    fs.writeSync(2, "after shutdown\n" + "A".repeat(65_535) + "é-tail");
    process.exit(0);
  }
});
