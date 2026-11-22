/** Plan-only consumers receive snapshots from reads that capture already performs. */
export interface PhysicalInputObserver {
  path(file: string): void;
  directory(lexical: string, canonical: string): void;
  link(lexical: string, canonical: string): void;
  metadata(file: string, bytes: Buffer): void;
}
