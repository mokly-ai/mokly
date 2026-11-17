const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

// The viewer's root module needs no package-import condition, so this is
// Expo's resolver with the two workspace module roots and hierarchical lookup
// disabled; nothing deep-imports package rendering code. Metro watches the
// root modules and the workspace packages they link to, not the whole
// repository, whose Rust build output is large.
const config = getDefaultConfig(projectRoot);
config.watchFolders = [
  path.resolve(workspaceRoot, "node_modules"),
  path.resolve(workspaceRoot, "packages"),
];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
