import { SvgDocument } from '../model/SvgDocument';
import { InvalidArgumentError } from '../model/errors';
import { formatNumber, parseNumber } from '../model/format';
import type { ParsedCommand } from '../parser/CommandParser';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

export class InitCommand implements Command {
  public readonly isUndoable = false;

  private width = 0;
  private height = 0;

  public constructor(
    private readonly requestedWidth: number | undefined,
    private readonly requestedHeight: number | undefined,
  ) {}

  public static fromArgs(args: ParsedCommand, _ctx: AppContext): InitCommand {
    if (args.positional.length > 2) {
      throw new InvalidArgumentError('init expects [w] [h]');
    }
    const [rawWidth, rawHeight] = args.positional;
    return new InitCommand(
      rawWidth === undefined ? undefined : parseNumber(rawWidth),
      rawHeight === undefined ? undefined : parseNumber(rawHeight),
    );
  }

  public execute(ctx: AppContext): void {
    this.width = this.requestedWidth ?? 800;
    this.height = this.requestedHeight ?? 600;
    ctx.setDocument(new SvgDocument(this.width, this.height));
    ctx.setSavePath(null);
  }

  public undo(_ctx: AppContext): void {
    throw new Error('document commands are not undoable');
  }

  public successMessage(): string {
    return `canvas ${formatNumber(this.width)}x${formatNumber(this.height)} created`;
  }

  public undoMessage(): string {
    return 'canvas creation undone';
  }
}
