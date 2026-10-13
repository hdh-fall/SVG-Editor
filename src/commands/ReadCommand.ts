import { SvgReader } from '../io/SvgReader';
import { InvalidArgumentError } from '../model/errors';
import type { ParsedCommand } from '../parser/CommandParser';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

export class ReadCommand implements Command {
  public readonly isUndoable = false;

  private storedWarnings: readonly string[] = [];
  private elementCount = 0;

  public constructor(private readonly path: string) {}

  public static fromArgs(args: ParsedCommand, _ctx: AppContext): ReadCommand {
    const path = args.positional[0];
    if (path === undefined) {
      throw new InvalidArgumentError('read expects <file.svg>');
    }
    return new ReadCommand(path);
  }

  public execute(ctx: AppContext): void {
    const text = ctx.fileStore.read(this.path);
    const result = new SvgReader(ctx.factory).read(text, this.path);
    ctx.setDocument(result.document);
    ctx.setSavePath(this.path);
    this.storedWarnings = result.warnings;
    this.elementCount = result.document.count();
  }

  public warnings(): readonly string[] {
    return this.storedWarnings;
  }

  public undo(_ctx: AppContext): void {
    throw new Error('document commands are not undoable');
  }

  public successMessage(): string {
    return `read ${this.path} (${this.elementCount} elements)`;
  }

  public undoMessage(): string {
    return 'read undone';
  }
}
