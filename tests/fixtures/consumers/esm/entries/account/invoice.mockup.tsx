import React from "react";

import { defineScreen } from "@mokly/mokly";

export default defineScreen({
  dependencies: ["notes.md"],
  relatedDocs: ["notes.md"],
  title: "Invoice",
  description: "A packed entry whose directory and filename supply its path.",
  mobile: <main data-packed-derived="mobile">Invoice</main>,
  desktop: <main data-packed-derived="desktop">Invoice</main>,
});
