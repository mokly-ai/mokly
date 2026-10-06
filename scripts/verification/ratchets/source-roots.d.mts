/** Source directories for the configured CLI layout. */
export const SOURCE_ROOTS: string[];

/** Source directories for root or workspace layouts, without duplicates. */
export function sourceRoots(packagePath?: string): string[];
