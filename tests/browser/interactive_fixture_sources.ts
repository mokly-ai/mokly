/** Renderer source shared by the direct and real-Serve Live fixtures. */
export const rendererSource = `import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProviderContext } from "./provider.js";
export default function render(input) {
  return '<!doctype html><html><head><meta charset="utf-8"><title>Live fixture</title></head><body data-mokly-viewport="' + input.viewport + '"><style id="body-retained-style">body{margin:0}</style><script id="body-retained-script" type="application/json">{}</script>' + renderToStaticMarkup(<ProviderContext value={'provider-' + input.colorScheme}>{input.node}</ProviderContext>) + '</body></html>';
}
export function interactive(input) {
  return <ProviderContext value={'provider-' + input.colorScheme}><div data-live-provider={input.colorScheme}>{input.node}</div></ProviderContext>;
}
`;

/** Context module imported independently by the consumer renderer and entry. */
export const providerSource = `import { createContext } from "react";
export const ProviderContext = createContext("provider-missing");
`;

/** Consumer entry source exercising Live state, navigation, errors and JSX. */
export function interactiveSource(): string {
  return `import React, { useContext, useState } from "react";
import { defineComponent, defineScreen, mockLink, MockLink, ReviewIgnore } from "@mokly/mokly";
import { ProviderContext } from "../provider.js";
const metadata = { dependencies: [], relatedDocs: [] };
function StatefulPanel({ label }) {
  const [count, setCount] = useState(0);
  const [rawLink, setRawLink] = useState(true);
  return <main>
    <p id="count">{label}: {count} items</p>
    <button id="increment" onClick={() => setCount(value => value + 1)}>Increment</button>
    <button id="toggle-raw-link" onClick={() => setRawLink(value => !value)}>Toggle raw link</button>
    <MockLink id="mock-link" to="details">Open details</MockLink>
    <MockLink asChild to="details"><button id="child-link">Open child details</button></MockLink>
    <a href={rawLink ? mockLink("details") : "/outside"} id="raw-link">Open raw details</a>
    <ReviewIgnore id="shared-chrome"><span>Shared chrome</span></ReviewIgnore>
  </main>;
}
const panel = defineComponent({ ...metadata, path: "live-panel", title: "Live panel", description: "Stateful component", propSchema: { kind: "object", properties: { label: { schema: { kind: "string" } } } }, render: props => <StatefulPanel label={props.label} />, variants: [{ slug: "default", title: "Default", props: { label: "Saved" } }] });
function ProviderReaderView() {
  return <p id="provider-value">{useContext(ProviderContext)}</p>;
}
const providerReader = defineComponent({ ...metadata, path: "provider-reader", title: "Provider reader", description: "Renderer provider component", propSchema: { kind: "object", properties: {} }, render: ProviderReaderView, variants: [{ slug: "default", title: "Default", props: {} }] });
function Broken() {
  if (typeof window !== "undefined") throw new Error("browser render exploded");
  return <main><p id="static-error-fallback">Static error fallback</p><MockLink id="static-error-link" to="details">Open static details</MockLink></main>;
}
function DynamicChildren() {
  const labels = ["First", "Second"];
  if (typeof window === "undefined") return <main id="dynamic-children">{labels.map((label) => <span key={label}>{label}</span>)}</main>;
  return <main id="dynamic-children">{labels.map((label) => <span>{label}</span>)}</main>;
}
export const mockups = [
  ...panel.entries,
  ...providerReader.entries,
  defineScreen({ ...metadata, description: "Home", desktop: <main id="static-pre-mount">Static pre-mount fallback</main>, path: "home", mobile: <main id="static-pre-mount">Static pre-mount fallback</main>, title: "Home" }),
  defineScreen({ ...metadata, description: "Details", desktop: <main>Details</main>, path: "details", mobile: <main>Details</main>, title: "Details" }),
  defineScreen({ ...metadata, description: "Broken", desktop: <Broken />, path: "broken", mobile: <Broken />, title: "Broken" }),
  defineScreen({ ...metadata, description: "Static JSX siblings", desktop: <main id="static-children"><span>First</span><span>Second</span></main>, path: "static-children", mobile: <main id="static-children"><span>First</span><span>Second</span></main>, title: "Static children" }),
  defineScreen({ ...metadata, description: "Dynamic JSX children", desktop: <DynamicChildren />, path: "dynamic-children", mobile: <DynamicChildren />, title: "Dynamic children" })
];
`;
}
