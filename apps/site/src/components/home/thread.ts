/**
 * The comment thread of the home's Review frame, pinned to the PriceCard of
 * the depicted acme pricing screen: Maya's note and Sam's answer, oldest
 * first. `Thread.astro` draws them, and the Review demo shows them one
 * after the other. The team and its words are a depiction.
 */
import type { Person } from "../people.js";

/** One message of the thread. */
export interface ThreadMessage {
  /** How long ago the message was sent, such as `2m`. */
  readonly age: string;
  /** Who sent it: `people.ts` holds the name and the avatar's colour. */
  readonly person: Person;
  /** The sender's role on the team, such as `Design`. */
  readonly role: string;
  readonly text: string;
}

/** The thread's messages, oldest first. */
export const THREAD_MESSAGES: readonly ThreadMessage[] = [
  {
    age: "2m",
    person: "maya",
    role: "Design",
    text: "Padding feels tight on mobile.",
  },
  // status: "ahead" (agent sessions, Claude)
  {
    age: "1m",
    person: "sam",
    role: "Engineering",
    text: "Agreed. Let’s ask Claude for 24.",
  },
];
