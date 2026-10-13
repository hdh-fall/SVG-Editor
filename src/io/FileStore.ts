/** Port the editor depends on instead of the filesystem (design §1.3, Adapter/Ports). */
export interface FileStore {
  read(path: string): string;
  write(path: string, content: string): void;
  exists(path: string): boolean;
}
