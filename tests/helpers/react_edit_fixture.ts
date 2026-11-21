import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import { consumer } from "./mokly_serve.js";
import { git, write } from "./static_changes.js";

export const editSteps = [
  "initial",
  "text",
  "class",
  "import",
  "removed component",
  "renamed export",
  "base",
] as const;

const card = (
  name: string,
) => `import React from 'react'; import {defineComponent} from '@mokly/mokly';
export const ${name}=defineComponent({path:'card',element:'ui-card',title:'Card',description:'',relatedDocs:[],
propSchema:{type:'object',additionalProperties:false,properties:{label:{type:'string'}},required:['label']},props:{label:'Saved'},slots:['children'],
render:(props)=>React.createElement('button',null,props.label,props.children)});`;

function home(text: string, className: string, imported: boolean) {
  return `import React from 'react'; import {defineScreen} from '@mokly/mokly'; import * as components from './card.mockup.js';
${imported ? "import {message} from '../copy.js';" : `const message=${JSON.stringify(text)};`}
const card=Object.values(components)[0];
export const home=defineScreen({path:'home',title:'Home',description:'',relatedDocs:[],props:{},render:()=>React.createElement(React.Fragment,null,
React.createElement('h1',{className:${JSON.stringify(className)}},message),React.createElement(card.Component,{label:message},React.createElement('em',null,'Slot')),React.createElement('img',{src:'../../public.svg'}))});`;
}

export async function reactEditFixture(context: TestContext) {
  const root = await consumer(context, {
    "mokly.config.json": JSON.stringify({
      renderer: "renderer.mjs",
      review: { base: "fixture-base" },
      stylesheets: [{ match: "**", stylesheets: ["theme.css"] }],
    }),
    ".gitignore": "node_modules/\n.context/\nmokly-static/\n",
    "renderer.mjs":
      "import React from 'react'; export default ({node})=>React.createElement('section',{'data-provider':'fixture'},node);",
    "theme.css":
      ".small{color:red}.large{color:blue}button{background-image:url('./icon.svg')}",
    "icon.svg":
      '<svg xmlns="http://www.w3.org/2000/svg"><title>Fixture asset</title></svg>',
    "public.svg":
      '<svg xmlns="http://www.w3.org/2000/svg"><title>Public asset</title></svg>',
    "copy.ts": "export const message='Imported';",
    "specs/home.mockup.ts": home("Original", "small", false),
    "specs/card.mockup.ts": card("card"),
    "specs/stable.mockup.ts":
      "import React from 'react'; import {defineScreen} from '@mokly/mokly'; export default defineScreen({path:'stable',title:'Stable',description:'',relatedDocs:[],props:{},render:()=>React.createElement('p',null,'Stable')});",
    "specs/retired.mockup.ts":
      "import React from 'react'; import {defineComponent} from '@mokly/mokly'; export default defineComponent({path:'retired',title:'Retired',description:'',relatedDocs:[],propSchema:{type:'object',additionalProperties:false,properties:{}},props:{},render:()=>React.createElement('aside',null,'Retired')});",
  });
  for (const args of [
    ["init", "-q", "-b", "main"],
    ["config", "user.name", "Mokly Test"],
    ["config", "user.email", "test@example.invalid"],
    ["add", "-A"],
    ["commit", "-qm", "base catalogue"],
    ["branch", "fixture-base"],
  ])
    await git(root, ...args);
  return {
    root,
    async edit(step: (typeof editSteps)[number]) {
      switch (step) {
        case "initial":
          break;
        case "text":
          await write(
            root,
            "specs/home.mockup.ts",
            home("Edited", "small", false),
          );
          break;
        case "class":
          await write(
            root,
            "specs/home.mockup.ts",
            home("Edited", "large", false),
          );
          break;
        case "import":
          await write(
            root,
            "specs/home.mockup.ts",
            home("Edited", "large", true),
          );
          break;
        case "removed component":
          await fs.rm(path.join(root, "specs/retired.mockup.ts"));
          break;
        case "renamed export":
          await write(root, "specs/card.mockup.ts", card("renamedCard"));
          break;
        case "base": {
          await git(root, "add", "-A");
          await git(root, "commit", "-qm", "current catalogue");
          const commit = await git(root, "rev-parse", "HEAD");
          await git(root, "update-ref", "refs/heads/fixture-base", commit);
          return commit;
        }
      }
      return undefined;
    },
  };
}
