import { createElement } from "react";

import { defineScreen } from "@mokly/mokly";

import { Button, Field, MemoButton } from "./controls.js";

const saved = <Button key="saved" label="Saved before discovery" />;

export default defineScreen({
  title: "Usage",
  description: "",
  relatedDocs: [],
  render() {
    const spread = { label: "Key after spread" };
    return (
      <>
        <MemoButton
          key="Café / Save"
          id="original-id"
          label="Memo"
          onLabel={() => "Original callback"}
        />
        <Button label="First" />
        <Button label="Second" />
        <Button key={2} label="Conflicts with the number" />
        <Field key="bare" label="Forward ref's inner component" />
        {saved}
        {createElement(Button, { label: "Created directly" })}
        <Button {...spread} key="ignored" />
      </>
    );
  },
});
