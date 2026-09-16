import assert from "node:assert/strict";
import test from "node:test";

import { parseBrowseRecoveryState } from "../packages/viewer/dist/client/browse_recovery.js";
import {
  captureBrowseState,
  currentColorScheme,
  restoreBrowseState,
  setColorScheme,
  type BrowseRecoveryState,
} from "../packages/viewer/dist/client/browse_state.js";
import {
  isEligibleBrowseLink,
  NavigationSequencer,
} from "../packages/viewer/dist/client/navigation.js";

import { FakeClassList } from "./helpers/fake_dom.js";

const base = {
  download: false,
  modified: false,
  pathname: "/view/screens/welcome.html",
  sameOrigin: true,
  samePageHash: false,
  target: "",
};

const MOBILE_LIGHT = "/static/screens/welcome.mobile.html";
const MOBILE_DARK = "/static/screens/welcome.mobile.dark.html";
const DESKTOP_LIGHT = "/static/screens/welcome.desktop.html";
const DESKTOP_DARK = "/static/screens/welcome.desktop.dark.html";
const FALLBACK_LIGHT = "/static/screens/details.mobile.html";

test("browse interception accepts only same-origin catalogue routes", () => {
  assert.equal(isEligibleBrowseLink(base), true);
  assert.equal(isEligibleBrowseLink({ ...base, pathname: "/" }), true);
  assert.equal(
    isEligibleBrowseLink({ ...base, pathname: "/id/welcome" }),
    true,
  );
  assert.equal(
    isEligibleBrowseLink({ ...base, pathname: "/static/screens/a.html" }),
    false,
  );
  assert.equal(isEligibleBrowseLink({ ...base, pathname: "/review" }), false);
  assert.equal(isEligibleBrowseLink({ ...base, sameOrigin: false }), false);
  assert.equal(isEligibleBrowseLink({ ...base, download: true }), false);
  assert.equal(isEligibleBrowseLink({ ...base, modified: true }), false);
  assert.equal(isEligibleBrowseLink({ ...base, samePageHash: true }), false);
  assert.equal(isEligibleBrowseLink({ ...base, target: "_blank" }), false);
  assert.equal(isEligibleBrowseLink({ ...base, target: "_self" }), true);
});

test("navigation sequencing is latest-wins", () => {
  const sequencer = new NavigationSequencer();
  const first = sequencer.begin();
  assert.equal(first.isCurrent(), true);
  assert.equal(first.signal.aborted, false);
  const second = sequencer.begin();
  assert.equal(first.isCurrent(), false);
  assert.equal(first.signal.aborted, true);
  assert.equal(second.isCurrent(), true);
  assert.equal(second.signal.aborted, false);
});

test("setColorScheme replaces frame history and marks the body", () => {
  const view = schemeView();
  const doc = asDocument(view.doc);

  setColorScheme(doc, "dark");
  assert.equal(view.doc.body.getAttribute("data-mokly-color-scheme"), "dark");
  assert.equal(currentColorScheme(doc), "dark");
  assert.equal(view.mobileFrame.contentWindow.location.pathname, MOBILE_DARK);
  assert.equal(view.desktopFrame.contentWindow.location.pathname, DESKTOP_DARK);
  assert.equal(view.fallbackFrame.getAttribute("src"), FALLBACK_LIGHT);
  assert.equal(view.fallbackFrame.srcWrites, 0);
  assert.equal(view.mobileFrame.srcWrites, 0);
  assert.equal(view.desktopFrame.srcWrites, 0);
  assert.deepEqual(pressedOptions(view), ["false", "true", "false", "true"]);

  setColorScheme(doc, "dark");
  assert.equal(view.mobileFrame.replacements, 1);
  assert.equal(view.desktopFrame.replacements, 1);

  setColorScheme(doc, "light");
  assert.equal(currentColorScheme(doc), "light");
  assert.equal(view.mobileFrame.getAttribute("src"), MOBILE_LIGHT);
  assert.equal(view.desktopFrame.getAttribute("src"), DESKTOP_LIGHT);
  assert.equal(view.mobileFrame.replacements, 2);
  assert.equal(view.fallbackFrame.srcWrites, 0);
  assert.equal(view.mobileFrame.srcWrites, 0);
  assert.equal(view.desktopFrame.srcWrites, 0);
  assert.deepEqual(pressedOptions(view), ["true", "false", "true", "false"]);
});

