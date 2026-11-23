import fs from "node:fs/promises";
import path from "node:path";

import { command } from "../helpers/static_publication.js";

export function stylesheetConfig(stylesheets: string[], extra: object = {}) {
  return JSON.stringify({
    vite: true,
    roots: [{ dir: "src" }],
    stylesheets: [{ match: "**", stylesheets }],
    ...extra,
  });
}

export function stylesheetBuild(root: string, extra: string[] = []) {
  return command(root, "build", [
    "--sidecars=1",
    "--no-changes",
    "--out=.context/site",
    ...extra,
  ]).result;
}

export function generated(root: string, file: string) {
  return fs.readFile(
    path.join(root, ".context/site/static/mokly-generated", file),
    "utf8",
  );
}

export const htmlScreen = '---\ntitle: Home\n---\n<p class="site">Home</p>';

export function component(
  imports: string,
  contents: string,
  stylesheet?: string,
) {
  return `${imports}
import {defineComponent} from '@mokly/mokly';
export default defineComponent({path:'card', title:'Card', description:'', relatedDocs:[],
  propSchema:{type:'object',properties:{},additionalProperties:false}, props:{},
  ${stylesheet === undefined ? "" : `stylesheets:[${JSON.stringify(stylesheet)}],`}
  render:()=>${contents}});`;
}
