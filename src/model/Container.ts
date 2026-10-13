import type { SvgNode } from './SvgNode';
import { Shape } from './Shape';

/** Abstract parent of every node that holds children (spec: Composite semantics). */
export abstract class Container extends Shape {
  private readonly childList: Shape[] = [];

  protected constructor(id: string) {
    super(id);
  }

  public get children(): readonly Shape[] {
    return this.childList;
  }

  public override asContainer(): Container | null {
    return this;
  }

  public override isContainer(): boolean {
    return true;
  }

  public indexOf(child: Shape): number {
    return this.childList.indexOf(child);
  }

  public insert(child: Shape, index: number = this.childList.length): void {
    if (index < 0 || index > this.childList.length) {
      throw new RangeError(`insert index ${index} out of range`);
    }
    this.childList.splice(index, 0, child);
    child.parent = this;
  }

  public removeAt(index: number): Shape {
    const removed = this.childList.splice(index, 1)[0];
    if (removed === undefined) {
      throw new RangeError(`remove index ${index} out of range`);
    }
    removed.parent = null;
    return removed;
  }

  public override translate(dx: number, dy: number): void {
    for (const child of this.childList) {
      child.translate(dx, dy);
    }
  }

  public override scaleBy(factor: number): void {
    for (const child of this.childList) {
      child.scaleBy(factor);
    }
  }

  public override summary(): string {
    return '';
  }

  public override toXml(): SvgNode {
    return {
      tag: this.typeName,
      attrs: { id: this.id, ...this.presentationAttrs() },
      children: this.childList.map((child) => child.toXml()),
    };
  }

  protected override geometryAttrs(): Record<string, string> {
    return {};
  }

  protected override getGeometryAttr(_name: string): string | undefined {
    return undefined;
  }

  protected override setGeometryAttr(_name: string, _value: string): boolean {
    return false;
  }
}
