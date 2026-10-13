import type { FileStore } from './FileStore';

export class MemoryFileStore implements FileStore {
  private readonly files = new Map<string, string>();

  public read(path: string): string {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`missing file: ${path}`);
    }
    return content;
  }

  public write(path: string, content: string): void {
    this.files.set(path, content);
  }

  public exists(path: string): boolean {
    return this.files.has(path);
  }
}