test("setColorScheme clamps a light-only catalogue to light", () => {
  const embed = new FakeElement("iframe", { src: "/static/pages/notes.html" });
  const fake = new FakeDocument([embed]);
  const doc = asDocument(fake);

  assert.equal(currentColorScheme(doc), "light");
  setColorScheme(doc, "dark");
  assert.equal(fake.body.getAttribute("data-mokly-color-scheme"), "light");
  assert.equal(currentColorScheme(doc), "light");
  assert.equal(embed.getAttribute("src"), "/static/pages/notes.html");
  assert.equal(embed.srcWrites, 0);

  fake.body.setAttribute("data-mokly-color-scheme", "sepia");
  assert.equal(currentColorScheme(doc), "light");
});

test("recovery state restores color scheme strictly", () => {
  const captured = schemeView();
  setColorScheme(asDocument(captured.doc), "dark");
  const state = captureBrowseState(asDocument(captured.doc), fakeWindow());
  assert.ok(state);
  assert.equal(state.colorScheme, "dark");

  const reloaded = schemeView();
  restoreBrowseState(asDocument(reloaded.doc), fakeWindow(), state);
  assert.equal(
    reloaded.doc.body.getAttribute("data-mokly-color-scheme"),
    "dark",
  );
  assert.equal(
    reloaded.mobileFrame.contentWindow.location.pathname,
    MOBILE_DARK,
  );
  assert.equal(reloaded.fallbackFrame.getAttribute("src"), FALLBACK_LIGHT);
  assert.deepEqual(pressedOptions(reloaded), [
    "false",
    "true",
    "false",
    "true",
  ]);

  assert.deepEqual(parseBrowseRecoveryState(snapshot()), snapshot());
  assert.equal(
    parseBrowseRecoveryState({ ...snapshot(), colorScheme: "sepia" }),
    undefined,
  );
  assert.equal(
    parseBrowseRecoveryState({
      ...snapshot(),
      filterBaselineClosedCollectionIds: [4],
    }),
    undefined,
  );
  const withoutScheme: Record<string, unknown> = { ...snapshot() };
  delete withoutScheme["colorScheme"];
  assert.equal(parseBrowseRecoveryState(withoutScheme), undefined);
});

test("restored dark stays light when a rebuild drops dark fragments", () => {
  const embed = new FakeElement("iframe", { src: "/static/pages/notes.html" });
  const fake = new FakeDocument([
    new FakeElement("div", { "data-mokly-shell": "" }),
    embed,
  ]);
  const doc = asDocument(fake);

  restoreBrowseState(doc, fakeWindow(), snapshot());

  assert.equal(snapshot().colorScheme, "dark");
  assert.equal(fake.body.getAttribute("data-mokly-color-scheme"), "light");
  assert.equal(currentColorScheme(doc), "light");
  assert.equal(embed.getAttribute("src"), "/static/pages/notes.html");
  assert.equal(embed.srcWrites, 0);
});

test("recovery selects the tag chip the restored query names", () => {
  const search = new FakeElement("input", { "data-mokly-search": "" });
  const forms = new FakeElement("button", { "data-mokly-tag": "forms" });
  const onboarding = new FakeElement("button", {
    "data-mokly-tag": "onboarding",
  });
  const fake = new FakeDocument([
    new FakeElement("div", { "data-mokly-shell": "" }),
    search,
    forms,
    onboarding,
  ]);

  restoreBrowseState(asDocument(fake), fakeWindow(), {
    ...snapshot(),
    query: "tag:forms",
  });

  assert.equal(search.value, "tag:forms");
  assert.equal(forms.classList.contains("active"), true);
  assert.equal(onboarding.classList.contains("active"), false);
});

test("recovery matches stable keys and ignores old label paths", () => {
  const shell = new FakeElement("div", { "data-mokly-shell": "" });
  const alpha = new FakeElement("details", {
    "data-nav-collection": "collection:alpha",
    "data-nav-disclosure": "collection:pages:alpha",
  });
  const beta = new FakeElement("details", {
    "data-nav-collection": "collection:beta",
    "data-nav-disclosure": "collection:pages:beta",
  });
  const fake = new FakeDocument([shell, alpha, beta]);
  const doc = asDocument(fake);

  restoreBrowseState(doc, fakeWindow(), {
    ...snapshot(),
    closedCollectionIds: ["/Same title", "collection:alpha"],
    filterBaselineClosedCollectionIds: ["/Same title", "collection:alpha"],
  });

  assert.equal(alpha.open, false);
  assert.equal(beta.open, true);
  assert.deepEqual(captureBrowseState(doc, fakeWindow())?.closedCollectionIds, [
    "collection:pages:alpha",
  ]);
});

