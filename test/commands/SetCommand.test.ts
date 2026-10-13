import { describe, expect, it } from 'vitest';
import { CommandParser } from '../../src/parser/CommandParser';
import { SetCommand } from '../../src/commands/SetCommand';
import { CreateCommand } from '../../src/commands/CreateCommand';
import { UnknownAttributeError } from '../../src/model/errors';
import { makeContext } from '../helpers/makeContext';

const parser = new CommandParser();

function create(line: string, ctx: ReturnType<typeof makeContext>): void {
  CreateCommand.fromArgs(parser.parse(line)!, ctx).execute(ctx);
}

describe('SetCommand', () => {
  it('updates geometry and reports the new value', () => {
    const ctx = makeContext();
    create('create rect r 0 0 10 10', ctx);
    const cmd = SetCommand.fromArgs(parser.parse('set r width 250')!, ctx);
    cmd.execute(ctx);
    expect(cmd.successMessage()).toBe('rect#r updated: width="250"');
    expect(ctx.requireDocument().find('r')!.summary()).toBe('x=0 y=0 w=250 h=10');
  });

  it('updates text content', () => {
    const ctx = makeContext();
    create('create text title 20 40 "My Diagram"', ctx);
    const cmd = SetCommand.fromArgs(parser.parse('set title text "My Diagram v2"')!, ctx);
    cmd.execute(ctx);
    expect(cmd.successMessage()).toBe('text#title updated: text="My Diagram v2"');

    cmd.undo(ctx);
    expect(cmd.undoMessage()).toBe('text#title updated: text="My Diagram"');
  });

  it('undoes a fill that was not set before by removing it', () => {
    const ctx = makeContext();
    create('create rect r 0 0 1 1', ctx);
    const cmd = SetCommand.fromArgs(parser.parse('set r fill red')!, ctx);
    cmd.execute(ctx);
    expect(ctx.requireDocument().find('r')!.toXml().attrs['fill']).toBe('red');
    cmd.undo(ctx);
    expect(ctx.requireDocument().find('r')!.toXml().attrs['fill']).toBeUndefined();
  });

  it('rejects an attribute outside the whitelist', () => {
    const ctx = makeContext();
    create('create rect r 0 0 1 1', ctx);
    expect(() => SetCommand.fromArgs(parser.parse('set r cx 5')!, ctx).execute(ctx)).toThrow(
      UnknownAttributeError,
    );
  });
});
