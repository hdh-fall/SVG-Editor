import { XMLParser } from 'fast-xml-parser';
import { SvgDocument } from '../model/SvgDocument';
import type { Container } from '../model/Container';
import { FileError } from '../model/errors';
import { parseNumber } from '../model/format';
import type { ShapeFactory } from '../shapes/ShapeFactory';

export interface ReadResult {
  readonly document: SvgDocument;
  readonly warnings: readonly string[];
}

/** SVG text -> `SvgDocument`. Reading is library-backed (`fast-xml-parser`). */
export class SvgReader {
  public constructor(private readonly factory: ShapeFactory) {}

  public read(text: string, source: string): ReadResult {
    const nodes = this.parse(text, source);
    const { width, height, body } = this.readRoot(nodes, source);
    const document = new SvgDocument(width, height);
    const warnings: string[] = [];
    const seen = new Set<string>([document.id]);
    this.parseChildren(body, document, warnings, seen);
    document.rebuildIndex();
    return { document, warnings };
  }

  private parse(text: string, source: string): readonly unknown[] {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      preserveOrder: true,
      trimValues: true,
      parseAttributeValue: false,
    });
    try {
      const result: unknown = parser.parse(text);
      return Array.isArray(result) ? result : [];
    } catch {
      throw FileError.read(source);
    }
  }

  private readRoot(
    nodes: readonly unknown[],
    source: string,
  ): { width: number; height: number; body: readonly unknown[] } {
    for (const node of nodes) {
      if (typeof node !== 'object' || node === null) continue;
      const record = node as Record<string, unknown>;
      if (!('svg' in record)) continue;
      const attrs = this.attributesOf(record);
      const body = Array.isArray(record['svg']) ? (record['svg'] as readonly unknown[]) : [];
      return {
        width: attrs['width'] === undefined ? 800 : parseNumber(attrs['width']),
        height: attrs['height'] === undefined ? 600 : parseNumber(attrs['height']),
        body,
      };
    }
    throw FileError.read(source);
  }

  private parseChildren(
    nodes: readonly unknown[],
    parent: Container,
    warnings: string[],
    seen: Set<string>,
  ): void {
    for (const node of nodes) {
      if (typeof node !== 'object' || node === null) continue;
      const record = node as Record<string, unknown>;
      for (const [tag, value] of Object.entries(record)) {
        if (tag === ':@' || tag.startsWith('#') || tag.startsWith('?')) continue;
        this.createElement(tag, value, record, parent, warnings, seen);
      }
    }
  }

  private createElement(
    tag: string,
    value: unknown,
    record: Record<string, unknown>,
    parent: Container,
    warnings: string[],
    seen: Set<string>,
  ): void {
    if (!this.factory.has(tag)) {
      warnings.push(`ignoring unsupported element: <${tag}>`);
      return;
    }
    const attrs = this.attributesOf(record);
    const children = Array.isArray(value) ? (value as readonly unknown[]) : [];
    const id = this.resolveId(tag, attrs, warnings, seen);

    const shapeAttrs = new Map<string, string>();
    for (const [name, attrValue] of Object.entries(attrs)) {
      if (name !== 'id') shapeAttrs.set(name, attrValue);
    }
    const content = this.textOf(children);
    if (content !== undefined) shapeAttrs.set('text', content);

    const shape = this.factory.providerFor(tag).create(id, shapeAttrs);
    for (const name of ['fill', 'stroke', 'stroke-width'] as const) {
      const attrValue = attrs[name];
      if (attrValue !== undefined && shape.canSet(name)) shape.setAttr(name, attrValue);
    }

    parent.insert(shape, parent.children.length);
    seen.add(id);

    const container = shape.asContainer();
    if (container !== null) {
      this.parseChildren(children, container, warnings, seen);
    }
  }

  private resolveId(
    tag: string,
    attrs: Record<string, string>,
    warnings: string[],
    seen: Set<string>,
  ): string {
    const explicit = attrs['id'];
    if (explicit !== undefined && explicit !== '') {
      return explicit;
    }
    let index = 1;
    let candidate = `${tag}${index}`;
    while (seen.has(candidate)) {
      index += 1;
      candidate = `${tag}${index}`;
    }
    warnings.push(`assigned id ${candidate} to unnamed <${tag}>`);
    return candidate;
  }

  private textOf(children: readonly unknown[]): string | undefined {
    const parts: string[] = [];
    for (const child of children) {
      if (typeof child !== 'object' || child === null) continue;
      const value = (child as Record<string, unknown>)['#text'];
      if (typeof value === 'string') parts.push(value);
    }
    return parts.length === 0 ? undefined : parts.join('');
  }

  private attributesOf(record: Record<string, unknown>): Record<string, string> {
    const raw = record[':@'];
    if (typeof raw !== 'object' || raw === null) return {};
    const attrs: Record<string, string> = {};
    for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
      attrs[name] = String(value);
    }
    return attrs;
  }
}
