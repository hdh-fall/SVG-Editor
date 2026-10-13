import type { AppContext } from './AppContext';
import type { Command } from './Command';
import type { HistoryCommand, HistoryFacade } from './HistoryCommand';

/** `redo`: the REPL routes this through `HistoryFacade`, never through `history.execute`. */
export class RedoCommand implements Command, HistoryCommand {
  public readonly isUndoable = false;

  public executeOn(history: HistoryFacade, ctx: AppContext): string {
    return history.redo(ctx).successMessage();
  }

  public execute(_ctx: AppContext): void {
    throw new Error('redo is performed by the session, not executed directly');
  }

  public undo(_ctx: AppContext): void {
    throw new Error('redo is not itself undoable');
  }

  public successMessage(): string {
    return 'redo';
  }

  public undoMessage(): string {
    return 'redo';
  }
}
