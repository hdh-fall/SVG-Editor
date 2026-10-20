import { describe, expect, it } from 'vitest';
import { CommandParser } from '../../src/parser/CommandParser';
import { CreateCommand } from '../../src/commands/CreateCommand';
import { DeleteCommand } from '../../src/commands/DeleteCommand';
import { DuplicateIdError, NoSuchContainerError, NoSuchShapeError } from '../../src/model/errors';
import { makeContext } from '../helpers/makeContext';

const parser = new CommandParser();

function build(line: string, ctx: ReturnType<typeof makeContext>): CreateCommand | DeleteCommand {
  const parsed = parser.parse(line)!;
  if (parsed.name === 'create') return CreateCommand.fromArgs(parsed, ctx);
  return DeleteCommand.fromArgs(parsed, ctx);
}

describe('CreateCommand', () => {
  it('creates at the document root by default', () => {
    const ctx = makeContext();
    const cmd = build('create rect bg 0 0 800 600 #ffffff', ctx) as CreateCommand;
    cmd.execute(ctx);
    expect(ctx.requireDocument().children.map((s) => s.id)).toEqual(['bg']);
    expect(cmd.successMessage()).toBe('rect#bg created');
  });

  it('creates inside a container given by the `in` clause', () => {
    const ctx = makeContext();
    build('create g node1', ctx).execute(ctx);
    const cmd = build('create rect start 120 100 160 60 #4a90d9 in node1', ctx) as CreateCommand;
    cmd.execute(ctx);
    expect(cmd.successMessage()).toBe('rect#start created in g#node1');
    expect(
      ctx
        .requireDocument()
        .requireContainer('node1')
        .children.map((s) => s.id),
    ).toEqual(['start']);
  });

  it('rejects a duplicate id', () => {
    const ctx = makeContext();
    build('create rect bg 0 0 1 1', ctx).execute(ctx);
    const cmd = build('create rect bg 0 0 1 1', ctx);
    expect(() => cmd.execute(ctx)).toThrow(DuplicateIdError);
  });

  it('rejects a missing container', () => {
    const ctx = makeContext();
    expect(() => build('create rect r 0 0 1 1 in nope', ctx).execute(ctx)).toThrow(
      NoSuchContainerError,
    );
  });

  it('undo removes the shape and redo puts it back in the same place', () => {
    const ctx = makeContext();
    const doc = ctx.requireDocument();
    build('create rect a 0 0 1 1', ctx).execute(ctx);
    const cmd = build('create rect b 0 0 1 1', ctx);
    cmd.execute(ctx);

    cmd.undo(ctx);
    expect(doc.children.map((s) => s.id)).toEqual(['a']);
    cmd.execute(ctx);
    expect(doc.children.map((s) => s.id)).toEqual(['a', 'b']);
  });
});

describe('DeleteCommand', () => {
  it('deletes and restores with the original parent named', () => {
    const ctx = makeContext();
    build('create g markers', ctx).execute(ctx);
    build('create rect box 0 0 1 1 in markers', ctx).execute(ctx);

    const cmd = build('delete box', ctx) as DeleteCommand;
    cmd.execute(ctx);
    expect(cmd.successMessage()).toBe('rect#box deleted');
    expect(ctx.requireDocument().find('box')).toBeNull();

    cmd.undo(ctx);
    expect(cmd.undoMessage()).toBe('rect#box restored into g#markers');
    expect(
      ctx
        .requireDocument()
        .requireContainer('markers')
        .children.map((s) => s.id),
    ).toEqual(['box']);
  });

  it('rejects an unknown id without touching the document', () => {
    const ctx = makeContext();
    const cmd = build('delete ghost', ctx);
    expect(() => cmd.execute(ctx)).toThrow(NoSuchShapeError);
    expect(ctx.requireDocument().children).toHaveLength(0);
  });
});
