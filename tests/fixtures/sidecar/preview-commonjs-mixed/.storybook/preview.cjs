/* global exports */

exports.default = {
  initialGlobals: { locale: "preview-locale" },
  loaders: [() => ({ message: "Loaded" })],
};

exports.parameters = {
  mokly: { colorSchemes: { dark: { theme: "dark-theme" } } },
};
