import type { AppContext } from './AppContext';

/** One edit, as an object that can reverse itself (design §1.3, Command pattern). */
export interface Command {
  /** false for document-class commands, which lock undo until the next edit (spec §4.3). */
  readonly isUndoable: boolean;
  /**
   * true for read-only display commands (tree / show / help, bare canvas).
   * They execute but never enter, clear, or lock the undo stacks (spec §4.3).
   */
  readonly isDisplay?: boolean;
  /** Extra lines to print before the success message (e.g. `read` auto-id warnings). */
  warnings?(): readonly string[];
  /** Validate fully before mutating: a throwing `execute` must leave state untouched. */
  execute(ctx: AppContext): void;
  undo(ctx: AppContext): void;
  successMessage(): string;
  undoMessage(): string;
}
