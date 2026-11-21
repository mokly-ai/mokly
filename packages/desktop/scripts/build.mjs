import { spawnSync } from "node:child_process";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const repository = resolve(root, "../..");
const environment = {
  ...process.env,
  EXPO_PUBLIC_MKC_API_ORIGIN:
    process.env.EXPO_PUBLIC_MKC_API_ORIGIN ??
    `http://localhost:${process.env.MKC_API_PORT ?? "8080"}`,
  EXPO_PUBLIC_MKC_APP_ORIGIN:
    process.env.EXPO_PUBLIC_MKC_APP_ORIGIN ??
    `http://localhost:${process.env.MKC_APP_PORT ?? "8081"}`,
  MKC_CATALOGUE_BASE_DOMAIN:
    process.env.MKC_CATALOGUE_BASE_DOMAIN ?? "catalogue.mokly.example",
};
function run(program, args, cwd = root, capture = false) {
  const result = spawnSync(program, args, {
    cwd,
    env: environment,
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout;
}
environment.MKC_BUILD_SHA ??= run(
  "git",
  ["rev-parse", "HEAD"],
  repository,
  true,
).trim();
// Use the image's writer so its validation and metadata shape have one owner.
const config = run(
  process.execPath,
  ["infra/docker/app-build-config.mjs"],
  repository,
  true,
);
// Only the release job turns the updater on; preview and local builds keep it off.
const desktopConfig = {
  ...JSON.parse(config),
  updates: process.env.MKC_DESKTOP_UPDATES === "enabled",
};
await mkdir(resolve(root, "bundle"), { recursive: true });
await writeFile(
  resolve(root, "bundle/build-config.json"),
  `${JSON.stringify(desktopConfig)}\n`,
);
for (const script of ["build:web", "verify:web"]) {
  run(
    "npm",
    ["run", script, "--workspace", "@mokly-cloud/app"],
    resolve(root, ".."),
  );
}
await rm(resolve(root, "bundle/web"), { recursive: true, force: true });
await cp(resolve(root, "../app/dist"), resolve(root, "bundle/web"), {
  recursive: true,
  force: true,
});
run(resolve(root, "../../node_modules/.bin/tsx"), ["scripts/site-segments.ts"]);
run(resolve(root, "../../node_modules/.bin/tsc"), [
  "--project",
  "tsconfig.build.json",
]);
