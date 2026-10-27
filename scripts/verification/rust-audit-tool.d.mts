/** Repository-relative directory that holds every installed tool identity. */
export const RUST_AUDIT_TOOL_DIRECTORY: string;

/** Repository-relative reviewed dependency lock of the tool. */
export const RUST_AUDIT_TOOL_LOCK: string;

/** Exact released tool source and its crates.io archive digest. */
export interface RustAuditPin {
  version: string;
  checksum: string;
}

/** Process outcome from the owned verification process adapter. */
export interface RustAuditOutcome {
  exitCode: number | null;
  signal?: NodeJS.Signals | null;
  interrupted?: NodeJS.Signals | null;
}

/** Filesystem, network, archive and process boundaries for tool preparation. */
export interface RustAuditToolDependencies {
  target: string;
  executable: string;
  read(file: string): Promise<string>;
  write(file: string, contents: string | Buffer): Promise<void>;
  exists(file: string): Promise<boolean>;
  temporary(prefix: string): Promise<string>;
  download(url: string): Promise<Buffer>;
  extract(archive: string, destination: string): Promise<void>;
  remove(directory: string): Promise<void>;
  run(file: string, args: string[]): Promise<RustAuditOutcome>;
}

/** Build the pinned source with reviewed dependencies, or reuse that exact tool. */
export function ensureRustAuditTool(
  root: string,
  pin?: RustAuditPin,
  dependencies?: RustAuditToolDependencies,
): Promise<string>;
