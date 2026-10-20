import type { ParsedCommand } from '../parser/CommandParser';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

const HELP = [
  'commands:',
  '  init [w] [h]                 new empty canvas (default 800x600)',
  '  read <file.svg>              load an SVG file',
  '  save [file.svg]              write the document (defaults to the read path)',
  '  canvas [w] [h]               show or change the canvas size',
  '  create <type> <id> [params...] [in <gid>]',
  '      rect    <x> <y> <w> <h> [fill]',
  '      circle  <cx> <cy> <r> [fill]',
  '      ellipse <cx> <cy> <rx> <ry> [fill]',
  '      line    <x1> <y1> <x2> <y2> [stroke]',
  '      text    <x> <y> "content"',
  '      g',
  '  delete <id>                  remove a shape (and its subtree)',
  '  move <id> <dx> <dy>          translate (containers move as a whole)',
  '  scale <id> <factor>          scale recursively about the origin',
  '  set <id> <attr> <value>      set an attribute',
  '  group <newGid> <id1> <id2>... fold shapes into a new container',
  '  ungroup <gid>                dissolve a container',
  '  addto <gid> <id>             move a shape into a container',
  '  front <id> | back <id>       adjust z-order',
  '  tree [id]                    show the structure tree',
  '  show <id>                    show one shape in detail',
  '  undo | redo                  undo or redo the last edit',
  '  help                         show this message',
].join('\n');

export class HelpCommand implements Command {
  public readonly isUndoable = false;
  public readonly isDisplay = true;

  public static fromArgs(_args: ParsedCommand, _ctx: AppContext): HelpCommand {
    return new HelpCommand();
  }

  public execute(_ctx: AppContext): void {}

  public undo(_ctx: AppContext): void {}

  public successMessage(): string {
    return HELP;
  }

  public undoMessage(): string {
    return '';
  }
}
