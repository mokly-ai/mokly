import { moveComponentSource } from "./move_catalogue_sources.js";

function variant(slug: string, label: string, movedFrom?: string): string {
  return JSON.stringify({
    slug,
    title: slug,
    props: { label },
    ...(movedFrom ? { movedFrom } : {}),
  });
}

function screen(component: string, title: string): string {
  return `import {defineScreen} from '@mokly/mokly';
    import {badge} from '../library/${component}.mockup.js';
    export default defineScreen({title:'${title}',description:'Order receipt',dependencies:[],relatedDocs:[],
    mobile:<main><badge.Component label='Paid'/></main>,
    desktop:<main><badge.Component label='Paid'/></main>});`;
}

/** Case 6: removed screens keep moved and case-renamed component usage. */
export function removedScreenUsageSources() {
  const badge = moveComponentSource({ name: "badge", title: "Badge" });
  const pill = moveComponentSource({
    name: "badge",
    title: "Pill",
    render: "<span>{props.label}</span>",
  });
  return {
    before: {
      "specs/library/badge.mockup.tsx": badge,
      "specs/library/Pill.mockup.tsx": pill,
      "specs/shop/receipt.mockup.tsx": screen("badge", "Receipt"),
      "specs/shop/case-receipt.mockup.tsx": screen("Pill", "Case receipt"),
    },
    head: {
      "specs/library/badge.mockup.tsx": null,
      "specs/library/ui/badge.mockup.tsx": moveComponentSource({
        name: "badge",
        title: "Badge",
        movedFrom: "library/badge",
      }),
      "specs/library/Pill.mockup.tsx": null,
      "specs/library/pill.mockup.tsx": pill,
      "specs/shop/receipt.mockup.tsx": null,
      "specs/shop/case-receipt.mockup.tsx": null,
    },
  };
}

/** Case 7: two removed siblings retain non-alphabetical authored order. */
export function removedVariantOrderSources() {
  const variants = [
    variant("zulu", "Last"),
    variant("alpha", "First"),
    variant("default", "Continue"),
  ].join(",");
  return {
    before: {
      "specs/library/action.mockup.tsx": moveComponentSource({ variants }),
      "specs/library/Choice.mockup.tsx": moveComponentSource({
        title: "Choice",
        render: "<aside>{props.label}</aside>",
        variants,
      }),
    },
    head: {
      "specs/library/action.mockup.tsx": null,
      "specs/library/archive/action.mockup.tsx": moveComponentSource({
        movedFrom: "library/action",
        variants: variant("default", "Continue"),
      }),
      "specs/library/Choice.mockup.tsx": null,
      "specs/library/choice.mockup.tsx": moveComponentSource({
        title: "Choice",
        render: "<aside>{props.label}</aside>",
        variants: variant("default", "Continue"),
      }),
    },
  };
}

/** Case 8: a moved variant has inputs even when its new parent has no baseline. */
export function newParentVariantSources() {
  const nested = {
    imports: "import {badge} from './badge.mockup.js';",
    render: "<section><badge.Component label={props.label}/></section>",
  };
  return {
    before: {
      "specs/library/badge.mockup.tsx": moveComponentSource({
        name: "badge",
        title: "Badge",
        render: "<span>{props.label}</span>",
      }),
      "specs/library/donor.mockup.tsx": moveComponentSource({
        ...nested,
        title: "Donor",
        variants: [
          variant("primary", "Continue"),
          variant("spare", "Later"),
        ].join(","),
      }),
    },
    head: {
      "specs/library/donor.mockup.tsx": moveComponentSource({
        ...nested,
        title: "Donor",
        variants: variant("spare", "Later"),
      }),
      "specs/library/receiver.mockup.tsx": moveComponentSource({
        ...nested,
        title: "Receiver",
        variants: variant("primary", "Submit", "library/donor/primary"),
      }),
    },
  };
}
