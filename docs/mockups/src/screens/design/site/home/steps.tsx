/**
 * The three steps that close the open foundation, drawn as a flow of
 * frames: each step's number and icon, its heading and its line, with an
 * arrow from each frame to the next.
 */

import { SiteIcon, type SiteIconName } from "../parts/icons.js";

const STEPS: ReadonlyArray<{
  body: string;
  icon: SiteIconName;
  title: string;
}> = [
  {
    body: "Author with React and your shared components.",
    icon: "pencil",
    title: "Shape the next screen.",
  },
  {
    body: "Open the pull request check to review the screens that changed.",
    icon: "branch",
    title: "Publish the branch.",
  },
  {
    body: "Keep comments and approvals with the pull request.",
    icon: "checkCircle",
    title: "Build from a shared decision.",
  },
];

/** The steps, in order. */
export function Steps() {
  return (
    <ol className="site-steps">
      {STEPS.map((step, index) => (
        <li className="site-step" key={step.title}>
          <span className="site-step-number">0{index + 1}</span>
          <SiteIcon
            className="site-home-step-icon"
            name={step.icon}
            size={20}
          />
          <h3>{step.title}</h3>
          <p>{step.body}</p>
        </li>
      ))}
    </ol>
  );
}
