/**
 * Sources for the moved-changes fixture. The baseline holds a Billing folder of
 * screens and a document, and a component library; the branch moves both.
 */

function invoice(due: string, variants: string, moved = ""): string {
  return `import {defineScreen} from '@mokly/mokly';
const shot = (body: string) => <main style={{font: "16px system-ui", padding: 24}}><h1>Invoice INV-1042</h1><p id="due">{body}</p></main>;
export default defineScreen({title:'Invoice',description:'An invoice and its amount due',relatedDocs:[],${moved}
  mobile: shot(${JSON.stringify(due)}), desktop: shot(${JSON.stringify(due)}),
  variants:[${variants}]});`;
}

const variant = (slug: string, title: string) =>
  `{slug:'${slug}',title:'${title}',description:'${title}',mobile:<main><h1>${title}</h1></main>,desktop:<main><h1>${title}</h1></main>}`;
const OVERDUE = variant("overdue", "Overdue");
const PAID = variant("paid", "Paid");

const RECEIPT = `import {defineScreen} from '@mokly/mokly';
export default defineScreen({title:'Receipt',description:'A receipt for a paid invoice',relatedDocs:[],mobile:<main><h1>Receipt</h1></main>,desktop:<main><h1>Receipt</h1></main>});`;

const HOME = `import {defineScreen} from '@mokly/mokly';
export default defineScreen({title:'Home',description:'Home',relatedDocs:[],mobile:<main><h1>Home</h1></main>,desktop:<main><h1>Home</h1></main>});`;

const TERMS = `---
description: When an invoice is due.
---
# Payment terms

Every invoice is due 30 days after it is issued.
`;

const ICON = `import {defineComponent} from '@mokly/mokly';
export const icon = defineComponent({slug:'index',title:'Icon',description:'A small glyph',relatedDocs:[],
  propSchema:{kind:'object',properties:{name:{schema:{kind:'string'}}}},
  slots:['children'],
  render:(props)=><i>{props.name}{props.children}</i>,
  variants:[{slug:'arrow',title:'Arrow',props:{name:'arrow'}}]});`;

const ICON_ENTRIES = `import {icon} from './icon.mokly.js';
export const mockups = icon.entries;`;

/**
 * Action at the branch point, or after the move: Secondary is deleted, Ghost
 * changes only its description, and Iconic's ring holds another glyph. The
 * glyph sits in the ring's slot, so its input belongs to Iconic.
 */
function action(moved: boolean): string {
  return `import {defineComponent} from '@mokly/mokly';
import {icon} from '../icon/icon.mokly.js';
const action = defineComponent({slug:'index',title:'Action',description:'A shared action',relatedDocs:[],${moved ? "movedFrom:'components/action'," : ""}
  propSchema:{kind:'object',properties:{label:{schema:{kind:'string'}}}},
  slots:['children'],
  render:(props)=><button>{props.children}{props.label}</button>,
  variants:[
    {slug:'primary',title:'Primary',description:'The main action',props:{label:'Continue'}},
    ${moved ? "" : "{slug:'secondary',title:'Secondary',description:'A way back',props:{label:'Go back'}},"}
    {slug:'ghost',title:'Ghost',description:'${moved ? "A quiet action for skipping" : "A quiet action"}',props:{label:'Skip'}},
    {slug:'iconic',title:'Iconic',description:'An action with an icon',props:{label:'Next',children:<icon.Component name="ring"><icon.Component moklyInstance="glyph" name="${moved ? "chevron" : "arrow"}" /></icon.Component>}},
  ]});
export const mockups = action.entries;`;
}

/** Every file at the branch point, keyed by its path in the repository. */
export const BASELINE: Readonly<Record<string, string>> = {
  "specs/billing/_folder.json": '{"title":"Billing & Payments"}',
  "specs/billing/invoice.mockup.tsx": invoice(
    "Due in 14 days",
    `${OVERDUE},${PAID}`,
  ),
  "specs/billing/receipt.mockup.tsx": RECEIPT,
  "specs/billing/payment-terms.md": TERMS,
  "specs/components/action/action.mockup.tsx": action(false),
  "specs/components/icon/icon.mokly.tsx": ICON,
  "specs/components/icon/icon.mockup.tsx": ICON_ENTRIES,
  "specs/home.mockup.tsx": HOME,
};

/**
 * The branch's edits after `billing` moved under `account` and `components`
 * became `ui`. Invoice and Action declare `movedFrom` because they changed;
 * the other entries move unchanged, so pairing never relies on similarity.
 */
export const MOVED_EDITS: Readonly<Record<string, string>> = {
  "specs/account/billing/invoice.mockup.tsx": invoice(
    "Due on 14 March",
    OVERDUE,
    "movedFrom:'billing/invoice',",
  ),
  "specs/ui/action/action.mockup.tsx": action(true),
};
