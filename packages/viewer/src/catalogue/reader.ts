import { invalidData } from "../components/data.js";

import { CHANGE_STATUSES, readCollection, readEntry } from "./entry_reader.js";
import { assertPublicCatalogue } from "./privacy.js";
import { validateCatalogueReferences } from "./references.js";
import type { CatalogueNode, CatalogueReadModel } from "./types.js";
import {
  array,
  choice,
  comparisonPath,
  counter,
  hash,
  id,
  object,
  text,
} from "./values.js";

/** Parse known v1 fields; ignore compatible additions without exposing private data. */
export function readCatalogue(value: unknown): CatalogueReadModel {
  const input = object(value);
  if (input.schemaVersion !== 1)
    invalidData("$catalogue", "unsupported schemaVersion");
  assertPublicCatalogue(input);
  const identity = object(input.identity),
    revision = object(input.revision),
    tree = object(input.tree);
  const entries = (field: string, kind: string) =>
    array(input[field]).map((raw) => {
      const entry = readEntry(raw);
      if (entry.kind !== kind)
        invalidData("$catalogue", "entry in wrong array");
      return entry;
    });
  const model: CatalogueReadModel = {
    schemaVersion: 1,
    identity: { id: hash(identity.id), title: text(identity.title) },
    deploymentId: hash(input.deploymentId),
    revision: {
      content: counter(revision.content),
      evidence: counter(revision.evidence),
    },
    changesStatus: choice(input.changesStatus, CHANGE_STATUSES),
    comparisonUrl: comparisonPath(input.comparisonUrl),
    collections: array(input.collections).map(readCollection),
    tree: {
      pages: array(tree.pages).map(readNode),
      components: array(tree.components).map(readNode),
    },
    screens: entries("screens", "screen").filter(
      (entry) => entry.kind === "screen",
    ),
    pages: entries("pages", "page").filter((entry) => entry.kind === "page"),
    useCases: entries("useCases", "use-case").filter(
      (entry) => entry.kind === "use-case",
    ),
    components: entries("components", "component").filter(
      (entry) => entry.kind === "component",
    ),
    removedEntries: array(input.removedEntries).map((raw) => {
      const removed = object(raw);
      return {
        entry: readEntry(removed.entry),
        ancestors: array(removed.ancestors).map((raw) => {
          const ancestor = object(raw);
          return { id: id(ancestor.id), title: text(ancestor.title) };
        }),
      };
    }),
  };
  validateCatalogueReferences(model);
  return model;
}

function readNode(value: unknown): CatalogueNode {
  const input = object(value),
    kind = choice(input.kind, ["collection", "entry"] as const);
  return kind === "entry"
    ? { kind, id: id(input.id) }
    : { kind, id: id(input.id), children: array(input.children).map(readNode) };
}
