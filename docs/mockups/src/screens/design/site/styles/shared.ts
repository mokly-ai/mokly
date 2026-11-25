/**
 * The site stylesheets that every site screen shares, in cascade order: the
 * foundations, the buttons, the Canvas parts, the labels, the people, the
 * panels, the code panel, the document typography, the chrome, the menu and
 * the footer. Each site screen module imports this module, then the style
 * module of its own area, before its other imports. So Mokly bundles these
 * sheets first in the screen's own stylesheet, after the font sheets that
 * the site rule of `mokly.config.json` links.
 */

import "../../../../../styles/site/base.css";
import "../../../../../styles/site/buttons.css";
import "../../../../../styles/site/canvas.css";
import "../../../../../styles/site/canvas-tags.css";
import "../../../../../styles/site/labels.css";
import "../../../../../styles/site/people.css";
import "../../../../../styles/site/panels.css";
import "../../../../../styles/site/code.css";
import "../../../../../styles/site/prose.css";
import "../../../../../styles/site/chrome.css";
import "../../../../../styles/site/menu.css";
import "../../../../../styles/site/footer.css";
