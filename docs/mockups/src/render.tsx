import type { Renderer } from "@mokly/mokly";

import { MockupDocument } from "./document";

/**
 * The catalogue's Mokly renderer. Mokly calls it around each screen render
 * and each component page render, and assembles the document around the one
 * wrapper node it returns. A registered component that a screen renders draws
 * inline inside that screen's render, so it takes the screen's wrapper,
 * palette and control theme.
 */
const render: Renderer = ({ node, entry, viewport, colorScheme }) => (
  <MockupDocument entry={entry} viewport={viewport} colorScheme={colorScheme}>
    {node}
  </MockupDocument>
);

export default render;
