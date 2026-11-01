/** A standalone browser entry with controlled delivery, storage, and system input. */

import assert from "node:assert/strict";
import type { TestContext } from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, fireEvent } from "@testing-library/react";

import { mountMoklyShell } from "../src/browser.js";
import {
  entryDetailPath,
  INDEX_PATH,
} from "../src/catalogue/delivery_paths.js";
import type { ViewerTheme } from "../src/host/types.js";

import { indexFixture, rawDetailFixtures } from "./catalogue_v9_fixture.js";

const HttpResponse = globalThis.Response;

export async function environment(
  t: TestContext,
  options: {
    search?: string;
    stored?: string | null;
    initial?: string;
    systemDark?: boolean;
    opted?: boolean;
    failStorage?: boolean;
    pending?: boolean;
    path?: string;
  } = {},
) {
  GlobalRegistrator.register({
    url: `https://catalogue.test${options.path ?? "/view/product/browse/home/"}${options.search ?? ""}`,
  });
  const doc = document;
  const win = window;
  const transition = async (
    type: "pagehide" | "pageshow",
    persisted: boolean,
  ) => {
    const event = new win.Event(type);
    Object.defineProperty(event, "persisted", { value: persisted });
    await act(async () => win.dispatchEvent(event));
  };
  let closed = false;
  const exit = () => transition("pagehide", false);
  const dispose = async () => {
    if (closed) return;
    closed = true;
    try {
      await exit();
    } finally {
      await GlobalRegistrator.unregister();
    }
  };
  t.after(dispose);
  const listeners = new Set<() => void>();
  const media = {
    matches: options.systemDark ?? false,
    addEventListener(_type: string, listener: () => void) {
      listeners.add(listener);
    },
    removeEventListener(_type: string, listener: () => void) {
      listeners.delete(listener);
    },
  };
  t.mock.method(win, "matchMedia", (query: string) =>
    query === "(prefers-color-scheme: dark)"
      ? (media as MediaQueryList)
      : ({
          matches: false,
          addEventListener() {},
          removeEventListener() {},
        } as unknown as MediaQueryList),
  );
  const index = indexFixture((value) => {
    for (const screen of value.screens) {
      screen.colorSchemes = ["light", "dark"];
      screen.views = screen.views.flatMap((view) => [
        view,
        { ...view, colorScheme: "dark" as const },
      ]);
    }
  });
  const details = rawDetailFixtures().current;
  for (const detail of Object.values(details)) {
    if (detail.entry.kind === "screen")
      detail.views = detail.views.flatMap((view) => [
        view,
        { ...view, colorScheme: "dark" as const },
      ]);
  }
  let releaseIndex: (() => void) | undefined;
  const indexReady = new Promise<void>((resolve) => {
    releaseIndex = resolve;
  });
  let delivered = !options.pending;
  t.mock.method(win, "fetch", async (input: URL | RequestInfo) => {
    const url = new URL(String(input));
    if (url.pathname === `/${INDEX_PATH}` && !delivered) await indexReady;
    const detail = Object.entries(details).find(
      ([path]) => url.pathname === `/${entryDetailPath(path)}`,
    )?.[1];
    const value = url.pathname === `/${INDEX_PATH}` ? index : detail;
    const response = new HttpResponse(JSON.stringify(value ?? {}), {
      status: value ? 200 : 404,
      headers: { "Content-Type": "application/json" },
    });
    Object.defineProperty(response, "url", { value: url.href });
    return response;
  });
  if (options.stored) win.localStorage.setItem("mokly:theme", options.stored);
  const storage = win.localStorage;
  let writes = 0;
  const set = storage.setItem.bind(storage);
  const remove = storage.removeItem.bind(storage);
  t.mock.method(storage, "setItem", (key: string, value: string) => {
    if (key === "mokly:theme") writes += 1;
    set(key, value);
  });
  t.mock.method(storage, "removeItem", (key: string) => {
    if (key === "mokly:theme") writes += 1;
    remove(key);
  });
  if (options.failStorage) {
    Object.defineProperty(win, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
  }
  if (options.initial)
    doc.documentElement.setAttribute("data-mokly-theme", options.initial);
  const mount = doc.createElement("div");
  if (options.opted !== false) mount.setAttribute("data-mokly-shell", "");
  doc.body.append(mount);
  const start = async () => {
    await act(async () => mountMoklyShell(doc));
  };
  const select = () => {
    const control = mount.querySelector<HTMLSelectElement>(
      'select[aria-label="Appearance"]',
    );
    assert.ok(control, "the standalone Appearance control is rendered");
    return control;
  };
  const choose = async (value: ViewerTheme) => {
    await act(async () => fireEvent.change(select(), { target: { value } }));
  };
  let destination = "details";
  const navigate = async (scheme?: "light" | "dark") => {
    const suffix = scheme ? `?scheme=${scheme}` : "";
    await act(async () => {
      win.history.pushState(
        {},
        "",
        `/view/product/browse/${destination}/${suffix}`,
      );
      win.dispatchEvent(new win.PopStateEvent("popstate", { state: {} }));
      destination = destination === "details" ? "home" : "details";
    });
  };
  return {
    doc,
    win,
    mount,
    media,
    listeners,
    start,
    select,
    choose,
    navigate,
    dispose,
    exit,
    cache: () => transition("pagehide", true),
    stored: () => storage.getItem("mokly:theme"),
    writes: () => writes,
    theme: () => doc.documentElement.getAttribute("data-mokly-theme"),
    scheme: () =>
      mount
        .querySelector("[data-mokly-color-scheme]")
        ?.getAttribute("data-mokly-color-scheme"),
    frames: () => [...mount.querySelectorAll<HTMLIFrameElement>("iframe")],
    system: async (dark: boolean) => {
      media.matches = dark;
      await act(async () => {
        for (const listener of listeners) listener();
      });
    },
    deliver: async () => {
      delivered = true;
      await act(async () => releaseIndex?.());
    },
    restore: () => transition("pageshow", true),
  };
}
