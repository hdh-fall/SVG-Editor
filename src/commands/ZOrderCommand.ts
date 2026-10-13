import type { NodeLocation } from '../model/SvgDocument';
import type { Shape } from '../model/Shape';
import { InvalidArgumentError } from '../model/errors';
import type { ParsedCommand } from '../parser/CommandParser';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

type Placement = 'front' | 'back';

/** Shared implementation of `front <id>` and `back <id>`. */
export class ZOrderCommand implements Command {
  public readonly isUndoable = true;

  private shape: Shape | null = null;
  private location: NodeLocation | null = null;

  public constructor(
    private readonly id: string,
    private readonly placement: Placement,
  ) {}

  public static fromArgs(args: ParsedCommand, _ctx: AppContext): ZOrderCommand {
    const [name, id] = [args.name, args.positional[0]];
    if (id === undefined) {
      throw new InvalidArgumentError(`${name} expects <id>`);
    }
    return new ZOrderCommand(id, name === 'front' ? 'front' : 'back');
  }

  public execute(ctx: AppContext): void {
    const doc = ctx.requireDocument();
    if (this.shape === null) {
      this.shape = doc.requireShape(this.id);
      this.location = doc.locationOf(this.shape);
    }
    const parent = doc.locationOf(this.shape).parent;
    doc.detach(this.shape);
    const index = this.placement === 'front' ? parent.children.length : 0;
    parent.insert(this.shape, index);
    doc.rebuildIndex();
  }

  public undo(ctx: AppContext): void {
    const doc = ctx.requireDocument();
    if (this.shape === null || this.location === null) return;
    doc.detach(this.shape);
    doc.attach(this.shape, this.location);
  }

  public successMessage(): string {
    return `${this.shape!.typeName}#${this.shape!.id} moved to ${this.placement}`;
  }

  public undoMessage(): string {
    return `${this.shape!.typeName}#${this.shape!.id} z-order restored`;
  }
}
