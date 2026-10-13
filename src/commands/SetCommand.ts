import { InvalidArgumentError, UnknownAttributeError } from '../model/errors';
import type { Shape } from '../model/Shape';
import type { ParsedCommand } from '../parser/CommandParser';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

export class SetCommand implements Command {
  public readonly isUndoable = true;

  private resolved = false;
  private oldValue: string | undefined;
  private label = '';

  public constructor(
    private readonly id: string,
    private readonly attr: string,
    private readonly value: string,
  ) {}

  public static fromArgs(args: ParsedCommand, _ctx: AppContext): SetCommand {
    const [id, attr, value] = args.positional;
    if (id === undefined || attr === undefined || value === undefined) {
      throw new InvalidArgumentError('set expects <id> <attr> <value>');
    }
    return new SetCommand(id, attr, value);
  }

  public execute(ctx: AppContext): void {
    const shape = ctx.requireDocument().requireShape(this.id);
    if (!shape.canSet(this.attr)) {
      throw new UnknownAttributeError(this.attr);
    }
    if (!this.resolved) {
      this.oldValue = shape.getAttr(this.attr);
      this.label = `${shape.typeName}#${shape.id}`;
      this.resolved = true;
    }
    shape.setAttr(this.attr, this.value);
  }

  public undo(ctx: AppContext): void {
    const shape = ctx.requireDocument().requireShape(this.id);
    SetCommand.restore(shape, this.attr, this.oldValue);
  }

  public successMessage(): string {
    return `${this.label} updated: ${this.attr}="${this.value}"`;
  }

  public undoMessage(): string {
    return this.oldValue === undefined
      ? `${this.label} updated: ${this.attr} removed`
      : `${this.label} updated: ${this.attr}="${this.oldValue}"`;
  }

  private static restore(shape: Shape, attr: string, oldValue: string | undefined): void {
    if (oldValue === undefined) {
      shape.unsetAttr(attr);
    } else {
      shape.setAttr(attr, oldValue);
    }
  }
}
