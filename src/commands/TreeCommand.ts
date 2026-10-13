import type { Container } from '../model/Container';
import { formatNumber } from '../model/format';
import type { Shape } from '../model/Shape';
import type { ParsedCommand } from '../parser/CommandParser';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

/** Column where a node's inlined geometry summary starts (spec §5.1). */
const LABEL_COLUMN = 19;

export class TreeCommand implements Command {
  public readonly isUndoable = false;
  public readonly isDisplay = true;

  private text = '';

  public constructor(private readonly rootId: string | null) {}

  public static fromArgs(args: ParsedCommand, _ctx: AppContext): TreeCommand {
    return new TreeCommand(args.positional[0] ?? null);
  }

  public execute(ctx: AppContext): void {
    const document = ctx.requireDocument();
    if (this.rootId === null) {
      const lines = [`svg (${formatNumber(document.width)}x${formatNumber(document.height)})`];
      this.renderChildren(document, '', lines);
      this.text = lines.join('\n');
      return;
    }
    const root = document.requireShape(this.rootId);
    const lines: string[] = [TreeCommand.describe(root, 0)];
    const container = root.asContainer();
    if (container !== null) {
      this.renderChildren(container, '', lines);
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

  private renderChildren(container: Container, indent: string, lines: string[]): void {
    const { children } = container;
    children.forEach((child, index) => {
      this.renderNode(child, indent, index === children.length - 1, lines);
    });
  }

  private renderNode(shape: Shape, indent: string, isLast: boolean, lines: string[]): void {
    const prefix = `${indent}${isLast ? '└── ' : '├── '}`;
    lines.push(prefix + TreeCommand.describe(shape, prefix.length));

    const container = shape.asContainer();
    if (container === null) {
      return;
    }
    const childIndent = `${indent}${isLast ? '    ' : '│   '}`;
    this.renderChildren(container, childIndent, lines);
  }

  private static describe(shape: Shape, prefixLength: number): string {
    const name = `${shape.typeName}#${shape.id}`;
    if (shape.isContainer()) {
      return name;
    }
    const pad = Math.max(1, LABEL_COLUMN - prefixLength - name.length);
    return `${name}${' '.repeat(pad)}${shape.summary()}${TreeCommand.fillOf(shape)}`;
  }

  private static fillOf(shape: Shape): string {
    const fill = shape.getAttr('fill');
    return fill === undefined ? '' : ` fill=${fill}`;
  }
}
