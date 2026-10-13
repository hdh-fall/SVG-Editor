import { describe, expect, it } from 'vitest';
import { HistoryManager } from '../../src/history/HistoryManager';
import { CommandParser } from '../../src/parser/CommandParser';
import { CreateCommand } from '../../src/commands/CreateCommand';
import {
  NothingToRedoError,
  NothingToUndoError,
  UndoNotAllowedError,
} from '../../src/model/errors';
import { makeContext } from '../helpers/makeContext';
import type { AppContext } from '../../src/commands/AppContext';
import type { Command } from '../../src/commands/Command';

const parser = new CommandParser();

function makeCreate(line: string, ctx: AppContext): CreateCommand {
  return CreateCommand.fromArgs(parser.parse(line)!, ctx);
}

/** Stand-in for init / read / save: not undoable, but it does change the document. */
class DocumentCommand implements Command {
  public readonly isUndoable = false;
  public execute(_ctx: AppContext): void {}
  public undo(_ctx: AppContext): void {}
  public successMessage(): string {
    return 'document op';
  }
  public undoMessage(): string {
    return 'document op undone';
  }
}

describe('HistoryManager', () => {
  it('executes an edit and can undo then redo it', () => {
    const ctx = makeContext();
    const doc = ctx.requireDocument();
    const history = new HistoryManager();

    history.execute(makeCreate('create rect a 0 0 1 1', ctx), ctx);
    expect(doc.children.map((s) => s.id)).toEqual(['a']);

    const undone = history.undo(ctx);
    expect(undone.undoMessage()).toBe('rect#a creation undone');
    expect(doc.children).toHaveLength(0);

    const redone = history.redo(ctx);
    expect(redone.successMessage()).toBe('rect#a created');
    expect(doc.children.map((s) => s.id)).toEqual(['a']);
  });

  it('clears the redo stack when a new edit follows an undo', () => {
    const ctx = makeContext();
    const history = new HistoryManager();
    history.execute(makeCreate('create rect a 0 0 1 1', ctx), ctx);
    history.undo(ctx);
    expect(history.canRedo()).toBe(true);

    history.execute(makeCreate('create rect b 0 0 1 1', ctx), ctx);
    expect(history.canRedo()).toBe(false);
    expect(() => history.redo(ctx)).toThrow(NothingToRedoError);
  });

  it('reports nothing to undo on an empty stack', () => {
    const ctx = makeContext();
    expect(() => new HistoryManager().undo(ctx)).toThrow(NothingToUndoError);
  });

  it('locks undo after a document command until the next edit', () => {
    const ctx = makeContext();
    const history = new HistoryManager();
    history.execute(makeCreate('create rect a 0 0 1 1', ctx), ctx);
    history.execute(new DocumentCommand(), ctx);

    expect(history.canUndo()).toBe(false);
    expect(() => history.undo(ctx)).toThrow(UndoNotAllowedError);

    history.execute(makeCreate('create rect b 0 0 1 1', ctx), ctx);
    expect(history.canUndo()).toBe(true);
  });

  it('does not touch the stacks for display commands', () => {
    const ctx = makeContext();
    const history = new HistoryManager();
    history.execute(makeCreate('create rect a 0 0 1 1', ctx), ctx);

    const display: Command = {
      isUndoable: false,
      isDisplay: true,
      execute: () => {},
      undo: () => {},
      successMessage: () => '',
      undoMessage: () => '',
    };
    history.execute(display, ctx);
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
  });
});
