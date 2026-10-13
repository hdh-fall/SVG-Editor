import { InvalidArgumentError } from '../model/errors';
import { formatNumber, parseNumber } from '../model/format';
import type { ParsedCommand } from '../parser/CommandParser';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

export class CanvasCommand implements Command {
  public readonly isUndoable = false;
  public readonly isDisplay: boolean;

  private width = 0;
  private height = 0;

  public constructor(
    private readonly newWidth: number | null,
    private readonly newHeight: number | null,
  ) {
    this.isDisplay = newWidth === null;
  }

  public static fromArgs(args: ParsedCommand, _ctx: AppContext): CanvasCommand {
    const { positional } = args;
    if (positional.length === 0) {
      return new CanvasCommand(null, null);
    }
    if (positional.length !== 2) {
      throw new InvalidArgumentError('canvas expects no arguments or <w> <h>');
    }
    return new CanvasCommand(parseNumber(positional[0]!), parseNumber(positional[1]!));
  }

  public execute(ctx: AppContext): void {
    const document = ctx.requireDocument();
    if (this.newWidth !== null && this.newHeight !== null) {
      document.resize(this.newWidth, this.newHeight);
    }
    this.width = document.width;
    this.height = document.height;
  }

  public undo(_ctx: AppContext): void {
    throw new Error('document commands are not undoable');
  }

  public successMessage(): string {
    return `canvas ${formatNumber(this.width)}x${formatNumber(this.height)}`;
  }

  public undoMessage(): string {
    return 'canvas resized';
  }
}
