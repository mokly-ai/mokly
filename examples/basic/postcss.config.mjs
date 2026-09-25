import tailwindcss from "@tailwindcss/postcss";
import autoprefixer from "autoprefixer";

process.env.BROWSERSLIST_IGNORE_OLD_DATA ??= "1";

export default {
  plugins: [
    tailwindcss({ base: import.meta.dirname, optimize: false }),
    autoprefixer({ overrideBrowserslist: ["Safari 14"] }),
  ],
};
