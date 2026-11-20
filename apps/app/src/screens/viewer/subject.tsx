import type { Publication, PullRequest } from "../../api/types";
import type { PublicationRef } from "../../data/publications";
import {
  buildReference,
  buildReferenceLabel,
  buildSlot,
} from "../../viewer/build-state";
import type { BuildWatch } from "../../viewer/build-watch";
import type { ViewerEntry } from "../../viewer/entry";
import type { PublicationState } from "../../viewer/resolution";
import { refLabel, refOf } from "../../viewer/resolution";

/** What the chrome says about the reference and publication it is showing. */
export interface ChromeSubject {
  /**
   * The reference's name, once the address or a read names it. While nothing
   * names it yet, the trigger draws its placeholder: a wait never names the
   * reference with a word of its own.
   */
  label?: string;
  publication?: Publication;
  /** The reference this entry belongs to, for history and the poll. */
  ref?: PublicationRef;
  /** Who opened the pull request, when the provider observation recorded it. */
  author?: string;
  pullRequestUrl?: string;
  unpublished: boolean;
  missing: boolean;
  resolving: boolean;
  /**
   * What the slot says about a build in place of a publication: the state its
   * switcher row would read, with no SHA, because a build is not a publication.
   */
  status?: { state: PublicationState; detail: string };
}

/**
 * The pull request the chrome names. Both the publication's own observation and
 * the one a pull request alias read carry the same four facts, so they become
 * one shape here and the chrome never asks which it was given.
 */
interface NamedPullRequest {
  number: number;
  title: string;
  author?: string;
  url: string;
}

/**
 * Which pull request produced what the stage is showing.
 *
 * The publication carries its own: the address a check link opens, and the one
 * a reference alias is replaced by, name a publication and no reference at all,
 * so reading the pull request from the address would leave every immutable link
 * unable to say which review it belongs to. An alias that has not resolved to a
 * publication yet — and one whose pull request has never published — has only
 * the reference's own observation, which is what keeps that address named while
 * it waits.
 */
function namedPullRequest(
  publication?: Publication,
  addressed?: PullRequest,
): NamedPullRequest | undefined {
  const observed = publication?.pullRequest ?? addressed;
  if (!observed) return undefined;
  return {
    number: observed.number,
    title: observed.title,
    // An observation older than author retention has none, and a name nobody
    // supplied is not a name to invent.
    author: observed.author ?? undefined,
    url: observed.url,
  };
}

/**
 * The reference the chrome names. An address that names a pull request — or a
 * publication that came from one — says so; every other address takes the
 * branch that produced it, because the reference is what the reader recognizes
 * and the publication's own identity stays secondary to it.
 */
export function chromeSubject(input: {
  entry: ViewerEntry;
  publicationRef?: PublicationRef;
  publication?: Publication;
  pullRequest?: PullRequest;
  build?: BuildWatch;
}): ChromeSubject {
  const { entry, publicationRef, publication, pullRequest } = input;
  if (entry.kind === "build") {
    return buildSubject(entry.route, input.build, publicationRef, pullRequest);
  }
  const ref =
    publicationRef ??
    (publication
      ? refOf(publication)
      : entry.kind === "unpublished"
        ? entry.reference
        : undefined);
  const resolving = entry.kind === "loading" || entry.kind === "redirect";
  const pull = namedPullRequest(publication, pullRequest);
  const named = pull
    ? "#" + pull.number + " " + pull.title
    : ref
      ? refLabel(ref)
      : undefined;
  return {
    label: named ?? (resolving ? undefined : "This project"),
    publication,
    ref,
    author: pull?.author,
    pullRequestUrl: pull?.url,
    unpublished: entry.kind === "unpublished",
    missing: entry.kind === "missing",
    resolving,
  };
}

/** What the slot says while a build is read, or after its first read failed. */
const buildReads = {
  idle: { state: "none", detail: "Loading" },
  loading: { state: "none", detail: "Loading" },
  missing: { state: "failed", detail: "Build unavailable" },
  error: { state: "failed", detail: "Build couldn’t load" },
} as const;

/**
 * The chrome for a build in the stage. Once read, the build names its own
 * branch or pull request — with number, title and author — beside the state
 * its switcher row would read. Until then a build address names This build,
 * a reference showing its build keeps the reference's own name, and the
 * standalone entry, whose address names no reference, names none.
 */
function buildSubject(
  route: boolean,
  watch: BuildWatch | undefined,
  publicationRef: PublicationRef | undefined,
  pullRequest: PullRequest | undefined,
): ChromeSubject {
  const frame = { unpublished: true, missing: false, resolving: false };
  if (watch?.status === "ready") {
    const { build } = watch;
    return {
      ...frame,
      label: buildReferenceLabel(build),
      ref: buildReference(build),
      author: build.pullRequest?.author ?? undefined,
      pullRequestUrl: build.pullRequest?.url,
      status: buildSlot(build),
    };
  }
  const pull = route ? undefined : namedPullRequest(undefined, pullRequest);
  const named = pull
    ? "#" + pull.number + " " + pull.title
    : !route && publicationRef
      ? refLabel(publicationRef)
      : undefined;
  return {
    ...frame,
    label: named ?? (route ? "This build" : undefined),
    ref: route ? undefined : publicationRef,
    author: pull?.author,
    pullRequestUrl: pull?.url,
    status: buildReads[watch?.status ?? "loading"],
  };
}
