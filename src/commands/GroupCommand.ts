import { Group } from '../model/Group';
import type { NodeLocation } from '../model/SvgDocument';
import type { Shape } from '../model/Shape';
import { CannotGroupIntoDescendantError, InvalidArgumentError } from '../model/errors';
import type { ParsedCommand } from '../parser/CommandParser';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

export class GroupCommand implements Command {
  public readonly isUndoable = true;

  private group: Group | null = null;
  private members: Shape[] = [];
  private memberLocations: NodeLocation[] = [];
  private groupLocation: NodeLocation | null = null;

  public constructor(
    private readonly groupId: string,
    private readonly memberIds: readonly string[],
  ) {}

  public static fromArgs(args: ParsedCommand, _ctx: AppContext): GroupCommand {
    const [groupId, ...memberIds] = args.positional;
    if (groupId === undefined || memberIds.length === 0) {
      throw new InvalidArgumentError('group expects <newGid> <id1> [id2…]');
    }
    return new GroupCommand(groupId, memberIds);
  }

  public execute(ctx: AppContext): void {
    const doc = ctx.requireDocument();
    if (this.group === null) {
      doc.assertIdFree(this.groupId);
      this.members = this.memberIds.map((id) => doc.requireShape(id));
      GroupCommand.assertNoNesting(this.members);
      this.memberLocations = this.members.map((member) => doc.locationOf(member));
      const first = this.memberLocations[0]!;
      this.groupLocation = { parent: first.parent, index: first.index };
      this.group = new Group(this.groupId);
    }
    for (const member of this.members) {
      doc.detach(member);
    }
    doc.attach(this.group, this.groupLocation!);
    for (const member of this.members) {
      doc.attach(member, { parent: this.group, index: this.group.children.length });
    }
  }

  public undo(ctx: AppContext): void {
    const doc = ctx.requireDocument();
    if (this.group === null) return;
    this.members.forEach((member, index) => {
      doc.detach(member);
      doc.attach(member, this.memberLocations[index]!);
    });
    doc.detach(this.group);
  }

  public successMessage(): string {
    return `g#${this.groupId} created with ${this.members.length} children`;
  }

  public undoMessage(): string {
    return `g#${this.groupId} ungrouped`;
  }

  private static assertNoNesting(members: readonly Shape[]): void {
    for (const candidate of members) {
      for (const other of members) {
        if (candidate !== other && GroupCommand.isAncestor(candidate, other)) {
          throw new CannotGroupIntoDescendantError(candidate.id);
        }
      }
    }
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
