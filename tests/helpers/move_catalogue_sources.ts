import { pageSource } from "./path_fixture.js";

export interface MoveCatalogueOptions {
  edited?: boolean;
  resource?: boolean;
  resourceChanged?: boolean;
  sharedResource?: boolean;
  destination?: string;
  styles?: "imported" | "configured";
  linked?: boolean;
  flow?: boolean;
  component?: boolean;
  declared?: boolean;
  cssAsset?: boolean;
  unrelatedDocuments?: boolean;
}

export const meetingMarkdown =
  "# Meeting notes\n\nBudget estimates need approval.\nReview vendor invoices.\n\nArchive the quarterly minutes.";
export const onboardingMarkdown =
  "# Onboarding\n\nCreate a personal account.\nChoose a profile picture.\n\nMeet your project team.";

/** Separate exporting/defining files prevent source/title from hiding failed moves. */
export function moveCatalogueSources(
  options: MoveCatalogueOptions,
): Record<string, string> {
  if (options.unrelatedDocuments)
    return { "specs/old/guide.md": meetingMarkdown };
  const metadata = "description:'A workspace screen',relatedDocs:[]";
  const flow = options.flow ? ",useCasePaths:['./tour']" : "";
  const css = options.styles === "imported" ? "import './styled.css';" : "";
  const child = options.component ? "<action.Component label='Continue'/>" : "";
  const link = options.linked
    ? "<MockLink to='./target'>Details</MockLink>"
    : "";
  return {
    "specs/old/README.md": "# Overview\n\n[Guide](guide.md#start)",
    "specs/old/guide.md":
      "# Guide\n\n## Start\n\nRead the guide." +
      (options.resource ? "\n\n![Diagram](diagram.svg)" : ""),
    "specs/old/diagram.svg":
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="8"/></svg>',
    "specs/old/page.mockup.ts": pageSource(
      "",
      "<html><body><h1>Page</h1><p>Reference page.</p></body></html>",
    ),
    "specs/old/screen.mockup.tsx": `import {defineScreen,MockLink} from '@mokly/mokly'; ${css} ${options.component ? "import {action} from './action.mockup.js';" : ""}
      export default defineScreen({title:'Screen',${metadata}${flow}${options.declared ? ",movedFrom:'prior-screen'" : ""},mobile:<><h1 className='screen'>Mobile</h1>${link}${child}</>,desktop:<><h1 className='screen'>Desktop</h1>${link}${child}</>,variants:[{slug:'detail',title:'Detail',description:'The detail screen',mobile:<h1>Detail mobile</h1>,desktop:<h1>Detail desktop</h1>}]});`,
    ...(options.linked || options.flow
      ? {
          "specs/old/target.mockup.tsx": `import {defineScreen} from '@mokly/mokly'; export default defineScreen({title:'Target',${metadata}${flow},mobile:<p>Target mobile</p>,desktop:<p>Target desktop</p>});`,
        }
      : {}),
    ...(options.flow
      ? {
          "specs/old/tour.mockup.ts": `import {defineUseCase} from '@mokly/mokly'; export default defineUseCase({title:'Tour',description:'A journey',relatedDocs:[],steps:[{screenPath:'./screen'},{screenPath:'./target'}]});`,
        }
      : {}),
    ...(options.component
      ? {
          "specs/old/action.mockup.tsx": moveComponentSource(),
        }
      : {}),
    ...(options.styles === "imported"
      ? {
          "specs/old/styled.css":
            ".screen { color: #245; " +
            (options.cssAsset ? "background-image: url(./diagram.svg);" : "") +
            " }",
        }
      : {}),
    ...(options.styles === "configured"
      ? { "mockups/theme.css": ".screen { color: #245; }" }
      : {}),
    ...(options.sharedResource
      ? { "specs/steady.md": "# Steady\n\n![Diagram](old/diagram.svg)" }
      : {}),
  };
}

/** A registered component source shared by real-Git move fixtures. */
export function moveComponentSource({
  name = "action",
  title = "Action",
  render = "<button>{props.label}</button>",
  imports = "",
  variants = "{slug:'default',title:'Default',props:{label:'Saved action'}}",
  movedFrom,
}: {
  name?: string;
  title?: string;
  render?: string;
  imports?: string;
  variants?: string;
  movedFrom?: string;
} = {}): string {
  return `import {defineComponent} from '@mokly/mokly'; ${imports}
    export const ${name}=defineComponent({title:${JSON.stringify(title)},description:'A shared action',relatedDocs:[],
    ${movedFrom === undefined ? "" : `movedFrom:${JSON.stringify(movedFrom)},`}
    propSchema:{kind:'object',properties:{label:{schema:{kind:'string'}}}},
    render:(props)=>${render},variants:[${variants}]});`;
}
