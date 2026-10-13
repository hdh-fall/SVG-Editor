import type { Container } from '../model/Container';
import type { NodeLocation } from '../model/SvgDocument';
import type { Shape } from '../model/Shape';
import {
  CannotUngroupCompositeError,
  CannotUngroupTopLevelError,
  InvalidArgumentError,
  NotAContainerError,
} from '../model/errors';
import type { ParsedCommand } from '../parser/CommandParser';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

export class UngroupCommand implements Command {
  public readonly isUndoable = true;

  private group: Container | null = null;
  private children: Shape[] = [];
  private location: NodeLocation | null = null;

  public constructor(private readonly id: string) {}

  public static fromArgs(args: ParsedCommand, _ctx: AppContext): UngroupCommand {
    const [id] = args.positional;
    if (id === undefined) {
      throw new InvalidArgumentError('ungroup expects <gid>');
    }
    return new UngroupCommand(id);
  }

  public execute(ctx: AppContext): void {
    const doc = ctx.requireDocument();
    if (this.group === null) {
      const shape = doc.requireShape(this.id);
      const container = shape.asContainer();
      if (container === null) {
        throw new NotAContainerError(this.id);
      }
      if (container.isComposite()) {
        throw new CannotUngroupCompositeError(this.id);
      }
      if (container.parent === null || container.parent === doc) {
        throw new CannotUngroupTopLevelError(this.id);
      }
      this.group = container;
      this.children = [...container.children];
      this.location = doc.locationOf(container);
    }

    const parent = this.location!.parent;
    let index = this.location!.index;
    for (const child of this.children) {
      doc.detach(child);
      doc.attach(child, { parent, index });
      index += 1;
    }
    doc.detach(this.group);
  }

  public undo(ctx: AppContext): void {
    const doc = ctx.requireDocument();
    if (this.group === null || this.location === null) return;
    for (const child of this.children) {
      doc.detach(child);
      this.group.insert(child);
    }
    doc.attach(this.group, this.location);
  }

  public successMessage(): string {
    return `${this.group!.typeName}#${this.id} ungrouped`;
  }

  public undoMessage(): string {
    return `${this.group!.typeName}#${this.id} regrouped`;
  }
}
