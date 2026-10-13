import { SvgWriter } from '../io/SvgWriter';
import { InvalidArgumentError } from '../model/errors';
import type { ParsedCommand } from '../parser/CommandParser';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

export class SaveCommand implements Command {
  public readonly isUndoable = false;

  private target = '';
  private elementCount = 0;

  public constructor(private readonly path: string | null) {}

  public static fromArgs(args: ParsedCommand, _ctx: AppContext): SaveCommand {
    if (args.positional.length > 1) {
      throw new InvalidArgumentError('save expects [file.svg]');
    }
    return new SaveCommand(args.positional[0] ?? null);
  }

  public execute(ctx: AppContext): void {
    const document = ctx.requireDocument();
    const target = this.path ?? ctx.getSavePath();
    if (target === null) {
      throw new InvalidArgumentError('save expects <file.svg> (no file has been read)');
    }
    const text = new SvgWriter().serialize(document.toXml());
    ctx.fileStore.write(target, text);
    ctx.setSavePath(target);
    this.target = target;
    this.elementCount = document.count();
  }

  public undo(_ctx: AppContext): void {
    throw new Error('document commands are not undoable');
  }

  public successMessage(): string {
    return `saved to ${this.target} (${this.elementCount} elements)`;
  }

  public undoMessage(): string {
    return 'save undone';
  }
}
