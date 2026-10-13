import type { SvgNode } from './SvgNode';
import { Shape } from './Shape';
import { formatNumber, parseNumber } from './format';

export class Text extends Shape {
  public override readonly typeName = 'text';

  private x: number;
  private y: number;
  private content: string;

  public constructor(id: string, x: number, y: number, content: string) {
    super(id);
    this.x = x;
    this.y = y;
    this.content = content;
  }

  public translate(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }

  public scaleBy(factor: number): void {
    this.x *= factor;
    this.y *= factor;
  }

  public summary(): string {
    return `(${formatNumber(this.x)},${formatNumber(this.y)}) "${this.content}"`;
  }

  public override toXml(): SvgNode {
    return {
      tag: 'text',
      attrs: { id: this.id, ...this.geometryAttrs(), ...this.presentationAttrs() },
      text: this.content,
    };
  }

  protected geometryAttrs(): Record<string, string> {
    return { x: formatNumber(this.x), y: formatNumber(this.y) };
  }

  protected getGeometryAttr(name: string): string | undefined {
    if (name === 'x') return formatNumber(this.x);
    if (name === 'y') return formatNumber(this.y);
    if (name === 'text') return this.content;
    return undefined;
  }

  protected setGeometryAttr(name: string, value: string): boolean {
    if (name === 'x') {
      this.x = parseNumber(value);
      return true;
    }
    if (name === 'y') {
      this.y = parseNumber(value);
      return true;
    }
    if (name === 'text') {
      this.content = value;
      return true;
    }
    return false;
  }
}
