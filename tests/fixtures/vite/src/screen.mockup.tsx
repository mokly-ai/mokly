import message from "@fixture/message";

import { defineScreen } from "@mokly/mokly";

import Icon from "./mark.svg?react";
import raw from "./message.txt?raw";
import "./screen.css";
import classes from "./screen.module.css";

export const lazy = () => import("./lazy.js");

export const screen = defineScreen({
  path: "vite",
  title: "Vite screen",
  description: "A screen compiled through the app setup.",
  relatedDocs: [],
  render: () => (
    <section className={classes.screen}>
      <h1>{message}</h1>
      <p>{import.meta.env.VITE_FIXTURE_VALUE}</p>
      <pre>{raw}</pre>
      <Icon data-vite-icon="svgr" />
    </section>
  ),
});
