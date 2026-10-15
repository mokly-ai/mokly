import { defineScreen } from "@mokly/mokly";

import classes, {
  __esModule,
  café,
  constructor as constructorClass,
} from "./exports.module.css";

export default defineScreen({
  title: "CSS exports",
  description: "CSS namespace interop.",
  relatedDocs: [],
  render: () => (
    <main
      className={[classes.__esModule, __esModule, constructorClass, café].join(
        " ",
      )}
    >
      Maps
    </main>
  ),
});
