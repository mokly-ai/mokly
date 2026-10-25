import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { build, git, write } from "./helpers/static_changes.js";
import { files } from "./helpers/static_faults.js";
import { command, publicationFixture } from "./helpers/static_publication.js";

test(
  "a source mutation during a Changes-enabled render preserves the installed comparison",
  { timeout: 120_000 },
  async () => {
    const root = await publicationFixture(true);
    try {
      await write(
        root,
        "mokly.config.json",
        '{"review":{"base":"fixture-base"}}',
      );
      const source = (mutation: string) =>
        `import fs from 'node:fs'; import React from 'react'; import {defineScreen} from '@mokly/mokly'; export default defineScreen({title:'Home',description:'',relatedDocs:[],props:{},render(){${mutation}return React.createElement('p',null,'Home');}});`;
      await write(root, "specs/home.mockup.ts", source(""));
      await git(root, "add", "-A");
      await git(root, "commit", "-qm", "base screen");
      await git(root, "branch", "fixture-base");
      const previous = await build(root);
      const snapshot = await files(previous.output);
      await write(
        root,
        "specs/home.mockup.ts",
        source("fs.appendFileSync('specs/home.mockup.ts','\\n// mutated');"),
      );
      const result = await command(root, "build", ["--out=.context/site"])
        .result;
      assert.equal(result.code, 1, result.stderr);
      assert.match(
        result.stderr,
        /\[mokly\/export-invalid\] Inputs changed during the build:/u,
      );
      assert.deepEqual(await files(previous.output), snapshot);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
