import { CSS_CHROME_DEVICES } from "./css_chrome_devices.js";
import { CSS_CHROME_EXPANSION } from "./css_chrome_expansion.js";
import { CSS_CHROME_FLOW } from "./css_chrome_flow.js";

/** Complete chrome styles, shared by static and embedded shells. */
export const SHELL_CHROME_CSS =
  CSS_CHROME_DEVICES + CSS_CHROME_EXPANSION + CSS_CHROME_FLOW;
