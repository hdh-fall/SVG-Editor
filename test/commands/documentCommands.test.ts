import { describe, expect, it } from 'vitest';
import { CommandParser } from '../../src/parser/CommandParser';
import { CanvasCommand } from '../../src/commands/CanvasCommand';
import { CreateCommand } from '../../src/commands/CreateCommand';
import { InitCommand } from '../../src/commands/InitCommand';
import { ReadCommand } from '../../src/commands/ReadCommand';
import { RedoCommand } from '../../src/commands/RedoCommand';
import { SaveCommand } from '../../src/commands/SaveCommand';
import { UndoCommand } from '../../src/commands/UndoCommand';
import { HistoryManager } from '../../src/history/HistoryManager';
import { InvalidArgumentError } from '../../src/model/errors';
import { emptyContext } from '../helpers/makeContext';

const parser = new CommandParser();

const OTHER_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect x="0" y="0" width="400" height="300" fill="#ffffff"/>
  <text id="t1" x="10" y="290">imported</text>
  <circle id="c1" cx="50" cy="50" r="10"/>
  <g id="g1">
    <rect id="r2" x="0" y="0" width="10" height="10"/>
    <circle id="c2" cx="5" cy="5" r="2"/>
  </g>
  <ellipse id="e1" cx="1" cy="2" rx="3" ry="4"/>
</svg>`;

describe('InitCommand', () => {
  it('creates the default canvas', () => {
    const ctx = emptyContext();
    const cmd = InitCommand.fromArgs(parser.parse('init')!, ctx);
    cmd.execute(ctx);
    expect(ctx.requireDocument().width).toBe(800);
    expect(ctx.requireDocument().height).toBe(600);
    expect(cmd.successMessage()).toBe('canvas 800x600 created');
  });

  it('honours explicit dimensions', () => {
    const ctx = emptyContext();
    InitCommand.fromArgs(parser.parse('init 640 480')!, ctx).execute(ctx);
    expect(ctx.requireDocument().width).toBe(640);
  });
});

describe('ReadCommand', () => {
  it('loads a file, warns about the assigned id and counts elements', () => {
    const ctx = emptyContext();
    ctx.fileStore.write('other.svg', OTHER_SVG);
    const cmd = ReadCommand.fromArgs(parser.parse('read other.svg')!, ctx);
    cmd.execute(ctx);

    expect(cmd.warnings()).toEqual(['assigned id rect1 to unnamed <rect>']);
    expect(cmd.successMessage()).toBe('read other.svg (7 elements)');
    expect(ctx.requireDocument().width).toBe(400);
    expect(ctx.getSavePath()).toBe('other.svg');
  });
});

describe('SaveCommand', () => {
  it('writes the document and reports the element count', () => {
    const ctx = emptyContext();
    InitCommand.fromArgs(parser.parse('init 800 600')!, ctx).execute(ctx);
    CreateCommand.fromArgs(parser.parse('create rect bg 0 0 800 600 #ffffff')!, ctx).execute(ctx);

    const cmd = SaveCommand.fromArgs(parser.parse('save demo.svg')!, ctx);
    cmd.execute(ctx);

    expect(cmd.successMessage()).toBe('saved to demo.svg (1 elements)');
    expect(ctx.fileStore.read('demo.svg')).toContain('<rect id="bg"');
  });

  it('defaults to the path used by the last read', () => {
    const ctx = emptyContext();
    ctx.fileStore.write('other.svg', OTHER_SVG);
    ReadCommand.fromArgs(parser.parse('read other.svg')!, ctx).execute(ctx);

    const cmd = SaveCommand.fromArgs(parser.parse('save')!, ctx);
    cmd.execute(ctx);
    expect(cmd.successMessage()).toBe('saved to other.svg (7 elements)');
  });

  it('refuses to save when no path is known', () => {
    const ctx = emptyContext();
    InitCommand.fromArgs(parser.parse('init')!, ctx).execute(ctx);
    expect(() => SaveCommand.fromArgs(parser.parse('save')!, ctx).execute(ctx)).toThrow(
      InvalidArgumentError,
    );
  });
});

describe('CanvasCommand', () => {
  it('shows the size without arguments and is a display command', () => {
    const ctx = emptyContext();
    InitCommand.fromArgs(parser.parse('init 800 600')!, ctx).execute(ctx);
    const cmd = CanvasCommand.fromArgs(parser.parse('canvas')!, ctx);
    cmd.execute(ctx);
    expect(cmd.isDisplay).toBe(true);
    expect(cmd.successMessage()).toBe('canvas 800x600');
  });

  it('resizes when given dimensions', () => {
    const ctx = emptyContext();
    InitCommand.fromArgs(parser.parse('init 800 600')!, ctx).execute(ctx);
    const cmd = CanvasCommand.fromArgs(parser.parse('canvas 320 240')!, ctx);
    cmd.execute(ctx);
    expect(cmd.isDisplay).toBe(false);
    expect(ctx.requireDocument().width).toBe(320);
  });
});

describe('Undo and redo commands', () => {
  it('surface the underlying command messages', () => {
    const ctx = emptyContext();
    InitCommand.fromArgs(parser.parse('init 800 600')!, ctx).execute(ctx);
    const history = new HistoryManager();
    history.execute(CreateCommand.fromArgs(parser.parse('create rect a 0 0 1 1')!, ctx), ctx);

    expect(new UndoCommand().executeOn(history, ctx)).toBe('rect#a creation undone');
    expect(new RedoCommand().executeOn(history, ctx)).toBe('rect#a created');
  });
});
