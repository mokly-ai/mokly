import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

import { scratchDirectory } from "../../../../_tests_/scratch.mjs";
import { fixture } from "../publish";
import { repositoryRoot } from "../root";

function screen(title: string, heading: string) {
  return `import { defineScreen } from "@mokly/mokly";
export default defineScreen({
  title: ${JSON.stringify(title)}, description: "Review this form.", relatedDocs: [],
  render: () => <main><h1>${heading}</h1></main>,
});\n`;
}

const config = {
  repoRoot: ".",
  roots: [{ dir: "catalogue/src", files: ["**/*.mockup.tsx"] }],
  moduleResolution: { packageRoots: ["."] },
  review: { base: "main" },
};

/**
 * Export retained evidence, optionally placing screens before the selected
 * path: a branch that changes one screen and removes another, built with its
 * comparison against `main` by `build --out`, as `mokly publish` builds it.
 * The envelope is the frozen contract's, with the base the index names, and
 * the marker declares it beside the build's own inventory.
 */
export function retainedFixture(earlierScreens = 0): {
  path: string;
  dispose: () => void;
} {
  const context = join(repositoryRoot, ".context");
  const root = scratchDirectory(join(context, "retained-viewer-"));
  // The CLI's caches live outside the fixture repository, which may not hold
  // them, and go with it.
  const cache = root + "-cache";
  const dispose = () => {
    rmSync(root, { recursive: true, force: true });
    rmSync(cache, { recursive: true, force: true });
  };
  const write = (path: string, value: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), value);
  };
  const run = (command: string, args: string[]) =>
    execFileSync(command, args, {
      cwd: root,
      encoding: "utf8",
      timeout: 600_000,
      maxBuffer: 16 * 1024 * 1024,
      env: {
        ...process.env,
        TMPDIR: join(cache, "tmp"),
        XDG_CACHE_HOME: cache,
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_AUTHOR_NAME: "Viewer fixture",
        GIT_AUTHOR_EMAIL: "fixture@example.invalid",
        GIT_COMMITTER_NAME: "Viewer fixture",
        GIT_COMMITTER_EMAIL: "fixture@example.invalid",
      },
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  const cli = join(repositoryRoot, "node_modules/.bin/mokly");
  try {
    mkdirSync(join(cache, "tmp"), { recursive: true });
    write(
      ".gitignore",
      "node_modules/\n.context/\n.mokly-export-reservations/\n",
    );
    write("package.json", '{"private":true,"type":"module"}\n');
    symlinkSync(
      join(repositoryRoot, "node_modules"),
      join(root, "node_modules"),
      "dir",
    );
    write("mokly.config.json", JSON.stringify(config, null, 2) + "\n");
    const current = "catalogue/src/product/Start_here-2/index.mockup.tsx";
    const retired = "catalogue/src/product/retired/index.mockup.tsx";
    for (let index = 0; index < earlierScreens; index += 1) {
      const number = String(index).padStart(3, "0");
      write(
        `catalogue/src/earlier/screen-${number}/index.mockup.tsx`,
        screen(`Earlier screen ${number}`, `Earlier form ${number}`),
      );
    }
    write(current, screen("Current form", "Draft form"));
    write(retired, screen("Retired form", "Retired form"));
    run("git", ["init", "--initial-branch=main"]);
    run("git", ["add", "-A"]);
    run("git", [
      "-c",
      "commit.gpgsign=false",
      "commit",
      "-m",
      "test: viewer baseline",
    ]);
    run("git", ["checkout", "-b", "topic"]);
    write(current, screen("Current form", "Published form"));
    rmSync(join(root, retired));
    run("git", ["add", "-A"]);
    run("git", [
      "-c",
      "commit.gpgsign=false",
      "commit",
      "-m",
      "test: viewer comparison",
    ]);
    run(cli, ["build", "--strict", "--out", ".context/export"]);
    const exported = join(root, ".context/export");
    run("python3", [
      "-c",
      `import hashlib,json,pathlib,sys,tarfile
export,source=sys.argv[1:3]
root=pathlib.Path(export)
with tarfile.open(source,mode="r:gz") as a: envelope=json.load(a.extractfile("mokly-upload.json"))
index=json.loads((root/"mokly-viewer/index.json").read_text())
envelope.update(baseRef=index["base"],baseSha=index["baseCommit"])
upload=json.dumps(envelope).encode()
(root/"mokly-upload.json").write_bytes(upload)
marker=json.loads((root/".mokly-export-artifact").read_text())
marker["files"].append({"path":"mokly-upload.json","sha256":hashlib.sha256(upload).hexdigest(),"size":len(upload)})
marker["files"].sort(key=lambda f:f["path"])
(root/".mokly-export-artifact").write_text(json.dumps(marker))
with tarfile.open(root/"fixture.tar.gz",mode="w:gz",format=tarfile.USTAR_FORMAT) as a:
    for name in [".mokly-export-artifact"]+[f["path"] for f in marker["files"]]: a.add(root/name,arcname=name)
`,
      exported,
      fixture,
    ]);
    const index: unknown = JSON.parse(
      readFileSync(join(exported, "mokly-viewer/index.json"), "utf8"),
    );
    const changes =
      typeof index === "object" && index !== null
        ? Reflect.get(index, "changesStatus")
        : undefined;
    if (changes !== "ready") {
      throw new Error(`the retained export has ${String(changes)} Changes`);
    }
    return { path: join(exported, "fixture.tar.gz"), dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
