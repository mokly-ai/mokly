import { action } from "../../../../src/components/action/action.mokly.js";
import { toolbar } from "../../../../src/components/toolbar/toolbar.mokly.js";
import { CATALOGUE_TAGS, type CatalogueTag } from "../../parts/tags.js";

/**
 * A component of the example as the Canvas family shows it: the title, the
 * description, and the tags that its definition declares, its path in the
 * catalogue, and the file that defines it, relative to the example.
 */
export interface ComponentIdentity {
  title: string;
  description: string;
  path: string;
  source: string;
  tags: readonly CatalogueTag[];
}

/**
 * Whether the depicted catalogue lists a tag that a definition declares. A
 * tag that it does not list has no tag-filter artboard to open, so the
 * Canvas family leaves it out rather than fail the render.
 */
function isCatalogueTag(tag: string): tag is CatalogueTag {
  return CATALOGUE_TAGS.some((candidate) => candidate === tag);
}

/** The identity of a definition, with its catalogue path and its file. */
function identity(
  definition: { title: string; description: string; tags?: readonly string[] },
  path: string,
  source: string,
): ComponentIdentity {
  return {
    title: definition.title,
    description: definition.description,
    path,
    source,
    tags: (definition.tags ?? []).filter(isCatalogueTag),
  };
}

/**
 * The example's components, read from their definitions in
 * `examples/basic/src/components`. The configuration maps that folder to the
 * catalogue path `example/components`, and each definition's `index` slug
 * names the component's own folder.
 */
export const COMPONENT_IDENTITIES = {
  action: identity(
    action,
    "example/components/action",
    "src/components/action/action.mokly.tsx",
  ),
  toolbar: identity(
    toolbar,
    "example/components/toolbar",
    "src/components/toolbar/toolbar.mokly.tsx",
  ),
} as const satisfies Record<string, ComponentIdentity>;
