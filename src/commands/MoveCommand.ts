import { InvalidArgumentError } from '../model/errors';
import { formatNumber, parseNumber } from '../model/format';
import type { ParsedCommand } from '../parser/CommandParser';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

export class MoveCommand implements Command {
  public readonly isUndoable = true;

  private label = '';
  private container = false;
  private beforeAnchor: string | null = null;
  private afterAnchor: string | null = null;

  public constructor(
    private readonly id: string,
    private readonly dx: number,
    private readonly dy: number,
  ) {}

  public static fromArgs(args: ParsedCommand, _ctx: AppContext): MoveCommand {
    const [id, dx, dy] = args.positional;
    if (id === undefined || dx === undefined || dy === undefined) {
      throw new InvalidArgumentError('move expects <id> <dx> <dy>');
    }
    return new MoveCommand(id, parseNumber(dx), parseNumber(dy));
  }

  public execute(ctx: AppContext): void {
    const shape = ctx.requireDocument().requireShape(this.id);
    this.label = `${shape.typeName}#${shape.id}`;
    this.container = shape.isContainer();
    this.beforeAnchor = MoveCommand.anchor(shape);
    shape.translate(this.dx, this.dy);
    this.afterAnchor = MoveCommand.anchor(shape);
  }

  public undo(ctx: AppContext): void {
    ctx.requireDocument().requireShape(this.id).translate(-this.dx, -this.dy);
  }

  public successMessage(): string {
    return this.container
      ? `${this.label} moved by (${formatNumber(this.dx)},${formatNumber(this.dy)})`
      : `${this.label} moved to ${this.afterAnchor}`;
  }

  public undoMessage(): string {
    return this.container
      ? `${this.label} moved back by (${formatNumber(-this.dx)},${formatNumber(-this.dy)})`
      : `${this.label} moved back to ${this.beforeAnchor}`;
  }

  private static anchor(shape: {
    positionAnchor(): readonly [number, number] | null;
  }): string | null {
    const point = shape.positionAnchor();
    if (point === null) return null;
    return `(${formatNumber(point[0])},${formatNumber(point[1])})`;
  }
}
