/**
 * The upgrade notes of a release: the last group on its rail, a closed
 * document row that names the notes, lists their topics and counts them, and
 * opens to the notes themselves. The notes keep the changelog's words, with
 * code spans kept and links drawn as text, because no mockup owns their
 * pages. Each `####` topic is a section of the shared document typography.
 */

import type { ReactNode } from "react";

import { counted, groupId, upgradeTopics } from "./changelog-facts.js";
import { NoteText } from "./changelog-note.js";
import { SiteIcon } from "./icons.js";
import type { Release } from "./release.js";

/** The heading prefixes and the list item prefix of the notes' Markdown. */
const TOPIC = "#### ";
const SUBTOPIC = "##### ";
const ITEM = "- ";

/** The notes split into topics, each starting with its `####` heading. */
function topics(blocks: readonly string[]): string[][] {
  const found: string[][] = [];
  for (const block of blocks)
    if (block.startsWith(TOPIC) || found.length === 0) found.push([block]);
    else found.at(-1)?.push(block);
  return found;
}

/** One topic: its heading, then its sub-headings, paragraphs and lists. */
function UpgradeTopic({ blocks }: { blocks: readonly string[] }) {
  const [heading = "", ...rest] = blocks;
  const children: ReactNode[] = [];
  let items: string[] = [];
  const closeList = () => {
    if (items.length > 0)
      children.push(
        <ul key={items[0]}>
          {items.map((item) => (
            <li key={item}>
              <NoteText text={item} />
            </li>
          ))}
        </ul>,
      );
    items = [];
  };
  for (const block of rest) {
    if (block.startsWith(ITEM)) {
      items.push(block.slice(ITEM.length));
      continue;
    }
    closeList();
    children.push(
      block.startsWith(SUBTOPIC) ? (
        <h5 key={block}>
          <NoteText text={block.slice(SUBTOPIC.length)} />
        </h5>
      ) : (
        <p key={block}>
          <NoteText text={block} />
        </p>
      ),
    );
  }
  closeList();
  return (
    <section>
      <h4>
        <NoteText text={heading.replace(TOPIC, "")} />
      </h4>
      {children}
    </section>
  );
}

/** The upgrade notes group, or nothing when the release publishes none. */
export function ReleaseUpgrade({ release }: { release: Release }) {
  if (release.upgrade === undefined) return null;
  const names = upgradeTopics(release);
  return (
    <section
      className="site-release-group site-release-group--upgrade"
      id={groupId(release, "upgrade")}
    >
      <div className="site-release-group-head">
        <h3 className="site-release-group-title">
          <SiteIcon name="doc" />
          <span>Upgrade notes</span>
        </h3>
      </div>
      <details className="site-release-details site-release-upgrade">
        <summary className="site-release-summary site-release-upgrade-summary">
          <span className="site-release-upgrade-main">
            <span className="site-release-upgrade-name">
              Upgrade notes for {release.version}
            </span>
            <span className="site-release-upgrade-topics">
              {names.join(" · ")}
            </span>
          </span>
          <span className="site-release-upgrade-count">
            {counted(names.length, "note")}
          </span>
          <span className="site-button site-button--secondary site-release-toggle">
            <span className="site-release-when-closed">Read</span>
            <span className="site-release-when-open">Hide</span>
            <SiteIcon
              className="site-release-chevron"
              name="chevronDown"
              size={15}
            />
          </span>
        </summary>
        <div className="site-document-body site-release-upgrade-body">
          {topics(release.upgrade).map((topic) => (
            <UpgradeTopic blocks={topic} key={topic[0]} />
          ))}
        </div>
      </details>
    </section>
  );
}
