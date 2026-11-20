import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The Folio stylesheets have one source of truth, `docs/mockups/styles`, which
 * the generated catalogue links directly. The application serves the same files
 * from its public directory, so this copies them before every start, build and
 * test run instead of keeping a second copy under version control.
 *
 * The public `@mokly/viewer/styles.css` export and every relative asset it
 * declares are copied into `public/mokly-viewer` the same way, because Expo's
 * static exporter does not relocate the export's packaged font.
 */
const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, "../../../docs/mockups/styles");
const destination = resolve(here, "../public/folio");
const viewerStyles = fileURLToPath(
  import.meta.resolve("@mokly/viewer/styles.css"),
);
const viewerSource = dirname(viewerStyles);
const viewerDestination = resolve(here, "../public/mokly-viewer");

await rm(destination, { force: true, recursive: true });
await cp(source, destination, { recursive: true });
await rm(viewerDestination, { force: true, recursive: true });
await mkdir(viewerDestination, { recursive: true });
await cp(viewerStyles, resolve(viewerDestination, "styles.css"));
const css = await readFile(viewerStyles, "utf8");
for (const match of css.matchAll(/url\(["']?(\.\/[^)"']+)/g)) {
  const relative = match[1];
  const assetSource = resolve(viewerSource, relative);
  if (!assetSource.startsWith(viewerSource + sep)) {
    throw new Error(`viewer stylesheet asset escapes its package: ${relative}`);
  }
  const assetDestination = resolve(viewerDestination, relative);
  await mkdir(dirname(assetDestination), { recursive: true });
  await cp(assetSource, assetDestination);
}
process.stdout.write(`folio styles synced from ${source}\n`);
process.stdout.write(`viewer styles synced from ${viewerStyles}\n`);
