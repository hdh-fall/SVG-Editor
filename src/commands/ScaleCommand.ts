import { InvalidArgumentError, InvalidScaleFactorError } from '../model/errors';
import { formatNumber, parseNumber } from '../model/format';
import type { ParsedCommand } from '../parser/CommandParser';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

export class ScaleCommand implements Command {
  public readonly isUndoable = true;

  private label = '';

  public constructor(
    private readonly id: string,
    private readonly factor: number,
  ) {}

  public static fromArgs(args: ParsedCommand, _ctx: AppContext): ScaleCommand {
    const [id, factor] = args.positional;
    if (id === undefined || factor === undefined) {
      throw new InvalidArgumentError('scale expects <id> <factor>');
    }
    const value = parseNumber(factor);
    if (value <= 0) {
      throw new InvalidScaleFactorError();
    }
    return new ScaleCommand(id, value);
  }

  public execute(ctx: AppContext): void {
    const shape = ctx.requireDocument().requireShape(this.id);
    this.label = `${shape.typeName}#${shape.id}`;
    shape.scaleBy(this.factor);
  }

  public undo(ctx: AppContext): void {
    ctx
      .requireDocument()
      .requireShape(this.id)
      .scaleBy(1 / this.factor);
  }

  public successMessage(): string {
    return `${this.label} scaled by ${formatNumber(this.factor)}`;
  }

  public undoMessage(): string {
    return `${this.label} unscaled`;
  }
}
