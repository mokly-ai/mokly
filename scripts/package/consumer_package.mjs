/** Build a consumer manifest that installs both real packed archives. */
export function consumerPackage(name, context, installMokly) {
  return {
    name,
    private: true,
    type: "module",
    dependencies: {
      "@mokly/viewer": `file:${context.viewerArchivePath}`,
      ...(installMokly
        ? { "@mokly/mokly": `file:${context.archivePath}` }
        : {}),
      react: context.versions.react,
      "react-dom": context.versions.reactDom,
    },
    devDependencies: {
      "@types/react": context.versions.reactTypes,
      "@types/react-dom": context.versions.reactDomTypes,
      typescript: context.versions.typescript,
    },
  };
}
