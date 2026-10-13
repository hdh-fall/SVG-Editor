import { describe, expect, it } from 'vitest';
import { CommandParser } from '../../src/parser/CommandParser';
import { CreateCommand } from '../../src/commands/CreateCommand';
import { GroupCommand } from '../../src/commands/GroupCommand';
import { UngroupCommand } from '../../src/commands/UngroupCommand';
import { AddToCommand } from '../../src/commands/AddToCommand';
import { ZOrderCommand } from '../../src/commands/ZOrderCommand';
import {
  CannotGroupIntoDescendantError,
  CannotUngroupTopLevelError,
  NoSuchShapeError,
} from '../../src/model/errors';
import { makeContext } from '../helpers/makeContext';

const parser = new CommandParser();

function run(line: string, ctx: ReturnType<typeof makeContext>) {
  const parsed = parser.parse(line)!;
  const builders = {
    create: CreateCommand,
    group: GroupCommand,
    ungroup: UngroupCommand,
    addto: AddToCommand,
    front: ZOrderCommand,
    back: ZOrderCommand,
  } as const;
  const builder = builders[parsed.name as keyof typeof builders];
  const cmd = builder.fromArgs(parsed, ctx);
  cmd.execute(ctx);
  return cmd;
}

describe('GroupCommand', () => {
  it('creates a group holding the members in order, at the first member position', () => {
    const ctx = makeContext();
    const doc = ctx.requireDocument();
    run('create rect a 0 0 1 1', ctx);
    run('create circle c 5 5 1', ctx);
    run('create rect b 0 0 1 1', ctx);

    const cmd = run('group mid c b', ctx) as GroupCommand;
    expect(cmd.successMessage()).toBe('g#mid created with 2 children');
    expect(doc.children.map((s) => s.id)).toEqual(['a', 'mid']);
    expect(doc.requireContainer('mid').children.map((s) => s.id)).toEqual(['c', 'b']);
  });

  it('undo restores every member to its original parent and index', () => {
    const ctx = makeContext();
    const doc = ctx.requireDocument();
    run('create rect a 0 0 1 1', ctx);
    run('create circle c 5 5 1', ctx);
    run('create rect b 0 0 1 1', ctx);
    const cmd = run('group mid c b', ctx) as GroupCommand;

    cmd.undo(ctx);
    expect(doc.children.map((s) => s.id)).toEqual(['a', 'c', 'b']);
    expect(doc.find('mid')).toBeNull();
  });

  it('refuses to fold a container together with its own descendant', () => {
    const ctx = makeContext();
    run('create g markers', ctx);
    run('create circle c1 0 0 1', ctx);
    run('addto markers c1', ctx);

    expect(() => run('group bad c1 markers', ctx)).toThrow(CannotGroupIntoDescendantError);
  });
});

describe('UngroupCommand', () => {
  it('hoists children into the parent at the group position', () => {
    const ctx = makeContext();
    const doc = ctx.requireDocument();
    run('create g outer', ctx);
    run('create rect a 0 0 1 1 in outer', ctx);
    run('create circle c 5 5 1 in outer', ctx);
    run('create rect b 0 0 1 1 in outer', ctx);
    run('group mid c b', ctx);

    run('ungroup mid', ctx);
    expect(doc.requireContainer('outer').children.map((s) => s.id)).toEqual(['a', 'c', 'b']);
    expect(doc.find('mid')).toBeNull();
  });

  it('refuses a top-level container', () => {
    const ctx = makeContext();
    run('create g scene', ctx);
    expect(() => run('ungroup scene', ctx)).toThrow(CannotUngroupTopLevelError);
  });

  it('refuses an id that is not a container', () => {
    const ctx = makeContext();
    run('create rect r 0 0 1 1', ctx);
    expect(() => run('ungroup r', ctx)).toThrow(/not a container: r/);
  });
});

describe('AddToCommand', () => {
  it('moves a shape into a container and undo puts it back', () => {
    const ctx = makeContext();
    const doc = ctx.requireDocument();
    run('create g box', ctx);
    run('create rect r 0 0 1 1', ctx);

    const cmd = run('addto box r', ctx) as AddToCommand;
    expect(doc.requireContainer('box').children.map((s) => s.id)).toEqual(['r']);
    cmd.undo(ctx);
    expect(doc.children.map((s) => s.id)).toEqual(['box', 'r']);
  });

  it('rejects a missing shape', () => {
    const ctx = makeContext();
    run('create g box', ctx);
    expect(() => run('addto box ghost', ctx)).toThrow(NoSuchShapeError);
  });
});

describe('ZOrderCommand', () => {
  it('brings a shape to the front and sends it to the back', () => {
    const ctx = makeContext();
    const doc = ctx.requireDocument();
    run('create rect a 0 0 1 1', ctx);
    run('create rect b 0 0 1 1', ctx);
    run('create rect c 0 0 1 1', ctx);

    const front = run('front a', ctx) as ZOrderCommand;
    expect(doc.children.map((s) => s.id)).toEqual(['b', 'c', 'a']);
    front.undo(ctx);
    expect(doc.children.map((s) => s.id)).toEqual(['a', 'b', 'c']);

    run('back c', ctx);
    expect(doc.children.map((s) => s.id)).toEqual(['c', 'a', 'b']);
  });
});
