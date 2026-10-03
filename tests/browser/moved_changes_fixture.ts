import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { readCatalogue } from "@mokly/viewer";

import { writeCompilation } from "../../dist/build/transaction.js";
import { exportCatalogue } from "../../dist/export/run.js";
import { serve } from "../../dist/server/serve.js";
import { pathFixture } from "../helpers/path_fixture.js";
import { serveStaticFiles } from "../helpers/static_server.js";

/** A served catalogue whose branch moved `billing` under `account`. */
export interface MovedChangesHost {
  url: string;
  close(): Promise<void>;
}

function invoice(due: string, variants: string, moved = ""): string {
  return `import {defineScreen} from '@mokly/mokly';
const shot = (body: string) => <main style={{font: "16px system-ui", padding: 24}}><h1>Invoice INV-1042</h1><p id="due">{body}</p></main>;
export default defineScreen({title:'Invoice',description:'An invoice and its amount due',dependencies:[],relatedDocs:[],${moved}
  mobile: shot(${JSON.stringify(due)}), desktop: shot(${JSON.stringify(due)}),
  variants:[${variants}]});`;
}

const variant = (slug: string, title: string) =>
  `{slug:'${slug}',title:'${title}',description:'${title}',mobile:<main><h1>${title}</h1></main>,desktop:<main><h1>${title}</h1></main>}`;
const OVERDUE = variant("overdue", "Overdue");
const PAID = variant("paid", "Paid");

const RECEIPT = `import {defineScreen} from '@mokly/mokly';
export default defineScreen({title:'Receipt',description:'A receipt for a paid invoice',dependencies:[],relatedDocs:[],mobile:<main><h1>Receipt</h1></main>,desktop:<main><h1>Receipt</h1></main>});`;

const HOME = `import {defineScreen} from '@mokly/mokly';
export default defineScreen({title:'Home',description:'Home',dependencies:[],relatedDocs:[],mobile:<main><h1>Home</h1></main>,desktop:<main><h1>Home</h1></main>});`;

const TERMS = `---
description: When an invoice is due.
---
# Payment terms

Every invoice is due 30 days after it is issued.
`;

async function waitForChanges(url: string): Promise<void> {
  for (let attempt = 0; attempt < 600; attempt++) {
    const model = readCatalogue(
      await (await fetch(`${url}/__mokly/catalogue.json`)).json(),
    );
    if (model.changesStatus === "ready") return;
    await delay(50);
  }
  throw new Error("The fixture did not publish its moved entries");
}

/**
 * Commit a baseline with `billing/invoice` (variants Overdue and Paid),
 * `billing/receipt`, and `billing/payment-terms`, then move the folder under
 * `account`. Invoice declares `movedFrom` and changes its due date, Paid is
 * deleted, and the other entries move unchanged, so pairing never relies on
 * similarity.
 */
async function movedCatalogue() {
  const fixture = await pathFixture(
    {
      "specs/billing/_folder.json": '{"title":"Billing & Payments"}',
      "specs/billing/invoice.mockup.tsx": invoice(
        "Due in 14 days",
        `${OVERDUE},${PAID}`,
      ),
      "specs/billing/receipt.mockup.tsx": RECEIPT,
      "specs/billing/payment-terms.md": TERMS,
      "specs/home.mockup.tsx": HOME,
    },
    '{mockupsDir:"mockups",roots:[{dir:"specs"}],generatedOutput:"committed",colorSchemes:["light"]}',
  );
  try {
    await fs.mkdir(path.join(fixture.root, "mockups"));
    await writeCompilation(await fixture.compile(), await fixture.config());
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: fixture.root, stdio: "pipe" })
        .toString()
        .trim();
    git("init", "-q", "-b", "main");
    git("config", "user.name", "Mokly Test");
    git("config", "user.email", "mokly@example.invalid");
    git("add", "-A");
    git("commit", "-qm", "test: move baseline");
    git("update-ref", "refs/remotes/origin/main", git("rev-parse", "HEAD"));
    await fs.mkdir(path.join(fixture.root, "specs/account"));
    await fs.rename(
      path.join(fixture.root, "specs/billing"),
      path.join(fixture.root, "specs/account/billing"),
    );
    await fixture.write(
      "specs/account/billing/invoice.mockup.tsx",
      invoice("Due on 14 March", OVERDUE, "movedFrom:'billing/invoice',"),
    );
    const config = await fixture.config();
    await writeCompilation(await fixture.compile(), config);
    return { config, fixture };
  } catch (error) {
    await fixture.remove();
    throw error;
  }
}

/** Serve the moved catalogue in development. */
export async function startMovedChanges(): Promise<MovedChangesHost> {
  const { config, fixture } = await movedCatalogue();
  try {
    const running = await serve(config, {
      base: "origin/main",
      port: 0,
      watch: false,
    });
    try {
      await waitForChanges(running.url);
    } catch (error) {
      await running.close();
      throw error;
    }
    return {
      url: running.url,
      close: async () => {
        await running.close();
        await fixture.remove();
      },
    };
  } catch (error) {
    await fixture.remove();
    throw error;
  }
}

/** Export the moved catalogue and serve it as ordinary files. */
export async function exportMovedChanges(): Promise<MovedChangesHost> {
  const { config, fixture } = await movedCatalogue();
  try {
    await exportCatalogue(config, { base: "origin/main", outDir: "site" });
    const server = await serveStaticFiles(path.join(fixture.root, "site"));
    return {
      url: server.url,
      close: async () => {
        await server.close();
        await fixture.remove();
      },
    };
  } catch (error) {
    await fixture.remove();
    throw error;
  }
}
