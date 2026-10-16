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
  paused = false,
): Promise<void> {
  if (page.isClosed()) return;
  if (paused) {
    await page.clock.runFor(32);
    return;
  }
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
  const paused = new WeakSet<Page>();
  const clockCleanups: (() => void)[] = [];
  const watchClock = (page: Page) => {
    const pauseAt = page.clock.pauseAt;
    page.clock.pauseAt = async (...args) => {
      paused.add(page);
      await pauseAt.apply(page.clock, args);
    };
    clockCleanups.push(() => {
      page.clock.pauseAt = pauseAt;
    });
  };
  const contexts = new Map<
    BrowserContext,
    { detach(): void; settle(): Promise<void> }
  >();
  const attach = (
    context: BrowserContext,
    javaScriptEnabled = defaultJavaScriptEnabled,
  ) => {
    if (contexts.has(context)) return;
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
    context.on("page", watchClock);
    context.pages().forEach(watchClock);
    context.on("console", onConsole);
    context.on("weberror", onError);
    const settle = async () => {
      await Promise.all(
        context
          .pages()
          .map((page) =>
            settleBrowserPage(page, javaScriptEnabled, paused.has(page)),
          ),
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
        context.off("page", watchClock);
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
        clockCleanups.forEach((restore) => restore());
      }
    },
  };
}
