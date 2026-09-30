import { benchmark } from "../../scripts/large/benchmark.mjs";
import { selectScenarios } from "../../scripts/large/scenarios.mjs";

try {
  await benchmark(
    process.argv[2],
    JSON.parse(process.argv[3]),
    selectScenarios(["component-style", "screen-markup"]),
  );
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
