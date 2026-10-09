import { moveComponentSource } from "./move_catalogue_sources.js";

export type BranchPointCase =
  | "moved-consumers"
  | "moved-parent"
  | "moved-variant"
  | "case-renames"
  | "reused-parent";

interface BranchPointSources {
  before: Readonly<Record<string, string>>;
  head: Readonly<Record<string, string | null>>;
}

function variant(slug: string, label: string, movedFrom?: string): string {
  return JSON.stringify({
    slug,
    title: slug,
    props: { label },
    ...(movedFrom ? { movedFrom } : {}),
  });
}

function receipt(importPath: string, movedFrom?: string): string {
  return `import {defineScreen} from '@mokly/mokly';
    import {badge} from '${importPath}';
    export default defineScreen({title:'Receipt',description:'Your order receipt',relatedDocs:[],
    ${movedFrom ? `movedFrom:'${movedFrom}',` : ""}
    mobile:<main><h1>Receipt</h1><badge.Component label='Paid'/></main>,
    desktop:<main><h1>Receipt</h1><badge.Component label='Paid'/></main>});`;
}

function consumers(): BranchPointSources {
  const badge = (edited: boolean) =>
    moveComponentSource({
      name: "badge",
      title: "Badge",
      render: `<span className="${edited ? "badge badge-v2" : "badge"}">{props.label}</span>`,
      variants: variant("default", "Active"),
    });
  const status = (moved: boolean) =>
    moveComponentSource({
      title: "Status",
      name: "status",
      imports: `import {badge} from '${moved ? "../" : "./"}badge.mockup.js';`,
      render: "<section><badge.Component label={props.label}/></section>",
      variants: variant("default", "Account active"),
      ...(moved ? { movedFrom: "library/status" } : {}),
    });
  return {
    before: {
      "specs/library/badge.mockup.tsx": badge(false),
      "specs/library/status.mockup.tsx": status(false),
      "specs/shop/receipt.mockup.tsx": receipt("../library/badge.mockup.js"),
    },
    head: {
      "specs/library/badge.mockup.tsx": badge(true),
      "specs/library/status.mockup.tsx": null,
      "specs/library/archive/status.mockup.tsx": status(true),
      "specs/shop/receipt.mockup.tsx": null,
      "specs/shop/archive/receipt.mockup.tsx": receipt(
        "../../library/badge.mockup.js",
        "shop/receipt",
      ),
    },
  };
}

function parent(): BranchPointSources {
  return {
    before: {
      "specs/library/index.mockup.tsx": moveComponentSource({
        title: "Library",
        render: "<aside>{props.label}</aside>",
      }),
      "specs/library/action.mockup.tsx": moveComponentSource({
        variants: [
          variant("primary", "Continue"),
          variant("secondary", "Cancel"),
        ].join(","),
      }),
    },
    head: {
      "specs/library/action.mockup.tsx": null,
      "specs/library/archive/action.mockup.tsx": moveComponentSource({
        movedFrom: "library/action",
        variants: variant("primary", "Submit"),
      }),
    },
  };
}

function transferredVariant(): BranchPointSources {
  return {
    before: {
      "specs/library/donor.mockup.tsx": moveComponentSource({
        title: "Donor",
        variants: [
          variant("primary", "Continue"),
          variant("spare", "Later"),
        ].join(","),
      }),
      "specs/library/receiver.mockup.tsx": moveComponentSource({
        title: "Receiver",
        variants: variant("default", "Accept"),
      }),
    },
    head: {
      "specs/library/donor.mockup.tsx": moveComponentSource({
        title: "Donor",
        variants: variant("spare", "Later"),
      }),
      "specs/library/receiver.mockup.tsx": moveComponentSource({
        title: "Receiver",
        variants: [
          variant("default", "Accept"),
          variant("primary", "Submit", "library/donor/primary"),
        ].join(","),
      }),
    },
  };
}

function caseRenames(): BranchPointSources {
  const screen = `import {defineScreen} from '@mokly/mokly'; export default defineScreen({title:'Receipt',description:'Order receipt',relatedDocs:[],mobile:<p>Receipt</p>,desktop:<p>Receipt</p>});`;
  return {
    before: {
      "specs/shop/Receipt.mockup.tsx": screen,
      "specs/library/Action.mockup.tsx": moveComponentSource({
        variants: [
          variant("Primary", "Continue"),
          variant("secondary", "Cancel"),
        ].join(","),
      }),
    },
    head: {
      "specs/shop/Receipt.mockup.tsx": null,
      "specs/shop/receipt.mockup.tsx": screen,
      "specs/library/Action.mockup.tsx": null,
      "specs/library/action.mockup.tsx": moveComponentSource({
        variants: variant("primary", "Submit"),
      }),
    },
  };
}

/** Each case stays clear of the ten unapproved second-review findings. */
export function branchPointSources(name: BranchPointCase): BranchPointSources {
  switch (name) {
    case "moved-consumers":
      return consumers();
    case "moved-parent":
      return parent();
    case "moved-variant":
      return transferredVariant();
    case "case-renames":
      return caseRenames();
    case "reused-parent":
      return {
        before: { "specs/library/action.mockup.tsx": moveComponentSource() },
        head: {
          "specs/library/action.mockup.tsx": null,
          "specs/library/action.md":
            "# Action guide\n\nChoose a clear label for each action.\n",
        },
      };
  }
}
