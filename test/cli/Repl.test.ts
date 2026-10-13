import { describe, expect, it } from 'vitest';
import { Repl } from '../../src/cli/Repl';
import { OutputFormatter } from '../../src/cli/OutputFormatter';
import { createDefaultCommandRegistry } from '../../src/commands/createDefaultCommandRegistry';
import { HistoryManager } from '../../src/history/HistoryManager';
import { CommandParser } from '../../src/parser/CommandParser';
import { emptyContext } from '../helpers/makeContext';

function makeRepl() {
  const context = emptyContext();
  const history = new HistoryManager();
  const lines: string[] = [];
  const repl = new Repl(
    new CommandParser(),
    createDefaultCommandRegistry(history),
    history,
    context,
    new OutputFormatter(),
    (line) => lines.push(line),
  );
  return { repl, lines, context };
}

describe('Repl', () => {
  it('prints the banner and ignores blank and comment lines', () => {
    const { repl, lines } = makeRepl();
    repl.start();
    repl.runLine('');
    repl.runLine('# just a comment');
    expect(lines).toEqual(["svg-editor 0.1 — type 'help' for commands"]);
  });

  it('reports an unknown command', () => {
    const { repl, lines } = makeRepl();
    repl.runLine('bogus');
    expect(lines).toEqual(['error: unknown command: bogus']);
  });

  it('requires a document before editing', () => {
    const { repl, lines } = makeRepl();
    repl.runLine('create rect r 0 0 1 1');
    expect(lines).toEqual(["error: no document. use 'init' or 'read' first"]);
  });

  it('routes undo and redo through the history', () => {
    const { repl, lines } = makeRepl();
    repl.runLine('init 800 600');
    repl.runLine('create rect a 0 0 1 1');
    repl.runLine('undo');
    repl.runLine('redo');
    expect(lines).toEqual([
      'canvas 800x600 created',
      'rect#a created',
      'rect#a creation undone',
      'rect#a created',
    ]);
  });

  it('prints read warnings before the summary', () => {
    const { repl, lines, context } = makeRepl();
    context.fileStore.write(
      'other.svg',
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">' +
        '<rect x="0" y="0" width="10" height="10"/></svg>',
    );
    repl.runLine('read other.svg');
    expect(lines).toEqual([
      'warning: assigned id rect1 to unnamed <rect>',
      'read other.svg (1 elements)',
    ]);
  });
});
