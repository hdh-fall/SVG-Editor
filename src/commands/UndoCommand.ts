import type { AppContext } from './AppContext';
import type { Command } from './Command';
import type { HistoryCommand, HistoryFacade } from './HistoryCommand';

/** `undo`: the REPL routes this through `HistoryFacade`, never through `history.execute`. */
export class UndoCommand implements Command, HistoryCommand {
  public readonly isUndoable = false;

  public executeOn(history: HistoryFacade, ctx: AppContext): string {
    return history.undo(ctx).undoMessage();
  }

  public execute(_ctx: AppContext): void {
    throw new Error('undo is performed by the session, not executed directly');
  }

  public undo(_ctx: AppContext): void {
    throw new Error('undo is not itself undoable');
  }

  public successMessage(): string {
    return 'undo';
  }

  public undoMessage(): string {
    return 'undo';
  }
}
