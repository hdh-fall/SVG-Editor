import { describe, expect, it } from 'vitest';
import { CommandParser } from '../../src/parser/CommandParser';
import { MoveCommand } from '../../src/commands/MoveCommand';
import { ScaleCommand } from '../../src/commands/ScaleCommand';
import { CreateCommand } from '../../src/commands/CreateCommand';
import { InvalidScaleFactorError, NoSuchShapeError } from '../../src/model/errors';
import { makeContext } from '../helpers/makeContext';

const parser = new CommandParser();

function create(line: string, ctx: ReturnType<typeof makeContext>): void {
  CreateCommand.fromArgs(parser.parse(line)!, ctx).execute(ctx);
}

describe('MoveCommand', () => {
  it('reports a new absolute position for a leaf', () => {
    const ctx = makeContext();
    create('create circle c1 100 100 20 red', ctx);
    const cmd = MoveCommand.fromArgs(parser.parse('move c1 30 0')!, ctx);
    cmd.execute(ctx);

    expect(cmd.successMessage()).toBe('circle#c1 moved to (130,100)');
    cmd.undo(ctx);
    expect(cmd.undoMessage()).toBe('circle#c1 moved back to (100,100)');
  });

  it('reports a delta for a container', () => {
    const ctx = makeContext();
    create('create g node2', ctx);
    const cmd = MoveCommand.fromArgs(parser.parse('move node2 0 100')!, ctx);
    cmd.execute(ctx);

    expect(cmd.successMessage()).toBe('g#node2 moved by (0,100)');
    cmd.undo(ctx);
    expect(cmd.undoMessage()).toBe('g#node2 moved back by (0,-100)');
  });

  it('moves every descendant of a container', () => {
    const ctx = makeContext();
    create('create g g1', ctx);
    create('create rect r 0 0 10 10 in g1', ctx);
    MoveCommand.fromArgs(parser.parse('move g1 5 5')!, ctx).execute(ctx);
    expect(ctx.requireDocument().find('r')!.summary()).toBe('x=5 y=5 w=10 h=10');
  });

  it('rejects an unknown id', () => {
    const ctx = makeContext();
    expect(() => MoveCommand.fromArgs(parser.parse('move ghost 1 1')!, ctx).execute(ctx)).toThrow(
      NoSuchShapeError,
    );
  });
});

describe('ScaleCommand', () => {
  it('multiplies every geometry value', () => {
    const ctx = makeContext();
    create('create rect r 10 20 100 50', ctx);
    const cmd = ScaleCommand.fromArgs(parser.parse('scale r 2')!, ctx);
    cmd.execute(ctx);
    expect(ctx.requireDocument().find('r')!.summary()).toBe('x=20 y=40 w=200 h=100');
    cmd.undo(ctx);
    expect(ctx.requireDocument().find('r')!.summary()).toBe('x=10 y=20 w=100 h=50');
  });

  it('rejects a non-positive factor', () => {
    const ctx = makeContext();
    create('create rect r 0 0 1 1', ctx);
    expect(() => ScaleCommand.fromArgs(parser.parse('scale r 0')!, ctx)).toThrow(
      InvalidScaleFactorError,
    );
    expect(() => ScaleCommand.fromArgs(parser.parse('scale r -2')!, ctx)).toThrow(
      InvalidScaleFactorError,
    );
  });
});
