import { SvgDocument } from '../../src/model/SvgDocument';
import { MemoryFileStore } from '../../src/io/MemoryFileStore';
import { createDefaultShapeFactory } from '../../src/shapes/ShapeFactory';
import type { AppContext } from '../../src/commands/AppContext';
import { NoDocumentError } from '../../src/model/errors';

export function makeContext(width = 800, height = 600): AppContext {
  let document: SvgDocument | null = new SvgDocument(width, height);
  let savePath: string | null = null;
  return {
    getDocument: () => document,
    requireDocument: () => {
      if (document === null) throw new NoDocumentError();
      return document;
    },
    setDocument: (next) => {
      document = next;
    },
    getSavePath: () => savePath,
    setSavePath: (path) => {
      savePath = path;
    },
    factory: createDefaultShapeFactory(),
    fileStore: new MemoryFileStore(),
  };
}

/** A context with no document yet, for `init` / `read` tests. */
export function emptyContext(): AppContext {
  let document: SvgDocument | null = null;
  let savePath: string | null = null;
  return {
    getDocument: () => document,
    requireDocument: () => {
      if (document === null) throw new NoDocumentError();
      return document;
    },
    setDocument: (next) => {
      document = next;
    },
    getSavePath: () => savePath,
    setSavePath: (path) => {
      savePath = path;
    },
    factory: createDefaultShapeFactory(),
    fileStore: new MemoryFileStore(),
  };
}
