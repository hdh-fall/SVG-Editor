import { createInterface } from 'node:readline';
import { OutputFormatter } from './cli/OutputFormatter';
import { Repl } from './cli/Repl';
import type { AppContext } from './commands/AppContext';
import { createDefaultCommandRegistry } from './commands/createDefaultCommandRegistry';
import { HistoryManager } from './history/HistoryManager';
import { NodeFileStore } from './io/NodeFileStore';
import { NoDocumentError } from './model/errors';
import { SvgDocument } from './model/SvgDocument';
import { CommandParser } from './parser/CommandParser';
import { createDefaultShapeFactory } from './shapes/ShapeFactory';

function createContext(): AppContext {
  let document: SvgDocument | null = null;
  let savePath: string | null = null;
  return {
    getDocument: () => document,
    requireDocument: () => {
      if (document === null) {
        throw new NoDocumentError();
      }
      return document;
    },
    setDocument: (next) => {
      document = next;
    },
    getSavePath: () => savePath,
    setSavePath: (path) => {
      savePath = path;
    },
    factory: createDefaultShapeFactory(),
    fileStore: new NodeFileStore(),
  };
}

const output = new OutputFormatter();
const history = new HistoryManager();
const repl = new Repl(
  new CommandParser(),
  createDefaultCommandRegistry(history),
  history,
  createContext(),
  output,
  (line) => process.stdout.write(`${line}\n`),
);

repl.start();
const readline = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: output.prompt(),
});
readline.prompt();
readline.on('line', (line) => {
  repl.runLine(line);
  readline.prompt();
});
readline.on('close', () => process.exit(0));
