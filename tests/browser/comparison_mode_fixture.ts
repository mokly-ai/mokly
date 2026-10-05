import { branchCatalogue } from "./branch_hosts.js";

function source(changed: boolean): string {
  return `import {defineComponent} from '@mokly/mokly';
const create = (path, title) => defineComponent({path, title, description:title, dependencies:[],relatedDocs:[],propSchema:{kind:'object',properties:{label:{schema:{kind:'string'}}}},controls:{label:{kind:'text',maxLength:80}},render:(props,context)=><button>{context.viewport==='mobile' && props.label!=='Quiet' ? props.label+'${changed ? " updated" : ""}' : props.label}</button>,variants:[{slug:'default',title:'Default',props:{label:'Primary'}},{slug:'secondary',title:'Secondary',props:{label:'Secondary'}},{slug:'quiet',title:'Quiet',props:{label:'Quiet'}}]});
const action=create('action','Action');
const other=create('other','Other');
export const mockups=[...action.entries,...other.entries];`;
}

/** Fresh Git-backed component entries with mobile-only changes in two siblings. */
export function comparisonModeCatalogue() {
  return branchCatalogue(
    { "specs/components.mockup.tsx": source(false) },
    '{mockupsDir:"mockups",roots:[{dir:"specs"}],generatedOutput:"committed",colorSchemes:["light"]}',
    async (fixture) => {
      await fixture.write("specs/components.mockup.tsx", source(true));
    },
  );
}
