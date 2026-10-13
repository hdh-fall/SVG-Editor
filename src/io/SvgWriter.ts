import type { SvgNode } from '../model/SvgNode';

const INDENT = '  ';

/** `SvgNode` tree -> SVG text. Hand-written so the byte format is fully controlled. */
export class SvgWriter {
  public serialize(root: SvgNode): string {
    const lines = ['<?xml version="1.0" encoding="UTF-8"?>'];
    this.writeNode(root, 0, lines);
    return `${lines.join('\n')}\n`;
  }

  private writeNode(node: SvgNode, depth: number, lines: string[]): void {
    const pad = INDENT.repeat(depth);
    const attrs = SvgWriter.renderAttrs(node.attrs);

    if (node.children !== undefined) {
      lines.push(`${pad}<${node.tag}${attrs}>`);
      for (const child of node.children) {
        this.writeNode(child, depth + 1, lines);
      }
      lines.push(`${pad}</${node.tag}>`);
      return;
    }
    if (node.text !== undefined) {
      lines.push(`${pad}<${node.tag}${attrs}>${SvgWriter.escapeText(node.text)}</${node.tag}>`);
      return;
    }
    lines.push(`${pad}<${node.tag}${attrs}/>`);
  }

  private static renderAttrs(attrs: Record<string, string>): string {
    return Object.entries(attrs)
      .map(([name, value]) => ` ${name}="${SvgWriter.escapeAttr(value)}"`)
      .join('');
  }

  private static escapeAttr(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private static escapeText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
