import type { AppContext } from './AppContext';

/** One edit, as an object that can reverse itself (design §1.3, Command pattern). */
export interface Command {
  /** false for document-class commands, which lock undo until the next edit (spec §4.3). */
  readonly isUndoable: boolean;
  /** Validate fully before mutating: a throwing `execute` must leave state untouched. */
  execute(ctx: AppContext): void;
  undo(ctx: AppContext): void;
  successMessage(): string;
  undoMessage(): string;
}
