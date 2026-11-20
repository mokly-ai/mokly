/** Keep the two committed email templates in one Postmark server. */

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const templateDirectory = resolve(root, "crates/mkc-email-templates/templates");
const apiOrigin = "https://api.postmarkapp.com";
const templates = [
  { kind: "sign-in", alias: "mokly-sign-in", name: "Mokly sign-in" },
  { kind: "invitation", alias: "mokly-invitation", name: "Mokly invitation" },
];
const fields = ["Name", "Alias", "Subject", "HtmlBody", "TextBody"];

/** Load the committed six files, preserving body bytes and trimming the subject newline. */
export async function loadTemplates(directory = templateDirectory) {
  return Promise.all(
    templates.map(async ({ kind, alias, name }) => {
      const [subject, html, text] = await Promise.all([
        readFile(resolve(directory, `${kind}.subject.txt`), "utf8"),
        readFile(resolve(directory, `${kind}.html`), "utf8"),
        readFile(resolve(directory, `${kind}.txt`), "utf8"),
      ]);
      if (
        !subject.endsWith("\n") ||
        subject.slice(0, -1).includes("\n") ||
        !html.endsWith("\n") ||
        !text.endsWith("\n")
      ) {
        throw new Error(`${kind} template has an invalid line ending`);
      }
      return {
        Name: name,
        Alias: alias,
        Subject: subject.slice(0, -1),
        HtmlBody: html,
        TextBody: text,
        TemplateType: "Standard",
        LayoutTemplate: "",
      };
    }),
  );
}

function sameTemplate(remote, local) {
  return (
    fields.every((field) => remote[field] === local[field]) &&
    remote.TemplateType === "Standard" &&
    !remote.LayoutTemplate &&
    remote.Active === true
  );
}

function writeBody(local, creating) {
  const body = {
    Name: local.Name,
    Alias: local.Alias,
    Subject: local.Subject,
    HtmlBody: local.HtmlBody,
    TextBody: local.TextBody,
    LayoutTemplate: local.LayoutTemplate,
  };
  return creating ? { ...body, TemplateType: "Standard" } : body;
}

async function postmark(fetcher, token, origin, method, path, body) {
  const response = await fetcher(new URL(path, origin), {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(
      `Postmark ${method} ${path}: invalid JSON (HTTP ${response.status})`,
    );
  }
  return { status: response.status, ok: response.ok, result };
}

function requireSuccess(reply, method, path) {
  if (
    !reply.ok ||
    (reply.result.ErrorCode !== undefined && reply.result.ErrorCode !== 0)
  ) {
    throw new Error(
      `Postmark ${method} ${path}: HTTP ${reply.status}, code ${reply.result.ErrorCode ?? "unknown"}`,
    );
  }
  return reply.result;
}

/** Query live state on every run; create, update or skip each managed alias. */
export async function syncTemplates(
  localTemplates,
  token,
  fetcher = fetch,
  origin = apiOrigin,
) {
  if (!token) throw new Error("Postmark server token is required");
  const actions = [];
  for (const local of localTemplates) {
    const path = `/templates/${local.Alias}`;
    const found = await postmark(fetcher, token, origin, "GET", path);
    const missing = found.status === 422 && found.result.ErrorCode === 1101;
    if (!missing) requireSuccess(found, "GET", path);
    if (!missing && found.result.TemplateType !== "Standard") {
      throw new Error(
        `Postmark ${local.Alias}: an existing layout uses this alias`,
      );
    }
    if (!missing && sameTemplate(found.result, local)) {
      actions.push({ alias: local.Alias, action: "unchanged" });
      continue;
    }
    const validation = await postmark(
      fetcher,
      token,
      origin,
      "POST",
      "/templates/validate",
      {
        Subject: local.Subject,
        HtmlBody: local.HtmlBody,
        TextBody: local.TextBody,
        TemplateType: "Standard",
        InlineCssForHtmlTestRender: false,
        TestRenderModel: {
          link: "https://example.invalid/link",
          organization: "Example",
          invitedBy: "Example",
          expiry: "15 minutes",
          siteOrigin: "https://example.invalid",
        },
      },
    );
    const checked = requireSuccess(validation, "POST", "/templates/validate");
    if (checked.AllContentIsValid !== true) {
      throw new Error(`Postmark ${local.Alias}: template validation failed`);
    }
    const method = missing ? "POST" : "PUT";
    const writePath = missing ? "/templates" : path;
    const written = requireSuccess(
      await postmark(
        fetcher,
        token,
        origin,
        method,
        writePath,
        writeBody(local, missing),
      ),
      method,
      writePath,
    );
    if (
      written.Alias !== local.Alias ||
      !Number.isInteger(written.TemplateId)
    ) {
      throw new Error(`Postmark ${local.Alias}: unexpected write response`);
    }
    const verified = requireSuccess(
      await postmark(fetcher, token, origin, "GET", path),
      "GET",
      path,
    );
    if (!sameTemplate(verified, local)) {
      throw new Error(
        `Postmark ${local.Alias}: saved template differs from the committed version`,
      );
    }
    actions.push({
      alias: local.Alias,
      action: missing ? "created" : "updated",
    });
  }
  return actions;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const environment = process.argv[2];
  if (
    !["main-preview", "production"].includes(environment) ||
    process.argv.length !== 3
  ) {
    throw new Error(
      "Usage: sync-postmark-templates.mjs main-preview|production",
    );
  }
  const actions = await syncTemplates(
    await loadTemplates(),
    process.env.POSTMARK_SERVER_TOKEN,
  );
  for (const { alias, action } of actions) {
    process.stdout.write(`${environment}: ${alias} ${action}\n`);
  }
}
