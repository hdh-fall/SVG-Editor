import type { SvgDocument } from '../model/SvgDocument';
import type { FileStore } from '../io/FileStore';
import type { ShapeFactory } from '../shapes/ShapeFactory';

/**
 * Everything a command is allowed to touch. Deliberately does NOT expose the
 * undo stack — commands must stay independent of history (design §1.4).
 */
export interface AppContext {
  getDocument(): SvgDocument | null;
  requireDocument(): SvgDocument;
  setDocument(document: SvgDocument): void;
  getSavePath(): string | null;
  setSavePath(path: string | null): void;
  readonly factory: ShapeFactory;
  readonly fileStore: FileStore;
}
