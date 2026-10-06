# Public Catalogue Types

This page owns the types of the [public catalogue read model](./mokly-catalogue.md).
Stored JSON uses ordinary strings. `readCatalogue` validates them before it
returns `CurrentPath` addresses and `BranchPointPath` references. The brands
change no values or bytes. The [typed-reference rule](./mokly-branch-point-lookup.md#typed-references)
owns their use.

Current records use current references. Removed records keep current addresses
but use branch-point references for variant parents, usage names and retained
relationships. Every `previousPath` is a branch-point reference. The declarations
below show the public defaults. The exported entry types also take an address
parameter before the reference parameter: `CatalogueRecord<Path, Reference>`.
`CatalogueReadModel<string, string>` describes unbranded wire input, and
`CatalogueRecord<BranchPointPath>` describes a baseline inventory entry.
Object sources must use the validated model. Hosts can call `readCatalogue`
on their decoded JSON instead of asserting its type.

The private shell catalogue and embedded display records keep these path
types. Generated views and ordered instances preserve their input reference
type. Before evidence and baseline inventories keep branch-point paths;
comparison result addresses and resolved destinations keep current paths.
The shell assigns types at accepted producer boundaries. It does not rewrite
values. Its route-string lookup returns a typed record address without move
resolution. A syntax guard retains lookup ownership checks that types cannot
enforce, including eligible-parent checks for current usage names. The type
guard permits React dependency identity, typed class-method binding and complete-record serialization for
hydration and snapshot equality. Neither operation maps reference identities.

```ts
import type {
  BranchPointPath,
  CurrentPath,
  ComponentControl,
  ComponentInstanceRecord,
  ComponentRangeRecord,
  ComponentSlotRecord,
  ComponentWireProps,
  ObjectPropSchema,
} from "@mokly/viewer";

type Viewport = "mobile" | "desktop";
type ColorScheme = "light" | "dark";
type ChangesStatus =
  "preparing" | "pending" | "ready" | "unavailable" | "disabled";
type ChangeKind = "added" | "changed" | "removed" | "unmodified";
type PublicPath = string;
type BeforePath<Path extends string> = string extends Path
  ? string
  : BranchPointPath;

interface CatalogueReadModel {
  schemaVersion: 4;
  identity: { id: string; title: string };
  deploymentId: string;
  revision: { content: number; evidence: number };
  changesStatus: ChangesStatus;
  comparisonUrl: PublicPath | null;
  tree: readonly CatalogueNode[];
  treeOrder?: readonly string[];
  screens: readonly CatalogueScreen[];
  pages: readonly CataloguePage[];
  documents: readonly CatalogueDocument[];
  useCases: readonly CatalogueUseCase[];
  components: readonly (CatalogueComponent | CatalogueComponentVariant)[];
  removedEntries: readonly {
    entry: CatalogueRecord<CurrentPath, BranchPointPath>;
    folderTitles: readonly string[];
    parentTitle?: string; // Required exactly on removed variants.
    snapshotId?: string;
    preview?: { kind: "screen" } | { kind: "page" } | { kind: "document" };
  }[];
}
type CatalogueRecord<
  Path extends string = CurrentPath,
  Reference extends string = Path,
> =
  | CatalogueScreen<Path, Reference>
  | CataloguePage<Path, Reference>
  | CatalogueDocument<Path, Reference>
  | CatalogueUseCase<Path, Reference>
  | CatalogueComponent<Path, Reference>
  | CatalogueComponentVariant<Path, Reference>;
type CatalogueNode =
  | {
      kind: "folder";
      path: CurrentPath;
      title: string;
      index?: CurrentPath;
      hidden?: true;
      order?: readonly string[];
      children: readonly CatalogueNode[];
    }
  | {
      kind: "entry";
      path: CurrentPath;
      hidden?: true;
      order?: readonly string[];
      children?: readonly CatalogueNode[];
    };
type CatalogueChanges =
  | { status: "ready"; kind: ChangeKind; included: boolean }
  | { status: Exclude<ChangesStatus, "ready"> };
type ComparisonSelection =
  | { status: "ready"; kind: ChangeKind; eligible: boolean }
  | { status: "pending" | "unavailable" | "disabled" };
interface CatalogueDetails {
  description: string;
  rationale?: string;
  relatedDocs: readonly string[];
  sourcePath: string;
  dependencies: readonly string[];
}
interface CatalogueEntry<Path extends string = CurrentPath> {
  path: Path;
  previousPath?: BeforePath<Path>;
  title: string;
  tags: readonly string[];
  details: CatalogueDetails;
  changes: CatalogueChanges;
}
type CatalogueUsage<Reference extends string = CurrentPath> =
  | {
      status: "ready";
      instances: readonly ComponentInstanceRecord<Reference>[];
      slots: readonly ComponentSlotRecord[];
      ranges: readonly ComponentRangeRecord[];
    }
  | { status: "pending" | "unavailable" };
interface CatalogueView<Reference extends string = CurrentPath> {
  viewport: Viewport;
  colorScheme: ColorScheme;
  usage: CatalogueUsage<Reference>;
  comparison: ComparisonSelection;
}
interface CatalogueScreen<
  Path extends string = CurrentPath,
  Reference extends string = Path,
> extends CatalogueEntry<Path> {
  kind: "screen";
  address?: string;
  variantOf?: Reference; // Present exactly on variant screens; the parent path.
  colorSchemes: readonly ColorScheme[];
  views: readonly CatalogueView<Reference>[];
  useCasePaths: readonly Reference[];
}
interface CataloguePage<
  Path extends string = CurrentPath,
  Reference extends string = Path,
> extends CatalogueEntry<Path> {
  kind: "page";
}
interface CatalogueDocument<
  Path extends string = CurrentPath,
  Reference extends string = Path,
> extends CatalogueEntry<Path> {
  kind: "document";
  colorSchemes: readonly ColorScheme[];
}
interface CatalogueUseCase<
  Path extends string = CurrentPath,
  Reference extends string = Path,
> extends CatalogueEntry<Path> {
  kind: "use-case";
  steps: readonly {
    screenPath: Reference;
    title?: string;
    description?: string;
  }[];
}
interface CatalogueComponent<
  Path extends string = CurrentPath,
  Reference extends string = Path,
> extends CatalogueEntry<Path> {
  kind: "component";
  colorSchemes: readonly ColorScheme[];
  propSchema: ObjectPropSchema;
  slots: readonly string[];
  controls: Readonly<Record<string, ComponentControl>>;
}
interface CatalogueComponentVariant<
  Path extends string = CurrentPath,
  Reference extends string = Path,
> extends CatalogueEntry<Path> {
  kind: "component";
  variantOf: Reference; // Present exactly on variant entries; the parent path.
  colorSchemes: readonly ColorScheme[];
  props: ComponentWireProps;
  suppliedSlots: readonly string[];
  views: readonly CatalogueView<Reference>[];
  comparison: ComparisonSelection;
}
```
