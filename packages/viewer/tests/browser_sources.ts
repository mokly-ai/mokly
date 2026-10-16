/** Tiny authored catalogue for browser geometry and embedded-host tests. */
export interface BrowserSourceOptions {
  body?: string;
  screenVariants?: string;
  extra?: string;
  actionRender?: string;
  paneRender?: string;
  paneVariants?: string;
}

export function browserSources(options: BrowserSourceOptions = {}): string {
  const body =
    options.body ??
    `<action.Component label="Visible" /><action.Component moklyInstance="hidden" label="Hidden" hidden /><action.Component moklyInstance="multiple" label="Multiple" disabled /><div style={{height:800}} /><div style={{height:100,overflow:"auto"}}><div style={{height:200}}/><action.Component moklyInstance="scroll" label="Scroll" /></div><MockLink to="action">Open Action</MockLink><a href="../../unowned.html" id="unowned-link">Open unowned document</a><a href="./index.mobile.html?handoff=exact" id="exact-resource-link">Open exact next document</a>`;
  return `import React from "react";
import {defineComponent, defineScreen, MockLink} from "@mokly/mokly";
const metadata = {description: "A browser fixture", relatedDocs: []};
export const action = defineComponent({...metadata, path: "action", title: "Action",
 propSchema: {type: "object", additionalProperties: false, required: ["label"], properties: {
 label: {type: "string", maxLength: 80}, disabled: {type: "boolean"}, hidden: {type: "boolean"}}},
 props: {label: "Continue"},
 render: ${options.actionRender ?? "(props, context) => props.hidden ? null : props.disabled ? <><span>First root</span> Text root <strong>Last root</strong></> : <button style={{width:160,height:40}} data-viewport={context.viewport}>{props.label}</button>"},
 variants: [{slug: "default", title: "Default", props: {label: "Continue"}}, {slug: "disabled", title: "Disabled", props: {label: "Continue", disabled: true}}]
});
export const pane = defineComponent({...metadata, path: "pane", title: "Pane",
 propSchema: {type: "object", additionalProperties: false, properties: {}}, props: {}, slots: ["children"],
 render: ${options.paneRender ?? '(props) => <section>{props.children}<action.Component label="Inside" /></section>'},
 variants: ${options.paneVariants ?? '[{slug: "default", title: "Default", props: {}, slots: {children: <strong>Saved content</strong>}}]'}
});
${options.extra ?? ""}
export const home = defineScreen({...metadata, path: "home", title: "Home", tags: ["forms"], props: {}, variants: ${options.screenVariants ?? "[]"}, render: () => <main>${body}</main>});
`;
}
