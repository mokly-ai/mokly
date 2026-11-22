/**
 * The Canvas code panel: dark in both schemes, with a tab bar that names
 * the code, a Copy control, and the code as lines that may carry syntax
 * token colours, line numbers or a shell prompt. The prompt and the line
 * numbers are drawn by the stylesheet, so the code's text stays exactly
 * what Copy copies.
 */

import type { ReactNode } from "react";

import { classNames } from "./class-names.js";
import { SiteIcon, type SiteIconName } from "./icons.js";

/** The syntax role of one token, which picks its colour. */
export type CodeTokenKind =
  "attr" | "fn" | "keyword" | "number" | "punct" | "string" | "type";

/** One token of a line: plain text, or text with its syntax role. */
export type CodeToken = string | readonly [CodeTokenKind, string];

/** One line of code, as its tokens in order. */
export type CodeLine = readonly CodeToken[];

/** The languages whose tab takes the terminal icon. */
const SHELLS = new Set(["bash", "console", "sh", "shell"]);

/** One line's tokens as spans, the plain ones as text. */
function Tokens({ line }: { line: CodeLine }) {
  return (
    <>
      {line.map((token, index) =>
        typeof token === "string" ? (
          token
        ) : (
          <span className={`site-code-token--${token[0]}`} key={index}>
            {token[1]}
          </span>
        ),
      )}
    </>
  );
}

/**
 * A code panel. Without `files`, its one tab names the `language`, as a
 * shell block does; with `files`, the tabs name the files, the first one
 * open, and the language sits at the bar's end. A file's name may shrink
 * and end in an ellipsis, and its text keeps the whole name. `meta` adds a
 * path or a note before Copy. The code is `code` as plain text or `lines`
 * as tokens.
 * `numbered` draws line numbers, `prompt` a `$` before each line, and
 * `dimmed` and `lit` mark lines by their 1-based numbers. `foot` holds
 * content under the code inside the panel, such as a terminal.
 */
export function CodePanel({
  className,
  code,
  copy = true,
  dimmed = [],
  files,
  foot,
  icon,
  language,
  lines,
  lit = [],
  meta,
  numbered = false,
  prompt = false,
}: {
  className?: string | undefined;
  code?: string | undefined;
  copy?: boolean | undefined;
  dimmed?: readonly number[] | undefined;
  files?: readonly string[] | undefined;
  foot?: ReactNode | undefined;
  icon?: SiteIconName | undefined;
  language: string;
  lines?: readonly CodeLine[] | undefined;
  lit?: readonly number[] | undefined;
  meta?: ReactNode | undefined;
  numbered?: boolean | undefined;
  prompt?: boolean | undefined;
}) {
  const rows: readonly CodeLine[] =
    lines ?? (code ?? "").split("\n").map((text) => [text]);
  const tabIcon =
    icon ?? (files === undefined && SHELLS.has(language) ? "terminal" : "file");
  return (
    <div
      className={classNames(
        "site-code",
        numbered && "site-code--numbered",
        prompt && "site-code--prompt",
        className,
      )}
    >
      <div className="site-code-head">
        {files === undefined ? (
          <span className="site-code-tab site-code-tab--open site-code-language">
            <SiteIcon name={tabIcon} size={13} />
            {language}
          </span>
        ) : (
          files.map((file, index) => (
            <span
              className={classNames(
                "site-code-tab",
                index === 0 && "site-code-tab--open",
              )}
              key={file}
            >
              {index === 0 ? <SiteIcon name={tabIcon} size={13} /> : null}
              <span className="site-code-tab-name">{file}</span>
            </span>
          ))
        )}
        {meta === undefined ? null : (
          <span className="site-code-meta">{meta}</span>
        )}
        {files === undefined ? null : (
          <span className="site-code-language site-code-language--end">
            {language}
          </span>
        )}
        {copy ? (
          <button className="site-code-copy" type="button">
            <SiteIcon name="copy" size={14} />
            Copy
          </button>
        ) : null}
      </div>
      <pre className="site-code-body">
        <code>
          {rows.map((line, index) => (
            <span
              className={classNames(
                "site-code-line",
                dimmed.includes(index + 1) && "site-code-line--dim",
                lit.includes(index + 1) && "site-code-line--lit",
              )}
              key={index}
            >
              <Tokens line={line} />
            </span>
          ))}
        </code>
      </pre>
      {foot}
    </div>
  );
}
