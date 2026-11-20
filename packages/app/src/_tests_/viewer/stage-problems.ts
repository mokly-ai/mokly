import { ApiError, unexpectedError } from "../../api/errors";
import { apiReasons } from "../../api/reasons";
import type { Build, Project } from "../../api/types";
import { formFailure } from "../../components/form-failure";
import { awaitsOwnerAction, buildAction } from "../../viewer/build-action";
import type { BuildAction } from "../../viewer/build-action";
import { buildLine } from "../../viewer/build-copy";
import type { BuildLine } from "../../viewer/build-copy";
import { refusedLabel, requestControls } from "../../viewer/request-controls";
import type { RequestControl } from "../../viewer/request-controls";
import {
  planRefusalFailure,
  unpublishedStage,
} from "../../viewer/stage-view-decision";
import type { UnpublishedStage } from "../../viewer/stage-view-decision";
import type { WorkspaceRole } from "../../viewer/workspace-role";
import { workspaceRole } from "../../viewer/workspace-role";

import {
  closingsOf,
  flags,
  forksOf,
  projects,
  reads,
  references,
  shownBuilds,
} from "./stage-cases";
import type { ReferenceKind } from "./stage-cases";

/**
 * What the stage drawing test reports against one inventory: every card the
 * empty stage chooses, every body a build card shows and every way a request
 * control reads after a refusal, each with the drawing it maps to. The
 * mappings themselves stay in the test, typed by the application's own
 * unions.
 */

/** Why one drawing path is not a drawing of an inventory, if it is not. */
export function undrawn(path: string, drawings: ReadonlySet<string>): string[] {
  return drawings.has(path)
    ? []
    : [path + " is not a drawing in the product inventory"];
}

/** An inventory that lost one of its drawings. */
export function without(
  drawings: ReadonlySet<string>,
  lost: string,
): ReadonlySet<string> {
  return new Set([...drawings].filter((path) => path !== lost));
}

/**
 * One card the empty stage draws. Two cards draw a different body for the
 * reader they offer it to, and each body has its own drawing: the plan card
 * for an owner and for everyone else, and Set up publishing for an
 * administrator and for everyone else. The closed pull request card draws a
 * different title for each way a pull request closes, and each has its own
 * drawing too.
 */
export type CardCase =
  | Exclude<
      UnpublishedStage["kind"],
      "plan-required" | "set-up" | "closed-pull-request"
    >
  | "plan-required owner"
  | "plan-required reader"
  | "set-up administrator"
  | "set-up reader"
  | "closed-pull-request closed"
  | "closed-pull-request merged";

/** The card one decision draws, with the reader its body is for. */
function cardCase(stage: UnpublishedStage, project: Project): CardCase {
  if (stage.kind === "plan-required") {
    return stage.canUpgrade ? "plan-required owner" : "plan-required reader";
  }
  if (stage.kind === "set-up") {
    return project.canAdmin ? "set-up administrator" : "set-up reader";
  }
  if (stage.kind === "closed-pull-request") {
    return stage.state === "merged"
      ? "closed-pull-request merged"
      : "closed-pull-request closed";
  }
  return stage.kind;
}

/**
 * What one card mapping gets wrong against one inventory: a card a reference
 * reaches with no drawing, a drawing the inventory does not declare, and a
 * mapped card no reference reaches, which maps a card the decision no longer
 * returns.
 */
export function cardProblems(
  drawings: ReadonlySet<string>,
  mapping: Readonly<Record<CardCase, Partial<Record<ReferenceKind, string>>>>,
): string[] {
  const reached = new Set<string>();
  const problems: string[] = [];
  for (const { kind, reference } of references)
    for (const each of projects)
      for (const read of reads)
        for (const member of flags)
          for (const closed of closingsOf(kind))
            for (const fork of forksOf(kind)) {
              const stage = unpublishedStage(
                each,
                read,
                kind === "pull-request",
                { reference, member, closed, fork },
              );
              const card = cardCase(stage, each);
              const drawing = mapping[card][kind];
              if (drawing === undefined) {
                problems.push(card + " for a " + kind + " has no drawing");
                continue;
              }
              reached.add(card + "|" + kind);
              problems.push(...undrawn(drawing, drawings));
            }
  for (const [card, mapped] of Object.entries(mapping))
    for (const kind of Object.keys(mapped))
      if (!reached.has(card + "|" + kind))
        problems.push(
          card + " for a " + kind + " is mapped but no reference reaches it",
        );
  return [...new Set(problems)];
}

/**
 * What a build card's action place holds: its one action by kind, the
 * owner's action as a placeholder while the workspace read decides who the
 * reader is, or none.
 */
export type ActionCase = BuildAction["kind"] | "placeholder" | "none";

/** The kind of line beneath a build card's title, or none. */
export type LineCase = BuildLine["kind"] | "none";

