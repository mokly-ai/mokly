import { definePage } from "@mokly/mokly";

import map, * as classes from "./exports.module.css";

export default definePage({
  title: "CSS namespace",
  description: "Runtime class map exports.",
  relatedDocs: [],
  render: () =>
    JSON.stringify({
      map,
      names: Object.keys(classes).sort(),
      sameDefault: classes.default === map,
      module: classes.__esModule,
      prototype: classes.__proto__,
    }),
});
