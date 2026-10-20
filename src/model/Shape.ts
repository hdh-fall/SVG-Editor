import type { SvgNode } from './SvgNode';
import type { Container } from './Container';
import { UnknownAttributeError } from './errors';
import { formatNumber, parseNumber } from './format';

/**
 * Abstract base of every element in the document tree.
 *
 * Geometry lives in the subclasses; only presentation attributes are shared here.
 * `setAttr` is polymorphic: the base handles presentation, the subclass handles
 * geometry, and anything left over is an error — there is no central switch on
 * shape type anywhere in the codebase.
 */
export abstract class Shape {
  private static readonly PRESENTATION_ATTRS = new Set(['fill', 'stroke', 'stroke-width']);

  public readonly id: string;

  private parentValue: Container | null = null;

  /** Owning container; `null` only for the document root itself. */
  public get parent(): Container | null {
    return this.parentValue;
  }

  /**
   * Maintained only by `Container.insert` / `Container.removeAt`; callers mutate
   * structure through `SvgDocument.attach` / `SvgDocument.detach`, never directly.
   */
  public setParent(parent: Container | null): void {
    this.parentValue = parent;
  }

  private fillValue: string | undefined;
  private strokeValue: string | undefined;
  private strokeWidthValue: number | undefined;

  protected constructor(id: string) {
    this.id = id;
  }

  public abstract readonly typeName: string;

  public abstract translate(dx: number, dy: number): void;

  public abstract scaleBy(factor: number): void;

  /** One-line geometry summary, used by `tree` (spec §5.1). */
  public abstract summary(): string;

  public isContainer(): boolean {
    return false;
  }

  /** Runtime narrowing helper, so callers never need `instanceof`. */
  public asContainer(): Container | null {
    return null;
  }

  /** First point of the shape, for `move` feedback; `null` for containers (spec §6). */
  public positionAnchor(): readonly [number, number] | null {
    return null;
  }

  /** True when `setAttr(name, …)` would succeed — used to validate without mutating. */
  public canSet(name: string): boolean {
    return Shape.PRESENTATION_ATTRS.has(name) || this.getGeometryAttr(name) !== undefined;
  }

  /** Remove an optional presentation attribute (undo of setting a previously unset one). */
  public unsetAttr(name: string): void {
    if (name === 'fill') {
      this.fillValue = undefined;
      return;
    }
    if (name === 'stroke') {
      this.strokeValue = undefined;
      return;
    }
    if (name === 'stroke-width') {
      this.strokeWidthValue = undefined;
      return;
    }
    throw new UnknownAttributeError(name);
  }

  /** True for plugin types like `box` whose internals are not user-editable (spec §4.4). */
  public isComposite(): boolean {
    return false;
  }

  public setAttr(name: string, value: string): void {
    if (this.setPresentationAttr(name, value)) return;
    if (this.setGeometryAttr(name, value)) return;
    throw new UnknownAttributeError(name);
  }

  public getAttr(name: string): string | undefined {
    const presentation = this.getPresentationAttr(name);
    if (presentation !== undefined) return presentation;
    return this.getGeometryAttr(name);
  }

  public toXml(): SvgNode {
    return {
      tag: this.typeName,
      attrs: { id: this.id, ...this.geometryAttrs(), ...this.presentationAttrs() },
    };
  }

  /** Attribute name and value, in serialization order (spec §4.1). */
  protected abstract geometryAttrs(): Record<string, string>;

  protected abstract getGeometryAttr(name: string): string | undefined;

  protected abstract setGeometryAttr(name: string, value: string): boolean;

  protected presentationAttrs(): Record<string, string> {
    const attrs: Record<string, string> = {};
    if (this.fillValue !== undefined) attrs['fill'] = this.fillValue;
    if (this.strokeValue !== undefined) attrs['stroke'] = this.strokeValue;
    if (this.strokeWidthValue !== undefined) {
      attrs['stroke-width'] = formatNumber(this.strokeWidthValue);
    }
    return attrs;
  }

  private setPresentationAttr(name: string, value: string): boolean {
    if (name === 'fill') {
      this.fillValue = value;
      return true;
    }
    if (name === 'stroke') {
      this.strokeValue = value;
      return true;
    }
    if (name === 'stroke-width') {
      this.strokeWidthValue = parseNumber(value);
      return true;
    }
    return false;
  }

  private getPresentationAttr(name: string): string | undefined {
    if (name === 'fill') return this.fillValue;
    if (name === 'stroke') return this.strokeValue;
    if (name === 'stroke-width') {
      return this.strokeWidthValue === undefined ? undefined : formatNumber(this.strokeWidthValue);
    }
    return undefined;
  }
}
