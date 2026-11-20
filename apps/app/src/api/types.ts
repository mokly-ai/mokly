import type { components } from "./generated/schema";

type Schemas = components["schemas"];

/** The signed-in person, their CSRF token and the workspaces they can read. */
export type Session = Schemas["Session"];
/** The signed-in person. */
export type User = Schemas["User"];
/** A workspace the reader belongs to, with their role in it. */
export type Workspace = Schemas["Workspace"];
/** The plan a workspace is on. */
export type Plan = Schemas["Plan"];
/** One workspace's plan, seat usage and subscription facts. */
export type Billing = Schemas["Billing"];
/** One seat kind's count in use and its verified monthly unit amount. */
export type SeatUsage = Schemas["SeatUsage"];
/** The kind of seat a role occupies. */
export type SeatKind = Schemas["SeatKind"];
/** What Stripe reports about the workspace's one subscription. */
export type Subscription = Schemas["Subscription"];
/** A workspace resolved by current or retired slug. */
export type WorkspaceSlugLookup = Schemas["WorkspaceSlugLookup"];
/** A member or pending invitation of a workspace. */
export type Member = Schemas["Member"];
/** A project: one workspace, one repository and one config path. */
export type Project = Schemas["Project"];
/** A project resolved by current or retired workspace/project slugs. */
export type ProjectSlugLookup = Schemas["ProjectSlugLookup"];
/** What a project is created from: an installed repository or a CLI identity. */
export type CreateProject = Schemas["CreateProject"];
/** The input field a `slug-taken` or `slug-reserved` refusal names. */
export type SlugField = Schemas["SlugField"];
/** Direct or inherited access to one project. */
export type ProjectGrant = Schemas["ProjectGrant"];
/** Publishing token metadata; the secret is returned only once, on creation. */
export type Token = Schemas["Token"];
/** A created token and the one-time secret beside it. */
export type TokenCreated = Schemas["TokenCreated"];
/** An installed repository the GitHub App can read. */
export type Repository = Schemas["Repository"];
/** A GitHub App installation on one account. */
export type Installation = Schemas["Installation"];
/** A branch of the project's repository, with its newest ready publication. */
export type Branch = Schemas["Branch"];
/** A pull request of the bound repository, with its newest ready publication. */
export type PullRequest = Schemas["PullRequest"];
/** One immutable publication attempt and what the stage can do with it. */
export type Publication = Schemas["Publication"];
/** A reference's newest attempt in any state, as its own row carries it. */
export type PublicationSummary = Schemas["PublicationSummary"];
/** The pull request one publication came from, as the publication carries it. */
export type PublicationPullRequest = Schemas["PublicationPullRequest"];
/** What a publication's comparison counted, or why it counted nothing. */
export type Changes = Schemas["Changes"];
/** One current screen of a ready publication and the views it supports. */
export type Screen = Schemas["Screen"];
/** A canonical publication link and who can open it. */
export type ShareLink = Schemas["ShareLink"];
/** A one-use catalogue grant and the publication host that consumes it. */
export type AccessGrant = Schemas["AccessGrant"];
/** One cloud build: its reference, head, state and the step it reached. */
export type Build = Schemas["Build"];
/** A build's lifecycle state. */
export type BuildState = Schemas["BuildState"];
/** The step a build is running, or the step a failure stopped in. */
export type BuildStep = Schemas["BuildStep"];
/** Why a failed or timed-out build ended. */
export type BuildFailure = Schemas["BuildFailure"];
/** Why a requested pull request cannot build, as `build-ineligible` names it. */
export type IneligibleCause = Schemas["IneligibleCause"];
/** A reference's newest build in any state, as its own row carries it. */
export type BuildSummary = Schemas["BuildSummary"];
/** One window of a build's retained log, read after a sequence. */
export type BuildLog = Schemas["BuildLog"];
/** One stored chunk of a build's log, as text the reader can show. */
export type BuildLogChunk = Schemas["BuildLogChunk"];
/** Where retained output was dropped, and how many bytes went. */
export type BuildLogElision = Schemas["BuildLogElision"];
/** One entry of a reference's history: a publication or a build. */
export type HistoryEntry = Schemas["HistoryEntry"];
/** The result of issuing a sign-in link. */
export type MagicLinkResult = Schemas["MagicLinkResult"];
/** A provider authorization URL and the tab-scoped values that bind it. */
export type Connection = Schemas["Connection"];
/** The session issued by consuming a sign-in link, with its destination. */
export type SessionIssued = Schemas["SessionIssued"];
/** What the connect page sends for a desktop grant: the challenge and `returnTo`. */
export type DesktopGrantRequest = Schemas["DesktopGrantRequest"];
/** A one-use desktop grant and when it expires. */
export type DesktopGrantResult = Schemas["DesktopGrantResult"];
/** What the desktop landing exchanges: the grant and the window's verifier. */
export type DesktopGrantCallback = Schemas["DesktopGrantCallback"];

/** Workspace roles, strongest first. */
export type Role = Workspace["role"];
/** The roles a project grant may carry. */
export type GrantRole = ProjectGrant["role"];
/** Whether publications are readable by anyone with a link. */
export type Visibility = Project["visibility"];
