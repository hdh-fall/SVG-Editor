import type { NodeLocation } from '../model/SvgDocument';
import type { Shape } from '../model/Shape';
import {
  CannotGroupIntoDescendantError,
  InvalidArgumentError,
} from '../model/errors';
import type { ParsedCommand } from '../parser/CommandParser';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

export class AddToCommand implements Command {
  public readonly isUndoable = true;

  private shape: Shape | null = null;
  private location: NodeLocation | null = null;

  public constructor(
    private readonly containerId: string,
    private readonly shapeId: string,
  ) {}

  public static fromArgs(args: ParsedCommand, _ctx: AppContext): AddToCommand {
    const [containerId, shapeId] = args.positional;
    if (containerId === undefined || shapeId === undefined) {
      throw new InvalidArgumentError('addto expects <gid> <id>');
    }
    return new AddToCommand(containerId, shapeId);
  }

  public execute(ctx: AppContext): void {
    const doc = ctx.requireDocument();
    if (this.shape === null) {
      const container = doc.requireContainer(this.containerId);
      this.shape = doc.requireShape(this.shapeId);
      if (AddToCommand.isAncestor(this.shape, container)) {
        throw new CannotGroupIntoDescendantError(this.shape.id);
      }
      this.location = doc.locationOf(this.shape);
    }
    const container = doc.requireContainer(this.containerId);
    doc.detach(this.shape);
    container.insert(this.shape);
    doc.rebuildIndex();
  }

  public undo(ctx: AppContext): void {
    const doc = ctx.requireDocument();
    if (this.shape === null || this.location === null) return;
    doc.detach(this.shape);
    doc.attach(this.shape, this.location);
  }

  public successMessage(): string {
    return `${this.shape!.typeName}#${this.shape!.id} moved into g#${this.containerId}`;
  }

  public undoMessage(): string {
    return `${this.shape!.typeName}#${this.shape!.id} moved out of g#${this.containerId}`;
  }

  private static isAncestor(candidate: Shape, node: Shape): boolean {
    let current: Shape | null = node.parent;
    while (current !== null) {
      if (current === candidate) return true;
      current = current.parent;
    }
    return false;
  }
}
