import message from "@fixture/message";

import { definePage } from "@mokly/mokly";

import raw from "./message.txt?raw";

const first = await import("./lazy.js");
const second = await import("./lazy.js");
const { lazy } = first;

export const page = definePage({
  path: "vite-page",
  title: "Vite page",
  description: "A page with an asynchronous module import.",
  relatedDocs: [],
  render: () =>
    `<!doctype html><html><head><title>Vite page</title></head><body>${message}|${raw.trim()}|${import.meta.env.VITE_FIXTURE_VALUE}|${lazy}|${first.token === second.token ? "once" : "twice"}</body></html>`,
});
