import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { FileError } from '../model/errors';
import type { FileStore } from './FileStore';

export class NodeFileStore implements FileStore {
  public read(path: string): string {
    if (!existsSync(path)) {
      throw FileError.read(path);
    }
    try {
      return readFileSync(path, 'utf8');
    } catch {
      throw FileError.read(path);
    }
  }

  public write(path: string, content: string): void {
    try {
      writeFileSync(path, content, 'utf8');
    } catch {
      throw FileError.write(path);
    }
  }

  public exists(path: string): boolean {
    return existsSync(path);
  }
}
