import { SkeletonCircle } from "@firna/ui/skeleton";

import { displayName } from "../api/labels";
import type { User } from "../api/types";
import { site } from "../config";
import { PersonAvatar } from "./controls";
import { TextBar } from "./placeholders";

/** The Mokly mark, shared by the product chrome and account entry. */
export function MoklyMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <rect
        x="3"
        y="3"
        width="20"
        height="21"
        rx="4"
        fill="currentColor"
        opacity=".3"
      />
      <rect x="9" y="8" width="20" height="21" rx="4" fill="currentColor" />
      <path
        d="M14 15h10M14 20h7"
        stroke="var(--mk-color-surface)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Wordmark() {
  return (
    <>
      <MoklyMark size={22} />
      <span>
        mokly<span className="review-period">.</span>
      </span>
    </>
  );
}

/**
 * Inside the product the mark is the identity of the surface, not a
 * destination: every product route already resolves into the viewer.
 */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="review-brand">
      {compact ? <MoklyMark size={22} /> : <Wordmark />}
    </span>
  );
}

/** Logged out, the mark leaves for the public site's home. */
export function SiteBrand() {
  return (
    <a className="review-brand" href={site.home} aria-label="Mokly home">
      <Wordmark />
    </a>
  );
}

/** The diameter of the identity's avatar, in px, which its placeholder keeps. */
const identityAvatar = 26;

/**
 * The signed-in identity shown in the account shell's header, by the same
 * rule as the viewer's account trigger: a reader who has set a name is called
 * by it, with their address one hover away as the tooltip, and a reader who
 * has not is called by their address, which is already the whole value.
 */
export function AccountIdentity({ user }: { user: User }) {
  const name = displayName(user);
  return (
    <div className="review-account" title={name ? user.email : undefined}>
      <PersonAvatar name={name ?? user.email} size={identityAvatar} />
      <span>{name ?? user.email}</span>
    </div>
  );
}

/**
 * The identity while the session read that supplies it runs: the avatar at
 * its own size and a bar in the name's line box, in the identity's own frame.
 * Like every placeholder it is hidden from assistive technology.
 */
export function AccountIdentityPlaceholder() {
  return (
    <div className="review-account" aria-hidden="true">
      <SkeletonCircle diameter={identityAvatar} />
      <TextBar width="2.5em" />
    </div>
  );
}
