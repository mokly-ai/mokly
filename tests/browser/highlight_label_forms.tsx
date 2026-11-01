/**
 * A browser entry of `highlight_label_static.spec.ts`: the labels of a layer
 * as the shell's button, as a static depiction's link to an address, and as
 * its picture.
 */

import { renderToStaticMarkup } from "react-dom/server";

import { HighlightLabel, LabelLayer } from "@mokly/ui/highlight-label";

document.body.innerHTML = renderToStaticMarkup(
  <div style={{ height: 200, position: "relative", width: 400 }}>
    <LabelLayer placement="root">
      <HighlightLabel left={20} text="Toolbar · toolbar" top={20} />
      <HighlightLabel
        href="#details"
        left={20}
        text="Action · details"
        top={80}
      />
      <HighlightLabel
        interactive={false}
        left={20}
        text="Action · welcome"
        top={140}
      />
    </LabelLayer>
  </div>,
);
document.body.dataset["rendered"] = "";