/** One dark-capable screen view: two switch instances and three frames. */
interface SchemeView {
  desktopFrame: FakeElement;
  doc: FakeDocument;
  fallbackFrame: FakeElement;
  headDark: FakeElement;
  headLight: FakeElement;
  mobileFrame: FakeElement;
  topDark: FakeElement;
  topLight: FakeElement;
}

function schemeView(): SchemeView {
  const view = {
    desktopFrame: fragmentFrame(DESKTOP_LIGHT, DESKTOP_DARK),
    fallbackFrame: fragmentFrame(FALLBACK_LIGHT),
    headDark: optionButton("dark", "false"),
    headLight: optionButton("light", "true"),
    mobileFrame: fragmentFrame(MOBILE_LIGHT, MOBILE_DARK),
    topDark: optionButton("dark", "false"),
    topLight: optionButton("light", "true"),
  };
  return {
    ...view,
    doc: new FakeDocument([
      new FakeElement("div", { "data-mokly-shell": "" }),
      view.topLight,
      view.topDark,
      view.headLight,
      view.headDark,
      view.mobileFrame,
      view.desktopFrame,
      view.fallbackFrame,
    ]),
  };
}

function pressedOptions(view: SchemeView): (string | null)[] {
  return [view.topLight, view.topDark, view.headLight, view.headDark].map(
    (option) => option.getAttribute("aria-pressed"),
  );
}

function optionButton(value: string, pressed: string): FakeElement {
  return new FakeElement("button", {
    "aria-pressed": pressed,
    "data-color-scheme-option": value,
  });
}

function fragmentFrame(light: string, dark?: string): FakeElement {
  return new FakeElement("iframe", {
    ...(dark === undefined ? {} : { "data-fragment-dark": dark }),
    "data-fragment-light": light,
    src: light,
  });
}

function snapshot(): BrowseRecoveryState {
  return {
    changedOnly: true,
    closedCollectionIds: ["collection:fixture"],
    colorScheme: "dark",
    detailsOpen: true,
    drawerOpen: false,
    filterBaselineClosedCollectionIds: ["collection:fixture"],
    navScroll: 12,
    query: "welcome",
    regionScrolls: { stage: 42 },
    viewport: "mobile",
  };
}

function asDocument(doc: FakeDocument): Document {
  return doc as unknown as Document;
}

function fakeWindow(): Window & typeof globalThis {
  return {
    location: {
      href: "http://127.0.0.1:4173/view/screens/welcome.html",
      pathname: "/view/screens/welcome.html",
    },
  } as unknown as Window & typeof globalThis;
}

const SELECTOR = /^(?<tag>[a-z]*)\[(?<name>[a-z-]+)(?:="(?<value>[^"]*)")?\]$/;

/** A flat stand-in for the served shell markup the Browse client mutates. */
class FakeElement {
  readonly classList = new FakeClassList();
  readonly dataset: Record<string, string> = {};
  hidden = false;
  open = true;
  srcWrites = 0;
  replacements = 0;
  readonly contentWindow = {
    location: {
      pathname: "",
      replace: (url: string) => {
        this.replacements += 1;
        this.contentWindow.location.pathname = new URL(url).pathname;
      },
    },
  };
  value = "";
  readonly #attributes = new Map<string, string>();

  constructor(
    private readonly tagName: string,
    attributes: Readonly<Record<string, string>> = {},
  ) {
    for (const [name, value] of Object.entries(attributes))
      this.#attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.#attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    if (name === "src") this.srcWrites += 1;
    this.#attributes.set(name, value);
  }

  matches(selector: string): boolean {
    const parts = SELECTOR.exec(selector)?.groups;
    if (!parts) throw new Error(`unmodelled selector: ${selector}`);
    const tag = parts["tag"] ?? "";
    const value = this.#attributes.get(parts["name"] ?? "");
    if (tag !== "" && tag !== this.tagName) return false;
    if (value === undefined) return false;
    return parts["value"] === undefined || parts["value"] === value;
  }

  querySelector(): FakeElement | null {
    return null;
  }

  querySelectorAll(): FakeElement[] {
    return [];
  }
}

class FakeDocument {
  readonly body = new FakeElement("body");
  readonly URL = "http://127.0.0.1:4173/view/screens/welcome.html";

  constructor(private readonly elements: readonly FakeElement[]) {}

  querySelector(selector: string): FakeElement | null {
    return this.elements.find((element) => element.matches(selector)) ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    return this.elements.filter((element) => element.matches(selector));
  }
}
