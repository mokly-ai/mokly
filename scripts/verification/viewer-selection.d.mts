export interface UnitFileArgument {
  argument: string;
  file: string;
}

export interface UnitSelection {
  files: readonly UnitFileArgument[];
  patterns: readonly string[];
  selected: boolean;
}

/** Validate syntax and filesystem paths before discovering the inventory. */
export function parseViewerSelection(
  repositoryRoot: string,
  argv: readonly string[],
  environment?: Readonly<Record<string, string | undefined>>,
): Promise<UnitSelection>;

/** Require inventory membership and return each selected file once. */
export function selectViewerFiles(
  selection: UnitSelection,
  inventory: readonly string[],
): string[];
