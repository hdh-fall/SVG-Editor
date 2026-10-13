import { AddToCommand } from './AddToCommand';
import { CanvasCommand } from './CanvasCommand';
import { CommandRegistry } from './CommandRegistry';
import { CreateCommand } from './CreateCommand';
import { DeleteCommand } from './DeleteCommand';
import { GroupCommand } from './GroupCommand';
import { HelpCommand } from './HelpCommand';
import type { HistoryFacade } from './HistoryCommand';
import { InitCommand } from './InitCommand';
import { MoveCommand } from './MoveCommand';
import { ReadCommand } from './ReadCommand';
import { RedoCommand } from './RedoCommand';
import { SaveCommand } from './SaveCommand';
import { ScaleCommand } from './ScaleCommand';
import { SetCommand } from './SetCommand';
import { ShowCommand } from './ShowCommand';
import { TreeCommand } from './TreeCommand';
import { UngroupCommand } from './UngroupCommand';
import { UndoCommand } from './UndoCommand';
import { ZOrderCommand } from './ZOrderCommand';

/**
 * Wires every command name to its builder — dispatch point #1 of 2 (spec §2.1).
 * `history` is injected only for `undo` / `redo`; no editing command receives it.
 */
export function createDefaultCommandRegistry(_history: HistoryFacade): CommandRegistry {
  const registry = new CommandRegistry();

  registry.register('init', InitCommand.fromArgs);
  registry.register('read', ReadCommand.fromArgs);
  registry.register('save', SaveCommand.fromArgs);
  registry.register('canvas', CanvasCommand.fromArgs);

  registry.register('create', CreateCommand.fromArgs);
  registry.register('delete', DeleteCommand.fromArgs);
  registry.register('move', MoveCommand.fromArgs);
  registry.register('scale', ScaleCommand.fromArgs);
  registry.register('set', SetCommand.fromArgs);
  registry.register('group', GroupCommand.fromArgs);
  registry.register('ungroup', UngroupCommand.fromArgs);
  registry.register('addto', AddToCommand.fromArgs);
  registry.register('front', ZOrderCommand.fromArgs);
  registry.register('back', ZOrderCommand.fromArgs);

  registry.register('tree', TreeCommand.fromArgs);
  registry.register('show', ShowCommand.fromArgs);
  registry.register('help', HelpCommand.fromArgs);

  registry.register('undo', () => new UndoCommand());
  registry.register('redo', () => new RedoCommand());

  return registry;
}
