import type { NodeLocation, SvgDocument } from '../model/SvgDocument';
import type { Shape } from '../model/Shape';
import { InvalidArgumentError } from '../model/errors';
import { parseNumber } from '../model/format';
import type { ParsedCommand } from '../parser/CommandParser';
import type { ShapeProvider } from '../shapes/ShapeProvider';
import type { ShapeFactory } from '../shapes/ShapeFactory';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

export class CreateCommand implements Command {
  public readonly isUndoable = true;

  private shape: Shape | null = null;
  private location: NodeLocation | null = null;
  private parentLabel: string | null = null;

  public constructor(
    private readonly typeName: string,
    private readonly id: string,
    private readonly attrs: ReadonlyMap<string, string>,
    private readonly containerId: string | null,
    private readonly factory: ShapeFactory,
  ) {}

  public static fromArgs(args: ParsedCommand, ctx: AppContext): CreateCommand {
    const [typeName, id, ...params] = args.positional;
    if (typeName === undefined || id === undefined) {
      throw new InvalidArgumentError('create expects <type> <id> [params…]');
    }
    const provider = ctx.factory.providerFor(typeName);
    const attrs = CreateCommand.readParams(provider, params);
    return new CreateCommand(typeName, id, attrs, args.inContainer, ctx.factory);
  }

  private static readParams(
    provider: ShapeProvider,
    params: readonly string[],
  ): ReadonlyMap<string, string> {
    const required = provider.params.filter((p) => !p.optional).length;
    if (params.length < required || params.length > provider.params.length) {
      throw new InvalidArgumentError(
        `${provider.typeName} expects ${required}..${provider.params.length} parameter(s), got ${params.length}`,
      );
    }
    const attrs = new Map<string, string>();
    provider.params.forEach((param, index) => {
      const raw = params[index];
      if (raw === undefined) return;
      if (param.numeric) parseNumber(raw);
      attrs.set(param.name, raw);
    });
    return attrs;
  }

  public execute(ctx: AppContext): void {
    const doc = ctx.requireDocument();
    if (this.shape === null) {
      doc.assertIdFree(this.id);
      const parent = this.resolveParent(doc);
      this.parentLabel = parent === doc ? null : `${parent.typeName}#${parent.id}`;
      this.shape = this.factory.providerFor(this.typeName).create(this.id, this.attrs);
      this.location = { parent, index: parent.children.length };
    }
    doc.attach(this.shape, this.location!);
  }

  public undo(ctx: AppContext): void {
    ctx.requireDocument().detach(this.shape!);
  }

  public successMessage(): string {
    const base = `${this.typeName}#${this.id} created`;
    return this.parentLabel === null ? base : `${base} in ${this.parentLabel}`;
  }

  public undoMessage(): string {
    return `${this.typeName}#${this.id} creation undone`;
  }

  private resolveParent(doc: SvgDocument) {
    return this.containerId === null ? doc : doc.requireContainer(this.containerId);
  }
}
