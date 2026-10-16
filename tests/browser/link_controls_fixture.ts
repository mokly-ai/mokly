import { serveCatalogue } from "./catalogue_fixture.js";
export function startLinkControlFixture(): ReturnType<typeof serveCatalogue> {
  return serveCatalogue(
    {
      "specs/index.mockup.tsx": `import React from "react";
import {defineScreen, defineUseCase, MockLink} from "@mokly/mokly";
import {Button} from "@firna/ui/button";
const noop = () => {};
function Controls() { return <>
<MockLink asChild to="details"><Button tone="primary" testID="continue" onPress={noop}>Continue</Button></MockLink>
<Button tone="primary" testID="reference" onPress={noop}>Continue</Button>
<MockLink asChild to="details"><Button block tone="primary" testID="block-continue" onPress={noop}>Continue</Button></MockLink>
<Button block tone="primary" testID="block-reference" onPress={noop}>Continue</Button>
<MockLink asChild to="details"><Button disabled testID="disabled" onPress={noop}>Disabled</Button></MockLink>
<MockLink asChild to="details"><Button busy testID="busy" onPress={noop}>Busy</Button></MockLink>
<MockLink asChild to="details"><Button testID="no-handler">No handler</Button></MockLink>
<MockLink asChild to="details"><button id="outline-reset" style={{outlineStyle:"none"}}>Focus me</button></MockLink>
<script>window.__consumerScriptRan = true;</script>
</>; }
const metadata = {description: "Link controls", relatedDocs: []};
export const home = defineScreen({...metadata, path: "home", title: "Home", useCasePaths: ["tour"], props: {}, render: () => <Controls/>});
export const details = defineScreen({...metadata, path: "details", title: "Details", useCasePaths: ["tour"], props: {}, render: () => <main>Details</main>});
export const tour = defineUseCase({...metadata, path: "tour", title: "Tour", steps: [{screenPath: "home"}, {screenPath: "details"}]});`,
      "renderer.tsx": `import React from "react"; import {SharedUiThemeProvider} from "@firna/ui/theme"; export default function render(input) {return <SharedUiThemeProvider>{input.node}</SharedUiThemeProvider>;}`,
    },
    {
      colorSchemes: ["light", "dark"],
      renderer: "renderer.tsx",
      moduleResolution: {
        aliases: { "react-native": "react-native-web" },
        conditions: ["react-native", "import", "module", "default"],
        loaders: { ".js": "jsx" },
        mainFields: ["react-native", "module", "main"],
        resolveExtensions: [
          ".web.tsx",
          ".web.ts",
          ".web.js",
          ".tsx",
          ".ts",
          ".js",
          ".jsx",
          ".json",
        ],
      },
    },
  );
}
