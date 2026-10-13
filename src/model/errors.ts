/** Base class for every error whose message is meant to be shown to the user verbatim. */
export class AppError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class NoDocumentError extends AppError {
  public constructor() {
    super("no document. use 'init' or 'read' first");
  }
}

export class DuplicateIdError extends AppError {
  public constructor(id: string) {
    super(`id already exists: ${id}`);
  }
}

export class NoSuchShapeError extends AppError {
  public constructor(id: string) {
    super(`no such shape: ${id}`);
  }
}

export class NoSuchContainerError extends AppError {
  public constructor(id: string) {
    super(`no such container: ${id}`);
  }
}

export class NotAContainerError extends AppError {
  public constructor(id: string) {
    super(`not a container: ${id}`);
  }
}

export class UnknownShapeTypeError extends AppError {
  public constructor(type: string) {
    super(`unknown shape type: ${type} (is the plugin loaded?)`);
  }
}

export class UnknownAttributeError extends AppError {
  public constructor(attr: string) {
    super(`unknown attribute: ${attr}`);
  }
}

export class InvalidScaleFactorError extends AppError {
  public constructor() {
    super('scale factor must be positive');
  }
}

export class CannotUngroupTopLevelError extends AppError {
  public constructor(id: string) {
    super(`cannot ungroup top-level container: ${id}`);
  }
}

export class CannotUngroupCompositeError extends AppError {
  public constructor(id: string) {
    super(`cannot ungroup composite shape: ${id}`);
  }
}

export class CannotGroupIntoDescendantError extends AppError {
  public constructor(id: string) {
    super(`cannot group a container into its own descendant: ${id}`);
  }
}

export class UndoNotAllowedError extends AppError {
  public constructor() {
    super('undo not allowed after io command');
  }
}

export class NothingToUndoError extends AppError {
  public constructor() {
    super('nothing to undo');
  }
}

export class NothingToRedoError extends AppError {
  public constructor() {
    super('nothing to redo');
  }
}

export class FileError extends AppError {
  public static read(file: string): FileError {
    return new FileError(`cannot read file: ${file}`);
  }

  public static write(file: string): FileError {
    return new FileError(`cannot write file: ${file}`);
  }
}

export class InvalidArgumentError extends AppError {
  public constructor(detail: string) {
    super(`invalid argument: ${detail}`);
  }
}
