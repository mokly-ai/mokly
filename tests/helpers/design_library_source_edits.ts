/** A real source mutation applied to the isolated design catalogue. */
export interface SourceEdit {
  file: string;
  change: (source: string) => string;
}

const designRoot = "examples/basic/specs/design";
const useCaseFile = `${designRoot}/browse/views/use-case.tsx`;

function replacement(file: string, from: string, to: string): SourceEdit {
  return { file, change: (source) => source.replace(from, to) };
}

/** The twelve established implementation, metadata, and caller-owned edits. */
export const sourceEdits = {
  topBarClass: replacement(
    `${designRoot}/library/chrome/top-bar.view.tsx`,
    'className="mbk-topbar"',
    'className="mbk-topbar revised"',
  ),
  tagChipLabel: replacement(
    `${designRoot}/library/controls/tag-chip.view.tsx`,
    "{label}",
    "{label} revised",
  ),
  savedTitle: replacement(
    `${designRoot}/library/chrome/top-bar.tsx`,
    'title: "Search"',
    'title: "Filtered search"',
  ),
  controlLabel: replacement(
    `${designRoot}/library/chrome/top-bar.tsx`,
    'label: "Query"',
    'label: "Search text"',
  ),
  savedQuery: replacement(
    `${designRoot}/library/chrome/top-bar.tsx`,
    'query: "tag:forms"',
    'query: "tag:onboarding"',
  ),
  screenTitle: replacement(
    useCaseFile,
    'title="Example tour"',
    'title="Explore the example"',
  ),
  destination: replacement(
    useCaseFile,
    "screenPath={DESTINATIONS.welcome}",
    "screenPath={DESTINATIONS.details}",
  ),
  slot: replacement(
    useCaseFile,
    "<MiniWelcome />",
    "<MiniWelcome /><p>Continue when ready</p>",
  ),
  reorder: {
    file: useCaseFile,
    change: (source: string) =>
      source.replace(
        /(<FlowStep[\s\S]*?<\/FlowStep>)\s*(<FlowStep[\s\S]*?<\/FlowStep>)/,
        "$2\n$1",
      ),
  },
  removal: {
    file: useCaseFile,
    change: (source: string) =>
      source.replace(/<FlowStep[\s\S]*?<\/FlowStep>/, ""),
  },
  pickerTag: replacement(
    `${designRoot}/browse/states/tags/picker.tsx`,
    "design={DESTINATIONS.tagPicker}",
    'design={DESTINATIONS.tagPicker} tag="forms"',
  ),
  cornerRadius: replacement(
    `${designRoot}/components/controls/parts/fixtures.ts`,
    "draft: { ...saved, cornerRadius: 40 }",
    "draft: { ...saved, cornerRadius: 50 }",
  ),
} satisfies Readonly<Record<string, SourceEdit>>;
