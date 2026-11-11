// Context port: read-only access to the material route/design/plan are pre-loaded with
// (repository catalog, per-repo Spec Wiki, source tree and files). Spec 010 R1.
export interface ContextFile {
  path: string;
  content: string;
}

export interface ContextSource {
  /** Catalog markdown, or null if absent. */
  repositoryCatalog(): Promise<string | null>;
  /** The repo's Spec Wiki text, or null if none is configured or present. */
  specWiki(repo: string): Promise<string | null>;
  /** Repo-relative POSIX paths of tracked source files, sorted; null when no checkout is available. */
  fileTree(repo: string): Promise<string[] | null>;
  /** Reads only paths present in fileTree. Files that must not be returned (canary) are dropped. */
  readFiles(repo: string, paths: string[]): Promise<ContextFile[]>;
  /** As readFiles, but also reports gaps (e.g. `context:canary-skipped:<repo>/<path>`). */
  readFilesDetailed(repo: string, paths: string[]): Promise<{ files: ContextFile[]; gaps: string[] }>;
}
