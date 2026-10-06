import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { exportCatalogue } from "../packages/mokly/dist/export/run.js";

import {
  createExportFixture,
  directoryFiles,
} from "./helpers/export_fixture.js";

const publicCases = [
  { label: "carriage return", name: "Icon\r" },
  { label: "DEL", name: `del-${String.fromCodePoint(0x7f)}.txt` },
  { label: "U+0085", name: `nel-${String.fromCodePoint(0x85)}.txt` },
  {
    label: "over 1,024 UTF-8 bytes",
    name: `${"a".repeat(205)}/${"b".repeat(205)}/${"c".repeat(205)}/${"d".repeat(205)}/${"e".repeat(205)}.txt`,
  },
  {
    label: "a multibyte path over 1,024 UTF-8 bytes",
    name: `${Array(6).fill("é".repeat(90)).join("/")}.txt`,
  },
] as const;

for (const { label, name } of publicCases) {
  test(`export identifies a non-portable public path containing ${label}`, async (context) => {
    const fixture = await createExportFixture();
    context.after(() => fixture.close());
    const source = path.join(fixture.mockupsDir, name);
    await fs.mkdir(path.dirname(source), { recursive: true });
    await fs.writeFile(source, "Public bytes\n");
    const exported = `static/${name}`;
    const escaped = JSON.stringify(exported).replace(
      /[\u007f-\u009f]/gu,
      (character) =>
        `\\u${character.codePointAt(0)!.toString(16).padStart(4, "0")}`,
    );
    await assert.rejects(
      exportCatalogue(fixture.config, { outDir: "site", noChanges: true }),
      (error: unknown) => {
        assert.equal((error as { code?: string }).code, "export-invalid");
        assert.match(String(error), new RegExp(escapeRegExp(escaped), "u"));
        assert.match(String(error), /Rename that file or folder/u);
        assert.doesNotMatch(String(error), /\p{Cc}/u);
        return true;
      },
    );
  });
}

test("export identifies a lone surrogate added by an adapter", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const name = "static/lone-\ud800.txt";
  await assert.rejects(
    exportCatalogue(fixture.config, {
      outDir: "site",
      noChanges: true,
      adapter: {
        transform(files) {
          files.set(name, "Adapter bytes\n");
        },
      },
    }),
    (error: unknown) => {
      assert.equal((error as { code?: string }).code, "export-invalid");
      assert.ok(String(error).includes(JSON.stringify(name)));
      assert.equal(String(error).includes("\ud800"), false);
      return true;
    },
  );
});

test("export accepts a public path containing U+200D", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const name = "joiner-a\u200db.txt";
  await fs.writeFile(path.join(fixture.mockupsDir, name), "Joined\n");
  await exportCatalogue(fixture.config, {
    outDir: "site",
    noChanges: true,
  });
  assert.equal(
    (await directoryFiles(fixture.output)).get(`static/${name}`)?.toString(),
    "Joined\n",
  );
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
