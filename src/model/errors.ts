/**
 * Barrel for the domain error types.
 *
 * Each error class lives in its own file named after the class (spec §2.1:
 * one class per file); this module only re-exports them so call sites keep a
 * single import path.
 */
export { AppError } from './errors/AppError';
export { NoDocumentError } from './errors/NoDocumentError';
export { DuplicateIdError } from './errors/DuplicateIdError';
export { NoSuchShapeError } from './errors/NoSuchShapeError';
export { NoSuchContainerError } from './errors/NoSuchContainerError';
export { NotAContainerError } from './errors/NotAContainerError';
export { UnknownShapeTypeError } from './errors/UnknownShapeTypeError';
export { UnknownCommandError } from './errors/UnknownCommandError';
export { UnknownAttributeError } from './errors/UnknownAttributeError';
export { InvalidScaleFactorError } from './errors/InvalidScaleFactorError';
export { CannotUngroupTopLevelError } from './errors/CannotUngroupTopLevelError';
export { CannotUngroupCompositeError } from './errors/CannotUngroupCompositeError';
export { CannotGroupIntoDescendantError } from './errors/CannotGroupIntoDescendantError';
export { UndoNotAllowedError } from './errors/UndoNotAllowedError';
export { NothingToUndoError } from './errors/NothingToUndoError';
export { NothingToRedoError } from './errors/NothingToRedoError';
export { FileError } from './errors/FileError';
export { InvalidArgumentError } from './errors/InvalidArgumentError';