/** What one card's action place holds, from the card's own two rules. */
function actionCase(
  subject: Build,
  canRequestBuilds: boolean,
  role: WorkspaceRole,
): ActionCase {
  const action = buildAction(subject, { canRequestBuilds }, role);
  if (action) return action.kind;
  return awaitsOwnerAction(subject, role) ? "placeholder" : "none";
}

/**
 * Every body a build card shows: what its action place holds and its line's
 * kind, for every build the lifecycle allows, every reader's project and every
 * workspace read. A plan refusal whose workspace read failed is not a
 * body: the workspace's own card replaces it.
 */
export function shownBodies(): Set<string> {
  const shown = new Set<string>();
  for (const subject of shownBuilds())
    for (const canRequestBuilds of flags)
      for (const read of reads) {
        const role = workspaceRole(read);
        if (planRefusalFailure(subject, role)) continue;
        const action = actionCase(subject, canRequestBuilds, role);
        const line = buildLine(subject, role);
        shown.add(action + "|" + (line?.kind ?? "none"));
      }
  return shown;
}

/**
 * What one body mapping gets wrong against one inventory: a body a card shows
 * with no drawing, a drawing the inventory does not declare, and a mapped body
 * no card shows.
 */
export function bodyProblems(
  drawings: ReadonlySet<string>,
  mapping: Readonly<Record<ActionCase, Partial<Record<LineCase, string>>>>,
): string[] {
  const shown = shownBodies();
  const problems: string[] = [];
  for (const body of shown) {
    const [action, line] = body.split("|") as [ActionCase, LineCase];
    const drawing = mapping[action]?.[line];
    if (drawing === undefined)
      problems.push(body + " is shown but has no drawing");
    else problems.push(...undrawn(drawing, drawings));
  }
  for (const [action, lines] of Object.entries(mapping))
    for (const line of Object.keys(lines))
      if (!shown.has(action + "|" + line))
        problems.push(action + "|" + line + " is mapped but no card shows it");
  return [...new Set(problems)];
}

/**
 * How a refused request's control reads beside its refusal: the shared way
 * back, or its own label, where it would be refused again or where its own
 * rule keeps it.
 */
export type RefusalCase = "way-back" | "own-label";

/**
 * What a request control reads where the same request could succeed after a
 * refusal or failure. The application's rule is `refusedLabel`; a rejection
 * case passes another to see what the test reports.
 */
export type LabelRule = (control: RequestControl, resting: string) => string;

/**
 * Every refusal or failure a request control can be answered with: each reason
 * the API catalogues, and a failure raised in the browser. The two answers that
 * name what already answers for the head open it instead of a refusal, so they
 * are not cases.
 */
function refusals(): ApiError[] {
  const refused = apiReasons
    .filter(
      (reason) =>
        reason !== "build-already-active" &&
        reason !== "build-already-published",
    )
    .map(
      (reason) =>
        new ApiError({
          code: "failed-precondition",
          reason,
          message: "Refused.",
          requestId: "request",
          status: 400,
        }),
    );
  return [...refused, unexpectedError()];
}

/**
 * Every way one request control reads beside a refusal or failure of its own
 * request, under a label rule.
 */
export function refusalCases(
  control: RequestControl,
  rule: LabelRule = refusedLabel,
): Set<RefusalCase> {
  const shown = new Set<RefusalCase>();
  for (const error of refusals()) {
    const label = formFailure({ pending: false, error }, {}).label(
      "resting",
      "working",
      rule(control, "resting"),
    );
    shown.add(label === "resting" ? "own-label" : "way-back");
  }
  return shown;
}

/**
 * What one refusal mapping gets wrong against one inventory, for every request
 * control the application's cards offer: a way a refused control reads with no
 * drawing, a drawing the inventory does not declare, and a mapped way no
 * refusal reads.
 */
export function refusalProblems(
  drawings: ReadonlySet<string>,
  mapping: Readonly<
    Record<RequestControl, Partial<Record<RefusalCase, string>>>
  >,
  rule: LabelRule = refusedLabel,
): string[] {
  const problems: string[] = [];
  for (const control of Object.keys(requestControls) as RequestControl[]) {
    const shown = refusalCases(control, rule);
    const mapped: Partial<Record<string, string>> = mapping[control];
    for (const each of shown) {
      const drawing = mapped[each];
      if (drawing === undefined)
        problems.push(
          control + " refused with its " + each + " has no drawing",
        );
      else problems.push(...undrawn(drawing, drawings));
    }
    for (const each of Object.keys(mapped))
      if (!shown.has(each as RefusalCase))
        problems.push(
          control +
            " refused with its " +
            each +
            " is mapped but no refusal reads so",
        );
  }
  return [...new Set(problems)];
}
