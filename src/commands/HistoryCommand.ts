import type { AppContext } from './AppContext';
import type { Command } from './Command';

/**
 * The history operations a `HistoryCommand` needs. `HistoryManager` satisfies this
 * structurally, so defining the port here keeps `commands` free of any dependency on
 * `history` (design §1.4) — the same Ports inversion used for `FileStore`.
 */
export interface HistoryFacade {
  undo(ctx: AppContext): Command;
  redo(ctx: AppContext): Command;
}

/** A command whose whole effect is a history operation (`undo` / `redo`). */
export interface HistoryCommand {
  /** Perform the operation and return the line to print. */
  executeOn(history: HistoryFacade, ctx: AppContext): string;
}

export function isHistoryCommand(value: Command): value is Command & HistoryCommand {
  return typeof (value as Partial<HistoryCommand>).executeOn === 'function';
}
