import type { AppContext } from '../commands/AppContext';
import type { Command } from '../commands/Command';
import { NothingToRedoError, NothingToUndoError, UndoNotAllowedError } from '../model/errors';

/**
 * Owns the undo/redo stacks. Commands never see this object — it drives them
 * (design §1.4: `commands` has no dependency on `history`).
 *
 * Document-class commands (`isUndoable === false`, `isDisplay !== true`) clear both
 * stacks and lock undo until the next edit re-enables it (spec §4.3).
 */
export class HistoryManager {
  private readonly undoStack: Command[] = [];
  private readonly redoStack: Command[] = [];
  private locked = false;

  public execute(command: Command, ctx: AppContext): void {
    command.execute(ctx);

    if (command.isDisplay === true) {
      return;
    }
    if (command.isUndoable) {
      this.undoStack.push(command);
      this.redoStack.length = 0;
      this.locked = false;
      return;
    }
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.locked = true;
  }

  public undo(ctx: AppContext): Command {
    if (this.locked) {
      throw new UndoNotAllowedError();
    }
    const command = this.undoStack.pop();
    if (command === undefined) {
      throw new NothingToUndoError();
    }
    command.undo(ctx);
    this.redoStack.push(command);
    return command;
  }

  public redo(ctx: AppContext): Command {
    if (this.locked) {
      throw new UndoNotAllowedError();
    }
    const command = this.redoStack.pop();
    if (command === undefined) {
      throw new NothingToRedoError();
    }
    command.execute(ctx);
    this.undoStack.push(command);
    return command;
  }

  public canUndo(): boolean {
    return !this.locked && this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return !this.locked && this.redoStack.length > 0;
  }
}
