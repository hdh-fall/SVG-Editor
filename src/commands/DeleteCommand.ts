import type { NodeLocation } from '../model/SvgDocument';
import type { Shape } from '../model/Shape';
import { InvalidArgumentError } from '../model/errors';
import type { ParsedCommand } from '../parser/CommandParser';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

export class DeleteCommand implements Command {
  public readonly isUndoable = true;

  private shape: Shape | null = null;
  private location: NodeLocation | null = null;
  private parentLabel: string | null = null;

  public constructor(private readonly id: string) {}

  public static fromArgs(args: ParsedCommand, _ctx: AppContext): DeleteCommand {
    const [id] = args.positional;
    if (id === undefined) {
      throw new InvalidArgumentError('delete expects <id>');
    }
    return new DeleteCommand(id);
  }

  public execute(ctx: AppContext): void {
    const doc = ctx.requireDocument();
    if (this.shape === null) {
      this.shape = doc.requireShape(this.id);
      this.location = doc.locationOf(this.shape);
      this.parentLabel = doc.isTopLevel(this.shape)
        ? null
        : `${this.shape.parent!.typeName}#${this.shape.parent!.id}`;
    }
    doc.detach(this.shape);
  }

  public undo(ctx: AppContext): void {
    if (this.shape === null || this.location === null) return;
    ctx.requireDocument().attach(this.shape, this.location);
  }

  public successMessage(): string {
    return `${this.label()} deleted`;
  }

  public undoMessage(): string {
    const base = `${this.label()} restored`;
    return this.parentLabel === null ? base : `${base} into ${this.parentLabel}`;
  }

  private label(): string {
    return `${this.shape!.typeName}#${this.shape!.id}`;
  }
}
