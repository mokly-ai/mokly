import type {
  Browser,
  BrowserContext,
  ConsoleMessage,
  WebError,
  Page,
} from "@playwright/test";

import { expectedConsoleNotice } from "./console_notices.js";

export interface BrowserFailure {
  kind: "console" | "pageerror";
  message: string;
  url: string;
}
export interface ErrorAllowance {
  kind: BrowserFailure["kind"];
  message: RegExp;
  url?: RegExp;
}

export function allowedBrowserFailure(
  failure: BrowserFailure,
  allowances: readonly ErrorAllowance[],
): boolean {
  return allowances.some(
    (rule) =>
      rule.kind === failure.kind &&
      new RegExp(rule.message.source, rule.message.flags).test(
        failure.message,
      ) &&
      (!rule.url ||
        new RegExp(rule.url.source, rule.url.flags).test(failure.url)),
  );
}

export async function settleBrowserPage(
  page: Page,
  javaScriptEnabled = true,
): Promise<void> {
  if (page.isClosed()) return;
  if (!javaScriptEnabled) {
    await page.evaluate(() => document.readyState);
    return;
  }
  await page
    .evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    )
    .catch((error: unknown) => {
      if (!page.isClosed()) throw error;
    });
}

/** Capture every context, including popups and contexts a spec creates itself. */
export function monitorBrowser(
  browser: Browser,
  defaultJavaScriptEnabled = true,
) {
  const failures: BrowserFailure[] = [];
  const contexts = new Map<
    BrowserContext,
    { detach(): void; settle(): Promise<void> }
  >();
  const attach = (
    context: BrowserContext,
    javaScriptEnabled = defaultJavaScriptEnabled,
  ) => {
    if (contexts.has(context)) return;
    // Every page in a context shares this clock, including pages opened later.
    let paused = false;
    const pauseAt = context.clock.pauseAt;
    const resume = context.clock.resume;
    context.clock.pauseAt = async (...args) => {
      await pauseAt.apply(context.clock, args);
      paused = true;
    };
    context.clock.resume = async () => {
      await resume.call(context.clock);
      paused = false;
    };
    const onConsole = (message: ConsoleMessage) => {
      if (message.type() === "error" && !expectedConsoleNotice(message))
        failures.push({
          kind: "console",
          message: message.text(),
          url: message.location().url,
        });
    };
    const onError = (error: WebError) => {
      failures.push({
        kind: "pageerror",
        message: error.error().message,
        url: error.page()?.url() ?? "",
      });
    };
    context.on("console", onConsole);
    context.on("weberror", onError);
    const settle = async () => {
      // Advance a shared paused clock once; do not wait on paused page frames.
      if (paused && context.pages().some((page) => !page.isClosed())) {
        await context.clock.runFor(32);
        return;
      }
      await Promise.all(
        context
          .pages()
          .map((page) => settleBrowserPage(page, javaScriptEnabled)),
      );
    };
    const close = context.close;
    context.close = async (...args) => {
      await settle();
      return close.apply(context, args);
    };
    contexts.set(context, {
      settle,
      detach() {
        context.clock.pauseAt = pauseAt;
        context.clock.resume = resume;
        context.off("console", onConsole);
        context.off("weberror", onError);
        context.close = close;
      },
    });
  };
  const newContext = browser.newContext;
  const newPage = browser.newPage;
  browser.newContext = async (...args) => {
    const context = await newContext.apply(browser, args);
    attach(context, args[0]?.javaScriptEnabled);
    return context;
  };
  browser.newPage = async (...args) => {
    const page = await newPage.apply(browser, args);
    attach(page.context(), args[0]?.javaScriptEnabled);
    return page;
  };
  browser.contexts().forEach((context) => attach(context));
  return {
    failures,
    async finish() {
      try {
        await Promise.all(
          [...contexts.values()].map((entry) => entry.settle()),
        );
      } finally {
        browser.newContext = newContext;
        browser.newPage = newPage;
        contexts.forEach((entry) => entry.detach());
      }
    },
  };
}
