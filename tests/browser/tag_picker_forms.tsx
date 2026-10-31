/**
 * A browser entry of `tag_picker_button.spec.ts`: a closed tag picker drawn
 * with the shell's button, with a link to an address, and as a picture.
 */

import { renderToStaticMarkup } from "react-dom/server";

import { TagPicker } from "@mokly/ui/tag-picker";

const picker = {
  focusedIndex: 0,
  interactive: false,
  open: false,
  tags: [{ selected: false, tag: "forms" }],
};

document.body.innerHTML = renderToStaticMarkup(
  <>
    <TagPicker {...picker} id="button-picker" />
    <TagPicker
      {...picker}
      id="link-picker"
      operable={false}
      toggleHref="#tags"
    />
    <TagPicker {...picker} id="picture" operable={false} />
  </>,
);
document.body.dataset["rendered"] = "";
