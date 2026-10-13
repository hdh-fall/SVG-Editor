import { InvalidArgumentError } from '../model/errors';
import type { Shape } from '../model/Shape';
import type { SvgDocument } from '../model/SvgDocument';
import type { ParsedCommand } from '../parser/CommandParser';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

const PRESENTATION = ['fill', 'stroke', 'stroke-width'] as const;

export class ShowCommand implements Command {
  public readonly isUndoable = false;
  public readonly isDisplay = true;

  private text = '';

  public constructor(private readonly id: string) {}

  public static fromArgs(args: ParsedCommand, _ctx: AppContext): ShowCommand {
    const id = args.positional[0];
    if (id === undefined) {
      throw new InvalidArgumentError('show expects <id>');
    }
    return new ShowCommand(id);
  }

  public execute(ctx: AppContext): void {
    const document = ctx.requireDocument();
    const shape = document.requireShape(this.id);
    const lines = [
      `${shape.typeName}#${shape.id}  parent=${ShowCommand.parentLabel(shape, document)}`,
    ];
    if (!shape.isContainer()) {
      lines.push(`  ${shape.summary()}`);
    }
    for (const name of PRESENTATION) {
      const value = shape.getAttr(name);
      if (value !== undefined) {
        lines.push(`  ${name}=${value}`);
      }
    }
    this.text = lines.join('\n');
  }

  public undo(_ctx: AppContext): void {}

  public successMessage(): string {
    return this.text;
  }

  public undoMessage(): string {
    return '';
  }

  private static parentLabel(shape: Shape, document: SvgDocument): string {
    const { parent } = shape;
    if (parent === null || parent === document) {
      return 'svg';
    }
    return `${parent.typeName}#${parent.id}`;
  }
}
