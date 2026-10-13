# PJ1 Phase 1 — CLI SVG 编辑器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a REPL-driven SVG editor in TypeScript that creates, edits, queries, serializes and undoes operations on an SVG document tree.

**Architecture:** Layered — `cli → parser → commands → model`, with `io` and `shapes` as inward dependencies of `commands`. Domain model is a Composite tree (`Shape` → `Container` → `Group`, plus leaf shapes). Every edit is a Command object holding the minimal memento needed to undo itself. Two and only two name-based dispatch points exist: `CommandRegistry` and `ShapeFactory`.

**Tech Stack:** TypeScript 5.9 (ESM, `moduleResolution: bundler`), Node ≥ 20, `tsx` (dev runner), Vitest 5 (tests), `fast-xml-parser` (SVG reading), ESLint 10 + Prettier.

**Reference:** the authoritative spec is the course document for Phase 1 (`phase_cli_1.md`, kept outside this repo). Section numbers below (`§4.1`, `§5.1`, …) refer to it.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/model/SvgNode.ts` | Neutral XML node IR: `{ tag, attrs, children?, text? }` |
| `src/model/format.ts` | `formatNumber` / `parseNumber` — canonical numeric text |
| `src/model/errors.ts` | Every `AppError` subclass; messages match spec §4.2 verbatim |
| `src/model/Shape.ts` | Abstract base: `id`, `parent`, presentation attrs, `setAttr`/`getAttr`, `toXml` |
| `src/model/Rect.ts` `Circle.ts` `Ellipse.ts` `Line.ts` `Text.ts` | Leaf shapes, each with its own geometry |
| `src/model/Container.ts` | Abstract: child list, insert/remove, recursive `translate`/`scaleBy`, `toXml` |
| `src/model/Group.ts` | `<g>` container |
| `src/model/SvgDocument.ts` | Root container + canvas size + id index + tree mutation entry points |
| `src/shapes/ShapeProvider.ts` | Plugin interface: type name, CLI param spec, `create` |
| `src/shapes/ShapeFactory.ts` | **Dispatch point #2** — maps type name → provider |
| `src/shapes/builtin/*.ts` | Six providers (rect, circle, ellipse, line, text, g) |
| `src/parser/Tokenizer.ts` | Line → tokens (handles `"quoted"` strings, `#` comments, `in` clause) |
| `src/parser/CommandParser.ts` | Parsed `{ name, positional, inContainer }` |
| `src/commands/Command.ts` | Command interface: `execute`, `undo`, `isUndoable`, `isDisplay?`, `warnings?`, `successMessage` |
| `src/commands/*.ts` | One command per file (including the display commands `Tree` / `Show` / `Help`) |
| `src/commands/CommandRegistry.ts` | **Dispatch point #1** — maps command name → builder |
| `src/commands/HistoryCommand.ts` | Port for `undo` / `redo` so no editing command ever imports `history/` |
| `src/history/HistoryManager.ts` | undo/redo stacks + IO lock |
| `src/io/FileStore.ts` `NodeFileStore.ts` `MemoryFileStore.ts` | Port interface + real (`node:fs`) and in-memory implementations |
| `src/io/SvgWriter.ts` | `SvgNode` tree → SVG text (hand-written, exact format control) |
| `src/io/SvgReader.ts` | SVG text → `SvgDocument` (via `fast-xml-parser` + `ShapeFactory`) |
| `src/cli/OutputFormatter.ts` | banner / prompt / success / warning / error line formatting |
| `src/cli/Repl.ts` | One testable `runLine`; wires parser → registry → history; routes output through the formatter |
| `src/main.ts` | Composition root |

**Test files** mirror the source tree under `test/` (`test/model/…`, `test/commands/…`). Integration transcripts live in `test/integration/`.

---

## Conventions used throughout

- **ESM, extensionless relative imports** (`import { Shape } from '../model/Shape'`) — `moduleResolution: bundler` makes this work under tsx and Vitest.
- **`verbatimModuleSyntax`** is on: type-only imports must be written `import type { … }`.
- **`noImplicitOverride`** is on: overriding/implementing any base member requires the `override` keyword.
- **No relative date/absolute path assumptions** — run every command from the repo root.
- Commit after each task; the commit message is given verbatim in the task.

---

## Task 1: Model foundation — IR, number formatting, errors

**Files:**
- Create: `src/model/SvgNode.ts`
- Create: `src/model/format.ts`
- Create: `src/model/errors.ts`
- Test: `test/model/format.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/model/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatNumber, parseNumber } from '../../src/model/format';
import { InvalidArgumentError } from '../../src/model/errors';

describe('formatNumber', () => {
  it('prints integers without a decimal point', () => {
    expect(formatNumber(130)).toBe('130');
    expect(formatNumber(0)).toBe('0');
  });

  it('keeps meaningful decimals', () => {
    expect(formatNumber(130.5)).toBe('130.5');
  });

  it('rounds floating-point noise away', () => {
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
  });
});

describe('parseNumber', () => {
  it('parses integers and decimals', () => {
    expect(parseNumber('42')).toBe(42);
    expect(parseNumber('-1.5')).toBe(-1.5);
  });

  it('throws InvalidArgumentError on non-numeric input', () => {
    expect(() => parseNumber('abc')).toThrow(InvalidArgumentError);
    expect(() => parseNumber('')).toThrow(InvalidArgumentError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/model/format.test.ts`
Expected: FAIL — cannot resolve `../../src/model/format`.

- [ ] **Step 3: Write the implementation**

Create `src/model/SvgNode.ts`:

```ts
/** Neutral, serializer-agnostic XML node: shapes produce these, the writer renders them. */
export interface SvgNode {
  readonly tag: string;
  readonly attrs: Record<string, string>;
  readonly children?: SvgNode[];
  readonly text?: string;
}
```

Create `src/model/errors.ts`:

```ts
/** Base class for every error whose message is meant to be shown to the user verbatim. */
export class AppError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class NoDocumentError extends AppError {
  public constructor() {
    super("no document. use 'init' or 'read' first");
  }
}

export class DuplicateIdError extends AppError {
  public constructor(id: string) {
    super(`id already exists: ${id}`);
  }
}

export class NoSuchShapeError extends AppError {
  public constructor(id: string) {
    super(`no such shape: ${id}`);
  }
}

export class NoSuchContainerError extends AppError {
  public constructor(id: string) {
    super(`no such container: ${id}`);
  }
}

export class NotAContainerError extends AppError {
  public constructor(id: string) {
    super(`not a container: ${id}`);
  }
}

export class UnknownShapeTypeError extends AppError {
  public constructor(type: string) {
    super(`unknown shape type: ${type} (is the plugin loaded?)`);
  }
}

export class UnknownAttributeError extends AppError {
  public constructor(attr: string) {
    super(`unknown attribute: ${attr}`);
  }
}

export class InvalidScaleFactorError extends AppError {
  public constructor() {
    super('scale factor must be positive');
  }
}

export class CannotUngroupTopLevelError extends AppError {
  public constructor(id: string) {
    super(`cannot ungroup top-level container: ${id}`);
  }
}

export class CannotUngroupCompositeError extends AppError {
  public constructor(id: string) {
    super(`cannot ungroup composite shape: ${id}`);
  }
}

export class CannotGroupIntoDescendantError extends AppError {
  public constructor(id: string) {
    super(`cannot group a container into its own descendant: ${id}`);
  }
}

export class UndoNotAllowedError extends AppError {
  public constructor() {
    super('undo not allowed after io command');
  }
}

export class NothingToUndoError extends AppError {
  public constructor() {
    super('nothing to undo');
  }
}

export class NothingToRedoError extends AppError {
  public constructor() {
    super('nothing to redo');
  }
}

export class FileError extends AppError {
  public static read(file: string): FileError {
    return new FileError(`cannot read file: ${file}`);
  }

  public static write(file: string): FileError {
    return new FileError(`cannot write file: ${file}`);
  }
}

export class InvalidArgumentError extends AppError {
  public constructor(detail: string) {
    super(`invalid argument: ${detail}`);
  }
}
```

Create `src/model/format.ts`:

```ts
import { InvalidArgumentError } from './errors';

const ROUNDING = 1e6;

/** Canonical text for a coordinate/size: no trailing `.0`, no floating-point noise. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new RangeError(`not a finite number: ${value}`);
  }
  return String(Math.round(value * ROUNDING) / ROUNDING);
}

/** Parse a user-supplied numeric token, rejecting anything non-finite. */
export function parseNumber(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === '') {
    throw new InvalidArgumentError('expected a number, got an empty value');
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    throw new InvalidArgumentError(`expected a number, got '${raw}'`);
  }
  return value;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/model/format.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/model/SvgNode.ts src/model/format.ts src/model/errors.ts test/model/format.test.ts
git commit -m "feat(model): add xml node IR, number formatting and typed errors"
```

---

## Task 2: `Shape` base class and `Rect`

**Files:**
- Create: `src/model/Shape.ts`
- Create: `src/model/Rect.ts`
- Test: `test/model/Rect.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/model/Rect.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Rect } from '../../src/model/Rect';
import { UnknownAttributeError } from '../../src/model/errors';

describe('Rect', () => {
  it('translates by mutating x and y only', () => {
    const r = new Rect('r1', 10, 20, 100, 50);
    r.translate(30, -5);
    expect(r.getAttr('x')).toBe('40');
    expect(r.getAttr('y')).toBe('15');
    expect(r.getAttr('width')).toBe('100');
  });

  it('scales position and size together', () => {
    const r = new Rect('r1', 10, 20, 100, 50);
    r.scaleBy(2);
    expect(r.getAttr('x')).toBe('20');
    expect(r.getAttr('width')).toBe('200');
    expect(r.getAttr('height')).toBe('100');
  });

  it('sets geometry, fill and stroke-width', () => {
    const r = new Rect('r1', 0, 0, 1, 1);
    r.setAttr('width', '250');
    r.setAttr('fill', '#eee');
    r.setAttr('stroke-width', '3');
    expect(r.getAttr('width')).toBe('250');
    expect(r.toXml().attrs).toEqual({
      id: 'r1',
      x: '0',
      y: '0',
      width: '250',
      height: '1',
      fill: '#eee',
      'stroke-width': '3',
    });
  });

  it('rejects an attribute outside the whitelist', () => {
    const r = new Rect('r1', 0, 0, 1, 1);
    expect(() => r.setAttr('cx', '5')).toThrow(UnknownAttributeError);
  });

  it('reads back an old value with getAttr', () => {
    const r = new Rect('r1', 0, 0, 1, 1);
    expect(r.getAttr('x')).toBe('0');
    expect(r.getAttr('fill')).toBeUndefined();
    expect(r.getAttr('nope')).toBeUndefined();
  });

  it('summarizes using the abbreviated w/h labels', () => {
    expect(new Rect('r1', 0, 0, 800, 600).summary()).toBe('x=0 y=0 w=800 h=600');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/model/Rect.test.ts`
Expected: FAIL — cannot resolve `../../src/model/Rect`.

- [ ] **Step 3: Write `Shape`**

Create `src/model/Shape.ts`:

```ts
import type { SvgNode } from './SvgNode';
import { UnknownAttributeError } from './errors';
import { formatNumber, parseNumber } from './format';

/**
 * Abstract base of every element in the document tree.
 *
 * Geometry lives in the subclasses; only presentation attributes are shared here.
 * `setAttr` is polymorphic: the base handles presentation, the subclass handles
 * geometry, and anything left over is an error — there is no central switch on
 * shape type anywhere in the codebase.
 *
 * Task 4 adds the `parent: Container | null` field (and its `import type { Container }`)
 * when `Container` exists.
 */
export abstract class Shape {
  public readonly id: string;

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
```

- [ ] **Step 4: Write `Rect`**

Create `src/model/Rect.ts`:

```ts
import { Shape } from './Shape';
import { formatNumber, parseNumber } from './format';

export class Rect extends Shape {
  public override readonly typeName = 'rect';

  private x: number;
  private y: number;
  private width: number;
  private height: number;

  public constructor(id: string, x: number, y: number, width: number, height: number) {
    super(id);
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  public translate(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }

  public scaleBy(factor: number): void {
    this.x *= factor;
    this.y *= factor;
    this.width *= factor;
    this.height *= factor;
  }

  public summary(): string {
    return `x=${formatNumber(this.x)} y=${formatNumber(this.y)} w=${formatNumber(this.width)} h=${formatNumber(this.height)}`;
  }

  protected geometryAttrs(): Record<string, string> {
    return {
      x: formatNumber(this.x),
      y: formatNumber(this.y),
      width: formatNumber(this.width),
      height: formatNumber(this.height),
    };
  }

  protected getGeometryAttr(name: string): string | undefined {
    if (name === 'x') return formatNumber(this.x);
    if (name === 'y') return formatNumber(this.y);
    if (name === 'width') return formatNumber(this.width);
    if (name === 'height') return formatNumber(this.height);
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
    if (name === 'width') {
      this.width = parseNumber(value);
      return true;
    }
    if (name === 'height') {
      this.height = parseNumber(value);
      return true;
    }
    return false;
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run test/model/Rect.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/model/Shape.ts src/model/Rect.ts test/model/Rect.test.ts
git commit -m "feat(model): add Shape base class and Rect"
```

---

## Task 3: Remaining leaf shapes — Circle, Ellipse, Line, Text

**Files:**
- Create: `src/model/Circle.ts`
- Create: `src/model/Ellipse.ts`
- Create: `src/model/Line.ts`
- Create: `src/model/Text.ts`
- Test: `test/model/leaves.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/model/leaves.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Circle } from '../../src/model/Circle';
import { Ellipse } from '../../src/model/Ellipse';
import { Line } from '../../src/model/Line';
import { Text } from '../../src/model/Text';
import { UnknownAttributeError } from '../../src/model/errors';

describe('Circle', () => {
  it('translates the centre only and scales the radius', () => {
    const c = new Circle('c1', 100, 100, 20);
    c.translate(30, 0);
    c.scaleBy(2);
    expect(c.summary()).toBe('cx=260 cy=200 r=40');
  });

  it('serializes cx/cy/r', () => {
    expect(new Circle('c1', 50, 50, 10).toXml().attrs).toEqual({
      id: 'c1',
      cx: '50',
      cy: '50',
      r: '10',
    });
  });

  it('rejects a foreign attribute', () => {
    expect(() => new Circle('c1', 0, 0, 1).setAttr('x', '1')).toThrow(UnknownAttributeError);
  });
});

describe('Ellipse', () => {
  it('translates the centre and scales both radii', () => {
    const e = new Ellipse('e1', 1, 2, 3, 4);
    e.translate(1, 1);
    e.scaleBy(2);
    expect(e.summary()).toBe('cx=4 cy=6 rx=6 ry=8');
  });
});

describe('Line', () => {
  it('translates both endpoints and scales all four coordinates', () => {
    const l = new Line('l1', 0, 0, 10, 10);
    l.translate(5, 0);
    l.scaleBy(2);
    expect(l.summary()).toBe('(10,0) -> (30,20)');
  });

  it('defaults stroke to undefined but accepts one', () => {
    const l = new Line('l1', 0, 0, 1, 1);
    expect(l.getAttr('stroke')).toBeUndefined();
    l.setAttr('stroke', 'black');
    expect(l.toXml().attrs['stroke']).toBe('black');
  });
});

describe('Text', () => {
  it('translates the anchor and keeps content', () => {
    const t = new Text('t1', 20, 40, 'My Diagram');
    t.translate(5, 5);
    t.scaleBy(2);
    expect(t.summary()).toBe('(50,90) "My Diagram"');
  });

  it('exposes content through the `text` attribute name', () => {
    const t = new Text('t1', 0, 0, 'a');
    t.setAttr('text', 'b');
    expect(t.getAttr('text')).toBe('b');
    expect(t.toXml()).toEqual({ tag: 'text', attrs: { id: 't1', x: '0', y: '0' }, text: 'b' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/model/leaves.test.ts`
Expected: FAIL — modules `Circle` / `Ellipse` / `Line` / `Text` not found.

- [ ] **Step 3: Write `Circle`**

Create `src/model/Circle.ts`:

```ts
import { Shape } from './Shape';
import { formatNumber, parseNumber } from './format';

export class Circle extends Shape {
  public override readonly typeName = 'circle';

  private cx: number;
  private cy: number;
  private r: number;

  public constructor(id: string, cx: number, cy: number, r: number) {
    super(id);
    this.cx = cx;
    this.cy = cy;
    this.r = r;
  }

  public translate(dx: number, dy: number): void {
    this.cx += dx;
    this.cy += dy;
  }

  public scaleBy(factor: number): void {
    this.cx *= factor;
    this.cy *= factor;
    this.r *= factor;
  }

  public summary(): string {
    return `cx=${formatNumber(this.cx)} cy=${formatNumber(this.cy)} r=${formatNumber(this.r)}`;
  }

  protected geometryAttrs(): Record<string, string> {
    return {
      cx: formatNumber(this.cx),
      cy: formatNumber(this.cy),
      r: formatNumber(this.r),
    };
  }

  protected getGeometryAttr(name: string): string | undefined {
    if (name === 'cx') return formatNumber(this.cx);
    if (name === 'cy') return formatNumber(this.cy);
    if (name === 'r') return formatNumber(this.r);
    return undefined;
  }

  protected setGeometryAttr(name: string, value: string): boolean {
    if (name === 'cx') {
      this.cx = parseNumber(value);
      return true;
    }
    if (name === 'cy') {
      this.cy = parseNumber(value);
      return true;
    }
    if (name === 'r') {
      this.r = parseNumber(value);
      return true;
    }
    return false;
  }
}
```

- [ ] **Step 4: Write `Ellipse`**

Create `src/model/Ellipse.ts`:

```ts
import { Shape } from './Shape';
import { formatNumber, parseNumber } from './format';

export class Ellipse extends Shape {
  public override readonly typeName = 'ellipse';

  private cx: number;
  private cy: number;
  private rx: number;
  private ry: number;

  public constructor(id: string, cx: number, cy: number, rx: number, ry: number) {
    super(id);
    this.cx = cx;
    this.cy = cy;
    this.rx = rx;
    this.ry = ry;
  }

  public translate(dx: number, dy: number): void {
    this.cx += dx;
    this.cy += dy;
  }

  public scaleBy(factor: number): void {
    this.cx *= factor;
    this.cy *= factor;
    this.rx *= factor;
    this.ry *= factor;
  }

  public summary(): string {
    return `cx=${formatNumber(this.cx)} cy=${formatNumber(this.cy)} rx=${formatNumber(this.rx)} ry=${formatNumber(this.ry)}`;
  }

  protected geometryAttrs(): Record<string, string> {
    return {
      cx: formatNumber(this.cx),
      cy: formatNumber(this.cy),
      rx: formatNumber(this.rx),
      ry: formatNumber(this.ry),
    };
  }

  protected getGeometryAttr(name: string): string | undefined {
    if (name === 'cx') return formatNumber(this.cx);
    if (name === 'cy') return formatNumber(this.cy);
    if (name === 'rx') return formatNumber(this.rx);
    if (name === 'ry') return formatNumber(this.ry);
    return undefined;
  }

  protected setGeometryAttr(name: string, value: string): boolean {
    if (name === 'cx') {
      this.cx = parseNumber(value);
      return true;
    }
    if (name === 'cy') {
      this.cy = parseNumber(value);
      return true;
    }
    if (name === 'rx') {
      this.rx = parseNumber(value);
      return true;
    }
    if (name === 'ry') {
      this.ry = parseNumber(value);
      return true;
    }
    return false;
  }
}
```

- [ ] **Step 5: Write `Line`**

Create `src/model/Line.ts`:

```ts
import { Shape } from './Shape';
import { formatNumber, parseNumber } from './format';

export class Line extends Shape {
  public override readonly typeName = 'line';

  private x1: number;
  private y1: number;
  private x2: number;
  private y2: number;

  public constructor(id: string, x1: number, y1: number, x2: number, y2: number) {
    super(id);
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
  }

  public translate(dx: number, dy: number): void {
    this.x1 += dx;
    this.y1 += dy;
    this.x2 += dx;
    this.y2 += dy;
  }

  public scaleBy(factor: number): void {
    this.x1 *= factor;
    this.y1 *= factor;
    this.x2 *= factor;
    this.y2 *= factor;
  }

  public summary(): string {
    return `(${formatNumber(this.x1)},${formatNumber(this.y1)}) -> (${formatNumber(this.x2)},${formatNumber(this.y2)})`;
  }

  protected geometryAttrs(): Record<string, string> {
    return {
      x1: formatNumber(this.x1),
      y1: formatNumber(this.y1),
      x2: formatNumber(this.x2),
      y2: formatNumber(this.y2),
    };
  }

  protected getGeometryAttr(name: string): string | undefined {
    if (name === 'x1') return formatNumber(this.x1);
    if (name === 'y1') return formatNumber(this.y1);
    if (name === 'x2') return formatNumber(this.x2);
    if (name === 'y2') return formatNumber(this.y2);
    return undefined;
  }

  protected setGeometryAttr(name: string, value: string): boolean {
    if (name === 'x1') {
      this.x1 = parseNumber(value);
      return true;
    }
    if (name === 'y1') {
      this.y1 = parseNumber(value);
      return true;
    }
    if (name === 'x2') {
      this.x2 = parseNumber(value);
      return true;
    }
    if (name === 'y2') {
      this.y2 = parseNumber(value);
      return true;
    }
    return false;
  }
}
```

- [ ] **Step 6: Write `Text`**

Create `src/model/Text.ts`:

```ts
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
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run test/model/leaves.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 8: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/model/Circle.ts src/model/Ellipse.ts src/model/Line.ts src/model/Text.ts test/model/leaves.test.ts
git commit -m "feat(model): add Circle, Ellipse, Line and Text shapes"
```

## Task 4: Container and Group (Composite)

**Files:**
- Create: `src/model/Container.ts`
- Create: `src/model/Group.ts`
- Modify: `src/model/Shape.ts` (add `parent` and `asContainer`)
- Test: `test/model/Group.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/model/Group.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Group } from '../../src/model/Group';
import { Rect } from '../../src/model/Rect';
import { Circle } from '../../src/model/Circle';

describe('Group', () => {
  it('recurses translate into every descendant, at any depth', () => {
    const outer = new Group('outer');
    const inner = new Group('inner');
    const rect = new Rect('r', 0, 0, 10, 10);
    outer.insert(inner);
    inner.insert(rect);

    outer.translate(5, 7);

    expect(rect.summary()).toBe('x=5 y=7 w=10 h=10');
  });

  it('recurses scaleBy into every descendant', () => {
    const group = new Group('g');
    const circle = new Circle('c', 10, 10, 5);
    group.insert(circle);

    group.scaleBy(3);

    expect(circle.summary()).toBe('cx=30 cy=30 r=15');
  });

  it('sets parent on insert and clears it on removal', () => {
    const group = new Group('g');
    const rect = new Rect('r', 0, 0, 1, 1);
    group.insert(rect);
    expect(rect.parent).toBe(group);
    expect(group.children).toHaveLength(1);

    group.removeAt(0);
    expect(rect.parent).toBeNull();
    expect(group.children).toHaveLength(0);
  });

  it('inserts at an explicit index', () => {
    const group = new Group('g');
    const a = new Rect('a', 0, 0, 1, 1);
    const b = new Rect('b', 0, 0, 1, 1);
    const c = new Rect('c', 0, 0, 1, 1);
    group.insert(a);
    group.insert(b);
    group.insert(c, 1);
    expect(group.children.map((s) => s.id)).toEqual(['a', 'c', 'b']);
  });

  it('serializes as a nested <g> node', () => {
    const group = new Group('g1');
    group.insert(new Rect('r', 0, 0, 1, 1));
    expect(group.toXml()).toEqual({
      tag: 'g',
      attrs: { id: 'g1' },
      children: [{ tag: 'rect', attrs: { id: 'r', x: '0', y: '0', width: '1', height: '1' } }],
    });
  });

  it('accepts presentation attributes but no geometry', () => {
    const group = new Group('g');
    group.setAttr('fill', 'red');
    expect(group.toXml().attrs).toEqual({ id: 'g', fill: 'red' });
    expect(() => group.setAttr('width', '5')).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/model/Group.test.ts`
Expected: FAIL — cannot resolve `../../src/model/Group`.

- [ ] **Step 3: Add `parent` and `asContainer` to `Shape`**

`Container` exists now, so the base class can finally refer to it. In `src/model/Shape.ts`:

a) Add this import as the first line of the file:

```ts
import type { Container } from './Container';
```

b) Add the `parent` field immediately after the `id` field:

```ts
  /** Owning container; `null` only for the document root itself. */
  public parent: Container | null = null;
```

c) Add this method immediately after `isContainer()`:

```ts
  /** Runtime narrowing helper, so callers never need `instanceof`. */
  public asContainer(): Container | null {
    return null;
  }
```

- [ ] **Step 4: Write `Container`**

Create `src/model/Container.ts`:

```ts
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
```

- [ ] **Step 5: Write `Group`**

Create `src/model/Group.ts`:

```ts
import { Container } from './Container';

export class Group extends Container {
  public override readonly typeName = 'g';

  public constructor(id: string) {
    super(id);
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run test/model/Group.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 7: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/model/Container.ts src/model/Group.ts src/model/Shape.ts test/model/Group.test.ts
git commit -m "feat(model): add Container and Group with composite semantics"
```

---

## Task 5: SvgDocument — canvas, id index, tree mutation

**Files:**
- Create: `src/model/SvgDocument.ts`
- Test: `test/model/SvgDocument.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/model/SvgDocument.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SvgDocument } from '../../src/model/SvgDocument';
import { Group } from '../../src/model/Group';
import { Rect } from '../../src/model/Rect';
import { DuplicateIdError, NoSuchShapeError, NotAContainerError } from '../../src/model/errors';

describe('SvgDocument', () => {
  it('finds shapes at any depth', () => {
    const doc = new SvgDocument(800, 600);
    const group = new Group('g');
    const rect = new Rect('r', 0, 0, 1, 1);
    doc.attach(group, { parent: doc, index: 0 });
    doc.attach(rect, { parent: group, index: 0 });

    expect(doc.find('r')).toBe(rect);
    expect(doc.find('nope')).toBeNull();
  });

  it('reports a duplicate id', () => {
    const doc = new SvgDocument(800, 600);
    doc.attach(new Rect('r', 0, 0, 1, 1), { parent: doc, index: 0 });
    expect(() => doc.assertIdFree('r')).toThrow(DuplicateIdError);
    expect(() => doc.assertIdFree('other')).not.toThrow();
  });

  it('distinguishes a missing container from a non-container', () => {
    const doc = new SvgDocument(800, 600);
    doc.attach(new Rect('r', 0, 0, 1, 1), { parent: doc, index: 0 });
    expect(() => doc.requireContainer('nope')).toThrow(/no such container: nope/);
    expect(() => doc.requireContainer('r')).toThrow(NotAContainerError);
  });

  it('detaches with a location that can be replayed', () => {
    const doc = new SvgDocument(800, 600);
    const a = new Rect('a', 0, 0, 1, 1);
    const b = new Rect('b', 0, 0, 1, 1);
    doc.attach(a, { parent: doc, index: 0 });
    doc.attach(b, { parent: doc, index: 1 });

    const location = doc.detach(a);
    expect(doc.children.map((s) => s.id)).toEqual(['b']);
    expect(doc.find('a')).toBeNull();

    doc.attach(a, location);
    expect(doc.children.map((s) => s.id)).toEqual(['a', 'b']);
    expect(doc.find('a')).toBe(a);
  });

  it('requires a real shape', () => {
    const doc = new SvgDocument(400, 300);
    expect(() => doc.requireShape('ghost')).toThrow(NoSuchShapeError);
    expect(doc.requireShape('svg')).toBe(doc);
  });

  it('serializes the root with canvas size and viewBox', () => {
    const doc = new SvgDocument(400, 200);
    expect(doc.toXml()).toEqual({
      tag: 'svg',
      attrs: {
        xmlns: 'http://www.w3.org/2000/svg',
        width: '400',
        height: '200',
        viewBox: '0 0 400 200',
      },
      children: [],
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/model/SvgDocument.test.ts`
Expected: FAIL — cannot resolve `../../src/model/SvgDocument`.

- [ ] **Step 3: Write `SvgDocument`**

Create `src/model/SvgDocument.ts`:

```ts
import { Container } from './Container';
import type { Shape } from './Shape';
import type { SvgNode } from './SvgNode';
import {
  DuplicateIdError,
  NoSuchContainerError,
  NoSuchShapeError,
  NotAContainerError,
} from './errors';
import { formatNumber } from './format';

export const ROOT_ID = 'svg';

/** Where a node sits inside the tree — enough to detach and later re-attach it. */
export interface NodeLocation {
  readonly parent: Container;
  readonly index: number;
}

/**
 * The document root: canvas size plus the whole shape tree.
 *
 * It is the single owner of structural mutation, so the id index can be rebuilt
 * after every change instead of being patched incrementally.
 */
export class SvgDocument extends Container {
  public override readonly typeName = 'svg';

  private canvasWidth: number;
  private canvasHeight: number;
  private readonly index = new Map<string, Shape>();

  public constructor(width: number, height: number) {
    super(ROOT_ID);
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.rebuildIndex();
  }

  public get width(): number {
    return this.canvasWidth;
  }

  public get height(): number {
    return this.canvasHeight;
  }

  public resize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  public find(id: string): Shape | null {
    return this.index.get(id) ?? null;
  }

  public requireShape(id: string): Shape {
    const shape = this.find(id);
    if (shape === null) {
      throw new NoSuchShapeError(id);
    }
    return shape;
  }

  public requireContainer(id: string): Container {
    const shape = this.find(id);
    if (shape === null) {
      throw new NoSuchContainerError(id);
    }
    const container = shape.asContainer();
    if (container === null) {
      throw new NotAContainerError(id);
    }
    return container;
  }

  public assertIdFree(id: string): void {
    if (this.index.has(id)) {
      throw new DuplicateIdError(id);
    }
  }

  public isTopLevel(shape: Shape): boolean {
    return shape.parent === this;
  }

  public locationOf(shape: Shape): NodeLocation {
    const parent = shape.parent;
    if (parent === null) {
      throw new Error('the document root has no location');
    }
    return { parent, index: parent.indexOf(shape) };
  }

  /** Remove a node from wherever it is; the returned location can replay the move. */
  public detach(shape: Shape): NodeLocation {
    const location = this.locationOf(shape);
    location.parent.removeAt(location.index);
    this.rebuildIndex();
    return location;
  }

  public attach(shape: Shape, location: NodeLocation): void {
    const index = Math.min(location.index, location.parent.children.length);
    location.parent.insert(shape, index);
    this.rebuildIndex();
  }

  public rebuildIndex(): void {
    this.index.clear();
    this.index.set(this.id, this);
    this.indexSubtree(this);
  }

  public override toXml(): SvgNode {
    return {
      tag: 'svg',
      attrs: {
        xmlns: 'http://www.w3.org/2000/svg',
        width: formatNumber(this.canvasWidth),
        height: formatNumber(this.canvasHeight),
        viewBox: `0 0 ${formatNumber(this.canvasWidth)} ${formatNumber(this.canvasHeight)}`,
      },
      children: this.children.map((child) => child.toXml()),
    };
  }

  private indexSubtree(container: Container): void {
    for (const child of container.children) {
      this.index.set(child.id, child);
      const nested = child.asContainer();
      if (nested !== null) {
        this.indexSubtree(nested);
      }
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/model/SvgDocument.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/model/SvgDocument.ts test/model/SvgDocument.test.ts
git commit -m "feat(model): add SvgDocument with id index and tree mutation"
```

---

## Task 6: Shape plugins — provider interface, factory, built-ins

**Files:**
- Create: `src/shapes/ShapeProvider.ts`
- Create: `src/shapes/ShapeFactory.ts`
- Create: `src/shapes/builtin/rectProvider.ts`
- Create: `src/shapes/builtin/circleProvider.ts`
- Create: `src/shapes/builtin/ellipseProvider.ts`
- Create: `src/shapes/builtin/lineProvider.ts`
- Create: `src/shapes/builtin/textProvider.ts`
- Create: `src/shapes/builtin/gProvider.ts`
- Test: `test/shapes/ShapeFactory.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/shapes/ShapeFactory.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDefaultShapeFactory } from '../../src/shapes/ShapeFactory';
import { Rect } from '../../src/model/Rect';
import { Group } from '../../src/model/Group';
import { Text } from '../../src/model/Text';
import { UnknownShapeTypeError } from '../../src/model/errors';

const factory = createDefaultShapeFactory();

describe('createDefaultShapeFactory', () => {
  it('knows the six built-in types and nothing else', () => {
    for (const type of ['rect', 'circle', 'ellipse', 'line', 'text', 'g']) {
      expect(factory.has(type)).toBe(true);
    }
    expect(factory.has('box')).toBe(false);
  });

  it('builds a rect from its attribute record', () => {
    const rect = factory.providerFor('rect').create('r1', new Map([
      ['x', '10'],
      ['y', '20'],
      ['width', '100'],
      ['height', '50'],
      ['fill', '#eee'],
    ]));
    expect(rect).toBeInstanceOf(Rect);
    expect(rect.toXml().attrs).toEqual({
      id: 'r1',
      x: '10',
      y: '20',
      width: '100',
      height: '50',
      fill: '#eee',
    });
  });

  it('builds an empty group', () => {
    const group = factory.providerFor('g').create('g1', new Map()) as Group;
    expect(group).toBeInstanceOf(Group);
    expect(group.children).toHaveLength(0);
  });

  it('keeps text content out of the attribute list', () => {
    const text = factory.providerFor('text').create('t1', new Map([
      ['x', '20'],
      ['y', '40'],
      ['text', 'My Diagram'],
    ]));
    expect(text).toBeInstanceOf(Text);
    expect(text.toXml()).toEqual({
      tag: 'text',
      attrs: { id: 't1', x: '20', y: '40' },
      text: 'My Diagram',
    });
  });

  it('reports an unregistered type', () => {
    expect(() => factory.providerFor('box')).toThrow(UnknownShapeTypeError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/shapes/ShapeFactory.test.ts`
Expected: FAIL — cannot resolve `../../src/shapes/ShapeFactory`.

- [ ] **Step 3: Write the provider interface**

Create `src/shapes/ShapeProvider.ts`:

```ts
import type { Shape } from '../model/Shape';

/** One CLI parameter following `<id>` in a `create` command (spec §4.1). */
export interface ParamSpec {
  /** SVG attribute the token fills (or the pseudo-attribute `text`). */
  readonly name: string;
  readonly numeric: boolean;
  readonly optional: boolean;
}

/**
 * The plugin seam: the kernel never knows a shape type by name — it only consumes
 * providers. A future `box` plugin ships one of these and changes no kernel code.
 */
export interface ShapeProvider {
  readonly typeName: string;
  readonly params: readonly ParamSpec[];
  /** Build the shape from a full attribute record (`create` and the SVG reader both use this). */
  create(id: string, attrs: ReadonlyMap<string, string>): Shape;
}
```

- [ ] **Step 4: Write the six built-in providers**

Create `src/shapes/builtin/rectProvider.ts`:

```ts
import { Rect } from '../../model/Rect';
import { parseNumber } from '../../model/format';
import type { ShapeProvider } from '../ShapeProvider';

export const rectProvider: ShapeProvider = {
  typeName: 'rect',
  params: [
    { name: 'x', numeric: true, optional: false },
    { name: 'y', numeric: true, optional: false },
    { name: 'width', numeric: true, optional: false },
    { name: 'height', numeric: true, optional: false },
    { name: 'fill', numeric: false, optional: true },
  ],
  create(id, attrs) {
    const rect = new Rect(
      id,
      parseNumber(attrs.get('x') ?? '0'),
      parseNumber(attrs.get('y') ?? '0'),
      parseNumber(attrs.get('width') ?? '0'),
      parseNumber(attrs.get('height') ?? '0'),
    );
    for (const name of ['fill', 'stroke'] as const) {
      const value = attrs.get(name);
      if (value !== undefined) rect.setAttr(name, value);
    }
    return rect;
  },
};
```

Create `src/shapes/builtin/circleProvider.ts`:

```ts
import { Circle } from '../../model/Circle';
import { parseNumber } from '../../model/format';
import type { ShapeProvider } from '../ShapeProvider';

export const circleProvider: ShapeProvider = {
  typeName: 'circle',
  params: [
    { name: 'cx', numeric: true, optional: false },
    { name: 'cy', numeric: true, optional: false },
    { name: 'r', numeric: true, optional: false },
    { name: 'fill', numeric: false, optional: true },
  ],
  create(id, attrs) {
    const circle = new Circle(
      id,
      parseNumber(attrs.get('cx') ?? '0'),
      parseNumber(attrs.get('cy') ?? '0'),
      parseNumber(attrs.get('r') ?? '0'),
    );
    for (const name of ['fill', 'stroke'] as const) {
      const value = attrs.get(name);
      if (value !== undefined) circle.setAttr(name, value);
    }
    return circle;
  },
};
```

Create `src/shapes/builtin/ellipseProvider.ts`:

```ts
import { Ellipse } from '../../model/Ellipse';
import { parseNumber } from '../../model/format';
import type { ShapeProvider } from '../ShapeProvider';

export const ellipseProvider: ShapeProvider = {
  typeName: 'ellipse',
  params: [
    { name: 'cx', numeric: true, optional: false },
    { name: 'cy', numeric: true, optional: false },
    { name: 'rx', numeric: true, optional: false },
    { name: 'ry', numeric: true, optional: false },
    { name: 'fill', numeric: false, optional: true },
  ],
  create(id, attrs) {
    const ellipse = new Ellipse(
      id,
      parseNumber(attrs.get('cx') ?? '0'),
      parseNumber(attrs.get('cy') ?? '0'),
      parseNumber(attrs.get('rx') ?? '0'),
      parseNumber(attrs.get('ry') ?? '0'),
    );
    for (const name of ['fill', 'stroke'] as const) {
      const value = attrs.get(name);
      if (value !== undefined) ellipse.setAttr(name, value);
    }
    return ellipse;
  },
};
```

Create `src/shapes/builtin/lineProvider.ts`:

```ts
import { Line } from '../../model/Line';
import { parseNumber } from '../../model/format';
import type { ShapeProvider } from '../ShapeProvider';

export const lineProvider: ShapeProvider = {
  typeName: 'line',
  params: [
    { name: 'x1', numeric: true, optional: false },
    { name: 'y1', numeric: true, optional: false },
    { name: 'x2', numeric: true, optional: false },
    { name: 'y2', numeric: true, optional: false },
    { name: 'stroke', numeric: false, optional: true },
  ],
  create(id, attrs) {
    const line = new Line(
      id,
      parseNumber(attrs.get('x1') ?? '0'),
      parseNumber(attrs.get('y1') ?? '0'),
      parseNumber(attrs.get('x2') ?? '0'),
      parseNumber(attrs.get('y2') ?? '0'),
    );
    const stroke = attrs.get('stroke');
    if (stroke !== undefined) line.setAttr('stroke', stroke);
    return line;
  },
};
```

Create `src/shapes/builtin/textProvider.ts`:

```ts
import { Text } from '../../model/Text';
import { parseNumber } from '../../model/format';
import type { ShapeProvider } from '../ShapeProvider';

export const textProvider: ShapeProvider = {
  typeName: 'text',
  params: [
    { name: 'x', numeric: true, optional: false },
    { name: 'y', numeric: true, optional: false },
    { name: 'text', numeric: false, optional: false },
  ],
  create(id, attrs) {
    const text = new Text(
      id,
      parseNumber(attrs.get('x') ?? '0'),
      parseNumber(attrs.get('y') ?? '0'),
      attrs.get('text') ?? '',
    );
    const fill = attrs.get('fill');
    if (fill !== undefined) text.setAttr('fill', fill);
    return text;
  },
};
```

Create `src/shapes/builtin/gProvider.ts`:

```ts
import { Group } from '../../model/Group';
import type { ShapeProvider } from '../ShapeProvider';

export const gProvider: ShapeProvider = {
  typeName: 'g',
  params: [],
  create(id) {
    return new Group(id);
  },
};
```

- [ ] **Step 5: Write the factory**

Create `src/shapes/ShapeFactory.ts`:

```ts
import { UnknownShapeTypeError } from '../model/errors';
import type { ShapeProvider } from './ShapeProvider';
import { circleProvider } from './builtin/circleProvider';
import { ellipseProvider } from './builtin/ellipseProvider';
import { gProvider } from './builtin/gProvider';
import { lineProvider } from './builtin/lineProvider';
import { rectProvider } from './builtin/rectProvider';
import { textProvider } from './builtin/textProvider';

/**
 * Dispatch point #2 of 2 (spec §2.1): type name -> provider.
 * TODO(refactor): load providers from a plugin registry instead of a hard-coded list.
 */
export class ShapeFactory {
  private readonly providers = new Map<string, ShapeProvider>();

  public register(provider: ShapeProvider): void {
    this.providers.set(provider.typeName, provider);
  }

  public has(typeName: string): boolean {
    return this.providers.has(typeName);
  }

  public providerFor(typeName: string): ShapeProvider {
    const provider = this.providers.get(typeName);
    if (provider === undefined) {
      throw new UnknownShapeTypeError(typeName);
    }
    return provider;
  }
}

export function createDefaultShapeFactory(): ShapeFactory {
  const factory = new ShapeFactory();
  const builtins: readonly ShapeProvider[] = [
    rectProvider,
    circleProvider,
    ellipseProvider,
    lineProvider,
    textProvider,
    gProvider,
  ];
  for (const provider of builtins) {
    factory.register(provider);
  }
  return factory;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run test/shapes/ShapeFactory.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 7: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/shapes test/shapes
git commit -m "feat(shapes): add ShapeProvider plugin seam and built-in factory"
```

---

## Task 7: Parser — tokenizer and command line parsing

**Files:**
- Create: `src/parser/Tokenizer.ts`
- Create: `src/parser/CommandParser.ts`
- Test: `test/parser/Tokenizer.test.ts`
- Test: `test/parser/CommandParser.test.ts`

- [ ] **Step 1: Write the failing tokenizer test**

Create `test/parser/Tokenizer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Tokenizer } from '../../src/parser/Tokenizer';
import { InvalidArgumentError } from '../../src/model/errors';

const tokenizer = new Tokenizer();

describe('Tokenizer', () => {
  it('splits on runs of whitespace', () => {
    expect(tokenizer.tokenize('move   r1   10   20').map((t) => t.value)).toEqual([
      'move',
      'r1',
      '10',
      '20',
    ]);
  });

  it('treats a leading # as a whole-line comment', () => {
    expect(tokenizer.tokenize('# create rect r1 0 0 1 1')).toEqual([]);
    expect(tokenizer.tokenize('   # indented comment')).toEqual([]);
  });

  it('does NOT treat a mid-line # as a comment (colour literals)', () => {
    expect(tokenizer.tokenize('create rect r1 0 0 1 1 #ffffff').at(-1)).toEqual({
      value: '#ffffff',
      quoted: false,
    });
  });

  it('keeps a quoted string as one token and drops the quotes', () => {
    expect(tokenizer.tokenize('create text t1 20 40 "My Diagram"')).toEqual([
      { value: 'create', quoted: false },
      { value: 'text', quoted: false },
      { value: 't1', quoted: false },
      { value: '20', quoted: false },
      { value: '40', quoted: false },
      { value: 'My Diagram', quoted: true },
    ]);
  });

  it('rejects an unterminated quote', () => {
    expect(() => tokenizer.tokenize('create text t1 0 0 "oops')).toThrow(InvalidArgumentError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/parser/Tokenizer.test.ts`
Expected: FAIL — cannot resolve `../../src/parser/Tokenizer`.

- [ ] **Step 3: Write `Tokenizer`**

Create `src/parser/Tokenizer.ts`:

```ts
import { InvalidArgumentError } from '../model/errors';

export interface Token {
  readonly value: string;
  readonly quoted: boolean;
}

/**
 * Line -> tokens. `#` only starts a comment at the start of a line, so colour
 * literals like `#ffffff` survive as ordinary tokens (spec §2).
 */
export class Tokenizer {
  public tokenize(line: string): Token[] {
    if (line.trimStart().startsWith('#')) {
      return [];
    }

    const tokens: Token[] = [];
    let cursor = 0;

    while (cursor < line.length) {
      const ch = line[cursor]!;
      if (ch === ' ' || ch === '\t') {
        cursor += 1;
        continue;
      }
      if (ch === '"') {
        const end = line.indexOf('"', cursor + 1);
        if (end === -1) {
          throw new InvalidArgumentError('unterminated quoted string');
        }
        tokens.push({ value: line.slice(cursor + 1, end), quoted: true });
        cursor = end + 1;
        continue;
      }
      let end = cursor;
      while (end < line.length && line[end] !== ' ' && line[end] !== '\t') {
        end += 1;
      }
      tokens.push({ value: line.slice(cursor, end), quoted: false });
      cursor = end;
    }

    return tokens;
  }
}
```

- [ ] **Step 4: Run the tokenizer test**

Run: `npx vitest run test/parser/Tokenizer.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Write the failing parser test**

Create `test/parser/CommandParser.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CommandParser } from '../../src/parser/CommandParser';

const parser = new CommandParser();

describe('CommandParser', () => {
  it('returns null for blank lines and comments', () => {
    expect(parser.parse('')).toBeNull();
    expect(parser.parse('   ')).toBeNull();
    expect(parser.parse('# a comment')).toBeNull();
  });

  it('separates the command name from its arguments', () => {
    expect(parser.parse('create rect r1 0 0 10 5')).toEqual({
      name: 'create',
      positional: ['rect', 'r1', '0', '0', '10', '5'],
      inContainer: null,
    });
  });

  it('extracts a trailing `in <container>` clause', () => {
    expect(parser.parse('create rect r1 0 0 10 5 in node1')).toEqual({
      name: 'create',
      positional: ['rect', 'r1', '0', '0', '10', '5'],
      inContainer: 'node1',
    });
  });

  it('does not mistake a quoted "in" for the clause', () => {
    expect(parser.parse('set title text "in"')).toEqual({
      name: 'set',
      positional: ['title', 'text', 'in'],
      inContainer: null,
    });
  });

  it('keeps a quoted argument with spaces intact', () => {
    expect(parser.parse('set title text "My Diagram v2"')).toEqual({
      name: 'set',
      positional: ['title', 'text', 'My Diagram v2'],
      inContainer: null,
    });
  });
});
```

- [ ] **Step 6: Write `CommandParser`**

Create `src/parser/CommandParser.ts`:

```ts
import { Tokenizer, type Token } from './Tokenizer';

export interface ParsedCommand {
  readonly name: string;
  readonly positional: readonly string[];
  readonly inContainer: string | null;
}

/** Tokens -> `{ name, positional, inContainer }`. Grammar is fixed and tiny (spec §3). */
export class CommandParser {
  private readonly tokenizer = new Tokenizer();

  public parse(line: string): ParsedCommand | null {
    const tokens = this.tokenizer.tokenize(line);
    if (tokens.length === 0) {
      return null;
    }

    const name = tokens[0]!.value;
    const rest = tokens.slice(1);
    const clauseIndex = this.findInClause(rest);

    if (clauseIndex === -1) {
      return { name, positional: rest.map((t) => t.value), inContainer: null };
    }

    return {
      name,
      positional: rest.slice(0, clauseIndex).map((t) => t.value),
      inContainer: rest[clauseIndex + 1]!.value,
    };
  }

  /** Index of the `in` keyword when it forms a trailing `in <id>` pair, else -1. */
  private findInClause(tokens: readonly Token[]): number {
    const index = tokens.length - 2;
    if (index < 0) {
      return -1;
    }
    const candidate = tokens[index]!;
    return candidate.value === 'in' && !candidate.quoted ? index : -1;
  }
}
```

- [ ] **Step 7: Run the parser tests**

Run: `npx vitest run test/parser`
Expected: PASS — 10 tests.

- [ ] **Step 8: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/parser test/parser
git commit -m "feat(parser): add tokenizer and command line parser"
```

## Task 8: Command infrastructure, Create and Delete

**Files:**
- Modify: `src/model/errors.ts` (add `UnknownCommandError`)
- Create: `src/commands/AppContext.ts`
- Create: `src/commands/Command.ts`
- Create: `src/commands/CommandRegistry.ts`
- Create: `src/commands/CreateCommand.ts`
- Create: `src/commands/DeleteCommand.ts`
- Test: `test/commands/CreateCommand.test.ts`

- [ ] **Step 1: Add `UnknownCommandError`**

In `src/model/errors.ts`, add after `UnknownShapeTypeError`:

```ts
export class UnknownCommandError extends AppError {
  public constructor(name: string) {
    super(`unknown command: ${name}`);
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `test/commands/CreateCommand.test.ts`. Note the test builds a real `AppContext` through a small helper — create `test/helpers/makeContext.ts` first:

```ts
import { SvgDocument } from '../../src/model/SvgDocument';
import { MemoryFileStore } from '../../src/io/MemoryFileStore';
import { createDefaultShapeFactory } from '../../src/shapes/ShapeFactory';
import type { AppContext } from '../../src/commands/AppContext';
import { NoDocumentError } from '../../src/model/errors';

export function makeContext(width = 800, height = 600): AppContext {
  let document: SvgDocument | null = new SvgDocument(width, height);
  let savePath: string | null = null;
  return {
    getDocument: () => document,
    requireDocument: () => {
      if (document === null) throw new NoDocumentError();
      return document;
    },
    setDocument: (next) => {
      document = next;
    },
    getSavePath: () => savePath,
    setSavePath: (path) => {
      savePath = path;
    },
    factory: createDefaultShapeFactory(),
    fileStore: new MemoryFileStore(),
  };
}

/** A context with no document yet, for `init` / `read` tests. */
export function emptyContext(): AppContext {
  let document: SvgDocument | null = null;
  let savePath: string | null = null;
  return {
    getDocument: () => document,
    requireDocument: () => {
      if (document === null) throw new NoDocumentError();
      return document;
    },
    setDocument: (next) => {
      document = next;
    },
    getSavePath: () => savePath,
    setSavePath: (path) => {
      savePath = path;
    },
    factory: createDefaultShapeFactory(),
    fileStore: new MemoryFileStore(),
  };
}
```

> `MemoryFileStore` is created in Task 12. Create it now so this helper compiles — a throwaway stand-in is fine, it is replaced verbatim in Task 12:
>
> ```ts
> // src/io/MemoryFileStore.ts
> import type { FileStore } from './FileStore';
> export class MemoryFileStore implements FileStore {
>   private readonly files = new Map<string, string>();
>   public read(path: string): string { const f = this.files.get(path); if (f === undefined) throw new Error('missing'); return f; }
>   public write(path: string, content: string): void { this.files.set(path, content); }
>   public exists(path: string): boolean { return this.files.has(path); }
> }
> ```
>
> ```ts
> // src/io/FileStore.ts
> export interface FileStore {
>   read(path: string): string;
>   write(path: string, content: string): void;
>   exists(path: string): boolean;
> }
> ```

Now the actual test:

```ts
import { describe, expect, it } from 'vitest';
import { CommandParser } from '../../src/parser/CommandParser';
import { CreateCommand } from '../../src/commands/CreateCommand';
import { DeleteCommand } from '../../src/commands/DeleteCommand';
import { DuplicateIdError, NoSuchContainerError, NoSuchShapeError } from '../../src/model/errors';
import { makeContext } from '../helpers/makeContext';

const parser = new CommandParser();

function build(line: string, ctx: ReturnType<typeof makeContext>): CreateCommand | DeleteCommand {
  const parsed = parser.parse(line)!;
  if (parsed.name === 'create') return CreateCommand.fromArgs(parsed, ctx);
  return DeleteCommand.fromArgs(parsed, ctx);
}

describe('CreateCommand', () => {
  it('creates at the document root by default', () => {
    const ctx = makeContext();
    const cmd = build('create rect bg 0 0 800 600 #ffffff', ctx) as CreateCommand;
    cmd.execute(ctx);
    expect(ctx.requireDocument().children.map((s) => s.id)).toEqual(['bg']);
    expect(cmd.successMessage()).toBe('rect#bg created');
  });

  it('creates inside a container given by the `in` clause', () => {
    const ctx = makeContext();
    build('create g node1', ctx).execute(ctx);
    const cmd = build('create rect start 120 100 160 60 #4a90d9 in node1', ctx) as CreateCommand;
    cmd.execute(ctx);
    expect(cmd.successMessage()).toBe('rect#start created in g#node1');
    expect(ctx.requireDocument().requireContainer('node1').children.map((s) => s.id)).toEqual([
      'start',
    ]);
  });

  it('rejects a duplicate id', () => {
    const ctx = makeContext();
    build('create rect bg 0 0 1 1', ctx).execute(ctx);
    const cmd = build('create rect bg 0 0 1 1', ctx);
    expect(() => cmd.execute(ctx)).toThrow(DuplicateIdError);
  });

  it('rejects a missing container', () => {
    const ctx = makeContext();
    expect(() => build('create rect r 0 0 1 1 in nope', ctx).execute(ctx)).toThrow(
      NoSuchContainerError,
    );
  });

  it('undo removes the shape and redo puts it back in the same place', () => {
    const ctx = makeContext();
    const doc = ctx.requireDocument();
    build('create rect a 0 0 1 1', ctx).execute(ctx);
    const cmd = build('create rect b 0 0 1 1', ctx);
    cmd.execute(ctx);

    cmd.undo(ctx);
    expect(doc.children.map((s) => s.id)).toEqual(['a']);
    cmd.execute(ctx);
    expect(doc.children.map((s) => s.id)).toEqual(['a', 'b']);
  });
});

describe('DeleteCommand', () => {
  it('deletes and restores with the original parent named', () => {
    const ctx = makeContext();
    build('create g markers', ctx).execute(ctx);
    build('create rect box 0 0 1 1 in markers', ctx).execute(ctx);

    const cmd = build('delete box', ctx) as DeleteCommand;
    cmd.execute(ctx);
    expect(cmd.successMessage()).toBe('rect#box deleted');
    expect(ctx.requireDocument().find('box')).toBeNull();

    cmd.undo(ctx);
    expect(cmd.undoMessage()).toBe('rect#box restored into g#markers');
    expect(ctx.requireDocument().requireContainer('markers').children.map((s) => s.id)).toEqual([
      'box',
    ]);
  });

  it('rejects an unknown id without touching the document', () => {
    const ctx = makeContext();
    const cmd = build('delete ghost', ctx);
    expect(() => cmd.execute(ctx)).toThrow(NoSuchShapeError);
    expect(ctx.requireDocument().children).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run test/commands/CreateCommand.test.ts`
Expected: FAIL — cannot resolve `../../src/commands/CreateCommand`.

- [ ] **Step 4: Write `FileStore` and `MemoryFileStore`** (verbatim from the note above)

- [ ] **Step 5: Write `AppContext`**

Create `src/commands/AppContext.ts`:

```ts
import type { SvgDocument } from '../model/SvgDocument';
import type { FileStore } from '../io/FileStore';
import type { ShapeFactory } from '../shapes/ShapeFactory';

/**
 * Everything a command is allowed to touch. Deliberately does NOT expose the
 * undo stack — commands must stay independent of history (design §1.4).
 */
export interface AppContext {
  getDocument(): SvgDocument | null;
  requireDocument(): SvgDocument;
  setDocument(document: SvgDocument): void;
  getSavePath(): string | null;
  setSavePath(path: string | null): void;
  readonly factory: ShapeFactory;
  readonly fileStore: FileStore;
}
```

- [ ] **Step 6: Write the `Command` interface**

Create `src/commands/Command.ts`:

```ts
import type { AppContext } from './AppContext';

/** One edit, as an object that can reverse itself (design §1.3, Command pattern). */
export interface Command {
  /** false for document-class commands, which lock undo until the next edit (spec §4.3). */
  readonly isUndoable: boolean;
  /** Validate fully before mutating: a throwing `execute` must leave state untouched. */
  execute(ctx: AppContext): void;
  undo(ctx: AppContext): void;
  successMessage(): string;
  undoMessage(): string;
}
```

- [ ] **Step 7: Write `CommandRegistry`**

Create `src/commands/CommandRegistry.ts`:

```ts
import type { ParsedCommand } from '../parser/CommandParser';
import { UnknownCommandError } from '../model/errors';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

export type CommandBuilder = (args: ParsedCommand, ctx: AppContext) => Command;

/**
 * Dispatch point #1 of 2 (spec §2.1): command name -> builder.
 * TODO(refactor): replace hand-written registrations with a command plugin loader.
 */
export class CommandRegistry {
  private readonly builders = new Map<string, CommandBuilder>();

  public register(name: string, builder: CommandBuilder): void {
    this.builders.set(name, builder);
  }

  public has(name: string): boolean {
    return this.builders.has(name);
  }

  public names(): readonly string[] {
    return [...this.builders.keys()].sort();
  }

  public build(args: ParsedCommand, ctx: AppContext): Command {
    const builder = this.builders.get(args.name);
    if (builder === undefined) {
      throw new UnknownCommandError(args.name);
    }
    return builder(args, ctx);
  }
}
```

- [ ] **Step 8: Write `CreateCommand`**

Create `src/commands/CreateCommand.ts`:

```ts
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
```

- [ ] **Step 9: Write `DeleteCommand`**

Create `src/commands/DeleteCommand.ts`:

```ts
import type { NodeLocation } from '../model/SvgDocument';
import type { Shape } from '../model/Shape';
import { InvalidArgumentError } from '../model/errors';
import type { ParsedCommand } from '../parser/CommandParser';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

export class DeleteCommand implements Command {
  public readonly isUndoable = true;

  private shape: Shape | null = null;
  private location: NodeLocation | null = null;
  private parentLabel: string | null = null;

  public constructor(private readonly id: string) {}

  public static fromArgs(args: ParsedCommand, _ctx: AppContext): DeleteCommand {
    const [id] = args.positional;
    if (id === undefined) {
      throw new InvalidArgumentError('delete expects <id>');
    }
    return new DeleteCommand(id);
  }

  public execute(ctx: AppContext): void {
    const doc = ctx.requireDocument();
    if (this.shape === null) {
      this.shape = doc.requireShape(this.id);
      this.location = doc.locationOf(this.shape);
      this.parentLabel = doc.isTopLevel(this.shape)
        ? null
        : `${this.shape.parent!.typeName}#${this.shape.parent!.id}`;
    }
    doc.detach(this.shape);
  }

  public undo(ctx: AppContext): void {
    if (this.shape === null || this.location === null) return;
    ctx.requireDocument().attach(this.shape, this.location);
  }

  public successMessage(): string {
    return `${this.label()} deleted`;
  }

  public undoMessage(): string {
    const base = `${this.label()} restored`;
    return this.parentLabel === null ? base : `${base} into ${this.parentLabel}`;
  }

  private label(): string {
    return `${this.shape!.typeName}#${this.shape!.id}`;
  }
}
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `npx vitest run test/commands/CreateCommand.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 11: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/commands src/io test/commands test/helpers
git commit -m "feat(commands): add Command interface, registry, create and delete"
```

---

## Task 9: Move, Scale and Set

**Files:**
- Modify: `src/model/Shape.ts` (add `canSet`, `unsetAttr`, `positionAnchor`)
- Modify: `src/model/Rect.ts`, `Circle.ts`, `Ellipse.ts`, `Line.ts`, `Text.ts` (add `positionAnchor`)
- Create: `src/commands/MoveCommand.ts`
- Create: `src/commands/ScaleCommand.ts`
- Create: `src/commands/SetCommand.ts`
- Test: `test/commands/MoveCommand.test.ts`
- Test: `test/commands/SetCommand.test.ts`

- [ ] **Step 1: Write the failing move test**

Create `test/commands/MoveCommand.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CommandParser } from '../../src/parser/CommandParser';
import { MoveCommand } from '../../src/commands/MoveCommand';
import { ScaleCommand } from '../../src/commands/ScaleCommand';
import { CreateCommand } from '../../src/commands/CreateCommand';
import { InvalidScaleFactorError, NoSuchShapeError } from '../../src/model/errors';
import { makeContext } from '../helpers/makeContext';

const parser = new CommandParser();

function create(line: string, ctx: ReturnType<typeof makeContext>): void {
  CreateCommand.fromArgs(parser.parse(line)!, ctx).execute(ctx);
}

describe('MoveCommand', () => {
  it('reports a new absolute position for a leaf', () => {
    const ctx = makeContext();
    create('create circle c1 100 100 20 red', ctx);
    const cmd = MoveCommand.fromArgs(parser.parse('move c1 30 0')!, ctx);
    cmd.execute(ctx);

    expect(cmd.successMessage()).toBe('circle#c1 moved to (130,100)');
    cmd.undo(ctx);
    expect(cmd.undoMessage()).toBe('circle#c1 moved back to (100,100)');
  });

  it('reports a delta for a container', () => {
    const ctx = makeContext();
    create('create g node2', ctx);
    const cmd = MoveCommand.fromArgs(parser.parse('move node2 0 100')!, ctx);
    cmd.execute(ctx);

    expect(cmd.successMessage()).toBe('g#node2 moved by (0,100)');
    cmd.undo(ctx);
    expect(cmd.undoMessage()).toBe('g#node2 moved back by (0,-100)');
  });

  it('moves every descendant of a container', () => {
    const ctx = makeContext();
    create('create g g1', ctx);
    create('create rect r 0 0 10 10 in g1', ctx);
    MoveCommand.fromArgs(parser.parse('move g1 5 5')!, ctx).execute(ctx);
    expect(ctx.requireDocument().find('r')!.summary()).toBe('x=5 y=5 w=10 h=10');
  });

  it('rejects an unknown id', () => {
    const ctx = makeContext();
    expect(() => MoveCommand.fromArgs(parser.parse('move ghost 1 1')!, ctx).execute(ctx)).toThrow(
      NoSuchShapeError,
    );
  });
});

describe('ScaleCommand', () => {
  it('multiplies every geometry value', () => {
    const ctx = makeContext();
    create('create rect r 10 20 100 50', ctx);
    const cmd = ScaleCommand.fromArgs(parser.parse('scale r 2')!, ctx);
    cmd.execute(ctx);
    expect(ctx.requireDocument().find('r')!.summary()).toBe('x=20 y=40 w=200 h=100');
    cmd.undo(ctx);
    expect(ctx.requireDocument().find('r')!.summary()).toBe('x=10 y=20 w=100 h=50');
  });

  it('rejects a non-positive factor', () => {
    const ctx = makeContext();
    create('create rect r 0 0 1 1', ctx);
    expect(() => ScaleCommand.fromArgs(parser.parse('scale r 0')!, ctx)).toThrow(
      InvalidScaleFactorError,
    );
    expect(() => ScaleCommand.fromArgs(parser.parse('scale r -2')!, ctx)).toThrow(
      InvalidScaleFactorError,
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/commands/MoveCommand.test.ts`
Expected: FAIL — cannot resolve `../../src/commands/MoveCommand`.

- [ ] **Step 3: Add `positionAnchor`, `canSet`, `unsetAttr` to `Shape`**

In `src/model/Shape.ts`, add after `asContainer()`:

```ts
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
```

Add this near the top of the class body:

```ts
  private static readonly PRESENTATION_ATTRS = new Set(['fill', 'stroke', 'stroke-width']);
```

- [ ] **Step 4: Add `positionAnchor` to the five leaves**

In each file, add the method inside the class:

`src/model/Rect.ts` and `src/model/Text.ts`:

```ts
  public override positionAnchor(): readonly [number, number] {
    return [this.x, this.y];
  }
```

`src/model/Circle.ts` and `src/model/Ellipse.ts`:

```ts
  public override positionAnchor(): readonly [number, number] {
    return [this.cx, this.cy];
  }
```

`src/model/Line.ts`:

```ts
  public override positionAnchor(): readonly [number, number] {
    return [this.x1, this.y1];
  }
```

- [ ] **Step 5: Write `MoveCommand`**

Create `src/commands/MoveCommand.ts`:

```ts
import { InvalidArgumentError } from '../model/errors';
import { parseNumber } from '../model/format';
import type { ParsedCommand } from '../parser/CommandParser';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

export class MoveCommand implements Command {
  public readonly isUndoable = true;

  private label = '';
  private container = false;
  private beforeAnchor: string | null = null;
  private afterAnchor: string | null = null;

  public constructor(
    private readonly id: string,
    private readonly dx: number,
    private readonly dy: number,
  ) {}

  public static fromArgs(args: ParsedCommand, _ctx: AppContext): MoveCommand {
    const [id, dx, dy] = args.positional;
    if (id === undefined || dx === undefined || dy === undefined) {
      throw new InvalidArgumentError('move expects <id> <dx> <dy>');
    }
    return new MoveCommand(id, parseNumber(dx), parseNumber(dy));
  }

  public execute(ctx: AppContext): void {
    const shape = ctx.requireDocument().requireShape(this.id);
    this.label = `${shape.typeName}#${shape.id}`;
    this.container = shape.isContainer();
    this.beforeAnchor = MoveCommand.anchor(shape);
    shape.translate(this.dx, this.dy);
    this.afterAnchor = MoveCommand.anchor(shape);
  }

  public undo(ctx: AppContext): void {
    ctx.requireDocument().requireShape(this.id).translate(-this.dx, -this.dy);
  }

  public successMessage(): string {
    return this.container
      ? `${this.label} moved by (${this.dx},${this.dy})`
      : `${this.label} moved to ${this.afterAnchor}`;
  }

  public undoMessage(): string {
    return this.container
      ? `${this.label} moved back by (${-this.dx},${-this.dy})`
      : `${this.label} moved back to ${this.beforeAnchor}`;
  }

  private static anchor(shape: { positionAnchor(): readonly [number, number] | null }): string | null {
    const point = shape.positionAnchor();
    if (point === null) return null;
    return `(${point[0]},${point[1]})`;
  }
}
```

- [ ] **Step 6: Write `ScaleCommand`**

Create `src/commands/ScaleCommand.ts`:

```ts
import { InvalidArgumentError, InvalidScaleFactorError } from '../model/errors';
import { parseNumber } from '../model/format';
import type { ParsedCommand } from '../parser/CommandParser';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

export class ScaleCommand implements Command {
  public readonly isUndoable = true;

  private label = '';

  public constructor(
    private readonly id: string,
    private readonly factor: number,
  ) {}

  public static fromArgs(args: ParsedCommand, _ctx: AppContext): ScaleCommand {
    const [id, factor] = args.positional;
    if (id === undefined || factor === undefined) {
      throw new InvalidArgumentError('scale expects <id> <factor>');
    }
    const value = parseNumber(factor);
    if (value <= 0) {
      throw new InvalidScaleFactorError();
    }
    return new ScaleCommand(id, value);
  }

  public execute(ctx: AppContext): void {
    const shape = ctx.requireDocument().requireShape(this.id);
    this.label = `${shape.typeName}#${shape.id}`;
    shape.scaleBy(this.factor);
  }

  public undo(ctx: AppContext): void {
    ctx.requireDocument().requireShape(this.id).scaleBy(1 / this.factor);
  }

  public successMessage(): string {
    return `${this.label} scaled by ${this.factor}`;
  }

  public undoMessage(): string {
    return `${this.label} unscaled`;
  }
}
```

- [ ] **Step 7: Write the failing set test**

Create `test/commands/SetCommand.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CommandParser } from '../../src/parser/CommandParser';
import { SetCommand } from '../../src/commands/SetCommand';
import { CreateCommand } from '../../src/commands/CreateCommand';
import { UnknownAttributeError } from '../../src/model/errors';
import { makeContext } from '../helpers/makeContext';

const parser = new CommandParser();

function create(line: string, ctx: ReturnType<typeof makeContext>): void {
  CreateCommand.fromArgs(parser.parse(line)!, ctx).execute(ctx);
}

describe('SetCommand', () => {
  it('updates geometry and reports the new value', () => {
    const ctx = makeContext();
    create('create rect r 0 0 10 10', ctx);
    const cmd = SetCommand.fromArgs(parser.parse('set r width 250')!, ctx);
    cmd.execute(ctx);
    expect(cmd.successMessage()).toBe('rect#r updated: width="250"');
    expect(ctx.requireDocument().find('r')!.summary()).toBe('x=0 y=0 w=250 h=10');
  });

  it('updates text content', () => {
    const ctx = makeContext();
    create('create text title 20 40 "My Diagram"', ctx);
    const cmd = SetCommand.fromArgs(parser.parse('set title text "My Diagram v2"')!, ctx);
    cmd.execute(ctx);
    expect(cmd.successMessage()).toBe('text#title updated: text="My Diagram v2"');

    cmd.undo(ctx);
    expect(cmd.undoMessage()).toBe('text#title updated: text="My Diagram"');
  });

  it('undoes a fill that was not set before by removing it', () => {
    const ctx = makeContext();
    create('create rect r 0 0 1 1', ctx);
    const cmd = SetCommand.fromArgs(parser.parse('set r fill red')!, ctx);
    cmd.execute(ctx);
    expect(ctx.requireDocument().find('r')!.toXml().attrs['fill']).toBe('red');
    cmd.undo(ctx);
    expect(ctx.requireDocument().find('r')!.toXml().attrs['fill']).toBeUndefined();
  });

  it('rejects an attribute outside the whitelist', () => {
    const ctx = makeContext();
    create('create rect r 0 0 1 1', ctx);
    expect(() => SetCommand.fromArgs(parser.parse('set r cx 5')!, ctx).execute(ctx)).toThrow(
      UnknownAttributeError,
    );
  });
});
```

- [ ] **Step 8: Write `SetCommand`**

Create `src/commands/SetCommand.ts`:

```ts
import { InvalidArgumentError, UnknownAttributeError } from '../model/errors';
import type { Shape } from '../model/Shape';
import type { ParsedCommand } from '../parser/CommandParser';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

export class SetCommand implements Command {
  public readonly isUndoable = true;

  private resolved = false;
  private oldValue: string | undefined;
  private label = '';

  public constructor(
    private readonly id: string,
    private readonly attr: string,
    private readonly value: string,
  ) {}

  public static fromArgs(args: ParsedCommand, _ctx: AppContext): SetCommand {
    const [id, attr, value] = args.positional;
    if (id === undefined || attr === undefined || value === undefined) {
      throw new InvalidArgumentError('set expects <id> <attr> <value>');
    }
    return new SetCommand(id, attr, value);
  }

  public execute(ctx: AppContext): void {
    const shape = ctx.requireDocument().requireShape(this.id);
    if (!shape.canSet(this.attr)) {
      throw new UnknownAttributeError(this.attr);
    }
    if (!this.resolved) {
      this.oldValue = shape.getAttr(this.attr);
      this.label = `${shape.typeName}#${shape.id}`;
      this.resolved = true;
    }
    shape.setAttr(this.attr, this.value);
  }

  public undo(ctx: AppContext): void {
    const shape = ctx.requireDocument().requireShape(this.id);
    SetCommand.restore(shape, this.attr, this.oldValue);
  }

  public successMessage(): string {
    return `${this.label} updated: ${this.attr}="${this.value}"`;
  }

  public undoMessage(): string {
    return this.oldValue === undefined
      ? `${this.label} updated: ${this.attr} removed`
      : `${this.label} updated: ${this.attr}="${this.oldValue}"`;
  }

  private static restore(shape: Shape, attr: string, oldValue: string | undefined): void {
    if (oldValue === undefined) {
      shape.unsetAttr(attr);
    } else {
      shape.setAttr(attr, oldValue);
    }
  }
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run test/commands`
Expected: PASS — 18 tests.

- [ ] **Step 10: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/model src/commands test/commands
git commit -m "feat(commands): add move, scale and set with exact undo"
```

---

## Task 10: Grouping and z-order commands

**Files:**
- Create: `src/commands/GroupCommand.ts`
- Create: `src/commands/UngroupCommand.ts`
- Create: `src/commands/AddToCommand.ts`
- Create: `src/commands/ZOrderCommand.ts`
- Test: `test/commands/GroupCommand.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/commands/GroupCommand.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CommandParser } from '../../src/parser/CommandParser';
import { CreateCommand } from '../../src/commands/CreateCommand';
import { GroupCommand } from '../../src/commands/GroupCommand';
import { UngroupCommand } from '../../src/commands/UngroupCommand';
import { AddToCommand } from '../../src/commands/AddToCommand';
import { ZOrderCommand } from '../../src/commands/ZOrderCommand';
import {
  CannotGroupIntoDescendantError,
  CannotUngroupTopLevelError,
  NoSuchShapeError,
} from '../../src/model/errors';
import { makeContext } from '../helpers/makeContext';

const parser = new CommandParser();

function run(line: string, ctx: ReturnType<typeof makeContext>) {
  const parsed = parser.parse(line)!;
  const builders = {
    create: CreateCommand,
    group: GroupCommand,
    ungroup: UngroupCommand,
    addto: AddToCommand,
    front: ZOrderCommand,
    back: ZOrderCommand,
  } as const;
  const builder = builders[parsed.name as keyof typeof builders];
  const cmd = builder.fromArgs(parsed, ctx);
  cmd.execute(ctx);
  return cmd;
}

describe('GroupCommand', () => {
  it('creates a group holding the members in order, at the first member position', () => {
    const ctx = makeContext();
    const doc = ctx.requireDocument();
    run('create rect a 0 0 1 1', ctx);
    run('create circle c 5 5 1', ctx);
    run('create rect b 0 0 1 1', ctx);

    const cmd = run('group mid c b', ctx) as GroupCommand;
    expect(cmd.successMessage()).toBe('g#mid created with 2 children');
    expect(doc.children.map((s) => s.id)).toEqual(['a', 'mid']);
    expect(doc.requireContainer('mid').children.map((s) => s.id)).toEqual(['c', 'b']);
  });

  it('undo restores every member to its original parent and index', () => {
    const ctx = makeContext();
    const doc = ctx.requireDocument();
    run('create rect a 0 0 1 1', ctx);
    run('create circle c 5 5 1', ctx);
    run('create rect b 0 0 1 1', ctx);
    const cmd = run('group mid c b', ctx) as GroupCommand;

    cmd.undo(ctx);
    expect(doc.children.map((s) => s.id)).toEqual(['a', 'c', 'b']);
    expect(doc.find('mid')).toBeNull();
  });

  it('refuses to fold a container together with its own descendant', () => {
    const ctx = makeContext();
    run('create g markers', ctx);
    run('create circle c1 0 0 1', ctx);
    run('addto markers c1', ctx);

    expect(() => run('group bad c1 markers', ctx)).toThrow(CannotGroupIntoDescendantError);
  });
});

describe('UngroupCommand', () => {
  it('hoists children into the parent at the group position', () => {
    const ctx = makeContext();
    const doc = ctx.requireDocument();
    run('create g outer', ctx);
    run('create rect a 0 0 1 1 in outer', ctx);
    run('create circle c 5 5 1 in outer', ctx);
    run('create rect b 0 0 1 1 in outer', ctx);
    run('group mid c b', ctx);

    run('ungroup mid', ctx);
    expect(doc.requireContainer('outer').children.map((s) => s.id)).toEqual(['a', 'c', 'b']);
    expect(doc.find('mid')).toBeNull();
  });

  it('refuses a top-level container', () => {
    const ctx = makeContext();
    run('create g scene', ctx);
    expect(() => run('ungroup scene', ctx)).toThrow(CannotUngroupTopLevelError);
  });

  it('refuses an id that is not a container', () => {
    const ctx = makeContext();
    run('create rect r 0 0 1 1', ctx);
    expect(() => run('ungroup r', ctx)).toThrow(/not a container: r/);
  });
});

describe('AddToCommand', () => {
  it('moves a shape into a container and undo puts it back', () => {
    const ctx = makeContext();
    const doc = ctx.requireDocument();
    run('create g box', ctx);
    run('create rect r 0 0 1 1', ctx);

    const cmd = run('addto box r', ctx) as AddToCommand;
    expect(doc.requireContainer('box').children.map((s) => s.id)).toEqual(['r']);
    cmd.undo(ctx);
    expect(doc.children.map((s) => s.id)).toEqual(['box', 'r']);
  });

  it('rejects a missing shape', () => {
    const ctx = makeContext();
    run('create g box', ctx);
    expect(() => run('addto box ghost', ctx)).toThrow(NoSuchShapeError);
  });
});

describe('ZOrderCommand', () => {
  it('brings a shape to the front and sends it to the back', () => {
    const ctx = makeContext();
    const doc = ctx.requireDocument();
    run('create rect a 0 0 1 1', ctx);
    run('create rect b 0 0 1 1', ctx);
    run('create rect c 0 0 1 1', ctx);

    const front = run('front a', ctx) as ZOrderCommand;
    expect(doc.children.map((s) => s.id)).toEqual(['b', 'c', 'a']);
    front.undo(ctx);
    expect(doc.children.map((s) => s.id)).toEqual(['a', 'b', 'c']);

    run('back c', ctx);
    expect(doc.children.map((s) => s.id)).toEqual(['c', 'a', 'b']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/commands/GroupCommand.test.ts`
Expected: FAIL — cannot resolve `../../src/commands/GroupCommand`.

- [ ] **Step 3: Write `GroupCommand`**

Create `src/commands/GroupCommand.ts`:

```ts
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
      this.group.insert(member);
    }
  }

  public undo(ctx: AppContext): void {
    const doc = ctx.requireDocument();
    if (this.group === null) return;
    doc.detach(this.group);
    this.members.forEach((member, index) => {
      doc.attach(member, this.memberLocations[index]!);
    });
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
```

- [ ] **Step 4: Write `UngroupCommand`**

Create `src/commands/UngroupCommand.ts`:

```ts
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
```

- [ ] **Step 5: Write `AddToCommand`**

Create `src/commands/AddToCommand.ts`:

```ts
import type { NodeLocation } from '../model/SvgDocument';
import type { Shape } from '../model/Shape';
import {
  CannotGroupIntoDescendantError,
  InvalidArgumentError,
} from '../model/errors';
import type { ParsedCommand } from '../parser/CommandParser';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

export class AddToCommand implements Command {
  public readonly isUndoable = true;

  private shape: Shape | null = null;
  private location: NodeLocation | null = null;

  public constructor(
    private readonly containerId: string,
    private readonly shapeId: string,
  ) {}

  public static fromArgs(args: ParsedCommand, _ctx: AppContext): AddToCommand {
    const [containerId, shapeId] = args.positional;
    if (containerId === undefined || shapeId === undefined) {
      throw new InvalidArgumentError('addto expects <gid> <id>');
    }
    return new AddToCommand(containerId, shapeId);
  }

  public execute(ctx: AppContext): void {
    const doc = ctx.requireDocument();
    if (this.shape === null) {
      const container = doc.requireContainer(this.containerId);
      this.shape = doc.requireShape(this.shapeId);
      if (AddToCommand.isAncestor(this.shape, container)) {
        throw new CannotGroupIntoDescendantError(this.shape.id);
      }
      this.location = doc.locationOf(this.shape);
    }
    const container = doc.requireContainer(this.containerId);
    doc.detach(this.shape);
    container.insert(this.shape);
    doc.rebuildIndex();
  }

  public undo(ctx: AppContext): void {
    const doc = ctx.requireDocument();
    if (this.shape === null || this.location === null) return;
    doc.detach(this.shape);
    doc.attach(this.shape, this.location);
  }

  public successMessage(): string {
    return `${this.shape!.typeName}#${this.shape!.id} moved into g#${this.containerId}`;
  }

  public undoMessage(): string {
    return `${this.shape!.typeName}#${this.shape!.id} moved out of g#${this.containerId}`;
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
```

- [ ] **Step 6: Write `ZOrderCommand`**

Create `src/commands/ZOrderCommand.ts`:

```ts
import type { NodeLocation } from '../model/SvgDocument';
import type { Shape } from '../model/Shape';
import { InvalidArgumentError } from '../model/errors';
import type { ParsedCommand } from '../parser/CommandParser';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

type Placement = 'front' | 'back';

/** Shared implementation of `front <id>` and `back <id>`. */
export class ZOrderCommand implements Command {
  public readonly isUndoable = true;

  private shape: Shape | null = null;
  private location: NodeLocation | null = null;

  public constructor(
    private readonly id: string,
    private readonly placement: Placement,
  ) {}

  public static fromArgs(args: ParsedCommand, _ctx: AppContext): ZOrderCommand {
    const [name, id] = [args.name, args.positional[0]];
    if (id === undefined) {
      throw new InvalidArgumentError(`${name} expects <id>`);
    }
    return new ZOrderCommand(id, name === 'front' ? 'front' : 'back');
  }

  public execute(ctx: AppContext): void {
    const doc = ctx.requireDocument();
    if (this.shape === null) {
      this.shape = doc.requireShape(this.id);
      this.location = doc.locationOf(this.shape);
    }
    const parent = doc.locationOf(this.shape).parent;
    doc.detach(this.shape);
    const index = this.placement === 'front' ? parent.children.length : 0;
    parent.insert(this.shape, index);
    doc.rebuildIndex();
  }

  public undo(ctx: AppContext): void {
    const doc = ctx.requireDocument();
    if (this.shape === null || this.location === null) return;
    doc.detach(this.shape);
    doc.attach(this.shape, this.location);
  }

  public successMessage(): string {
    return `${this.shape!.typeName}#${this.shape!.id} moved to ${this.placement}`;
  }

  public undoMessage(): string {
    return `${this.shape!.typeName}#${this.shape!.id} z-order restored`;
  }
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run test/commands`
Expected: PASS — 30 tests.

- [ ] **Step 8: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/commands test/commands
git commit -m "feat(commands): add group, ungroup, addto and z-order"
```

## Task 11: Undo/redo history

**Files:**
- Modify: `src/commands/Command.ts` (add `isDisplay?`)
- Create: `src/history/HistoryManager.ts`
- Test: `test/history/HistoryManager.test.ts`

- [ ] **Step 1: Add the `isDisplay` seam to `Command`**

In `src/commands/Command.ts`, add an optional member to the interface (keep everything else):

```ts
  /**
   * true for read-only display commands (tree / show / help, bare canvas).
   * They execute but never enter, clear, or lock the undo stacks (spec §4.3).
   */
  readonly isDisplay?: boolean;
```

- [ ] **Step 2: Write the failing test**

Create `test/history/HistoryManager.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { HistoryManager } from '../../src/history/HistoryManager';
import { CommandParser } from '../../src/parser/CommandParser';
import { CreateCommand } from '../../src/commands/CreateCommand';
import {
  NothingToRedoError,
  NothingToUndoError,
  UndoNotAllowedError,
} from '../../src/model/errors';
import { makeContext } from '../helpers/makeContext';
import type { AppContext } from '../../src/commands/AppContext';
import type { Command } from '../../src/commands/Command';

const parser = new CommandParser();

function makeCreate(line: string, ctx: AppContext): CreateCommand {
  return CreateCommand.fromArgs(parser.parse(line)!, ctx);
}

/** Stand-in for init / read / save: not undoable, but it does change the document. */
class DocumentCommand implements Command {
  public readonly isUndoable = false;
  public execute(_ctx: AppContext): void {}
  public undo(_ctx: AppContext): void {}
  public successMessage(): string {
    return 'document op';
  }
  public undoMessage(): string {
    return 'document op undone';
  }
}

describe('HistoryManager', () => {
  it('executes an edit and can undo then redo it', () => {
    const ctx = makeContext();
    const doc = ctx.requireDocument();
    const history = new HistoryManager();

    history.execute(makeCreate('create rect a 0 0 1 1', ctx), ctx);
    expect(doc.children.map((s) => s.id)).toEqual(['a']);

    const undone = history.undo(ctx);
    expect(undone.undoMessage()).toBe('rect#a creation undone');
    expect(doc.children).toHaveLength(0);

    const redone = history.redo(ctx);
    expect(redone.successMessage()).toBe('rect#a created');
    expect(doc.children.map((s) => s.id)).toEqual(['a']);
  });

  it('clears the redo stack when a new edit follows an undo', () => {
    const ctx = makeContext();
    const history = new HistoryManager();
    history.execute(makeCreate('create rect a 0 0 1 1', ctx), ctx);
    history.undo(ctx);
    expect(history.canRedo()).toBe(true);

    history.execute(makeCreate('create rect b 0 0 1 1', ctx), ctx);
    expect(history.canRedo()).toBe(false);
    expect(() => history.redo(ctx)).toThrow(NothingToRedoError);
  });

  it('reports nothing to undo on an empty stack', () => {
    const ctx = makeContext();
    expect(() => new HistoryManager().undo(ctx)).toThrow(NothingToUndoError);
  });

  it('locks undo after a document command until the next edit', () => {
    const ctx = makeContext();
    const history = new HistoryManager();
    history.execute(makeCreate('create rect a 0 0 1 1', ctx), ctx);
    history.execute(new DocumentCommand(), ctx);

    expect(history.canUndo()).toBe(false);
    expect(() => history.undo(ctx)).toThrow(UndoNotAllowedError);

    history.execute(makeCreate('create rect b 0 0 1 1', ctx), ctx);
    expect(history.canUndo()).toBe(true);
  });

  it('does not touch the stacks for display commands', () => {
    const ctx = makeContext();
    const history = new HistoryManager();
    history.execute(makeCreate('create rect a 0 0 1 1', ctx), ctx);

    const display: Command = {
      isUndoable: false,
      isDisplay: true,
      execute: () => {},
      undo: () => {},
      successMessage: () => '',
      undoMessage: () => '',
    };
    history.execute(display, ctx);
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run test/history/HistoryManager.test.ts`
Expected: FAIL — cannot resolve `../../src/history/HistoryManager`.

- [ ] **Step 4: Write `HistoryManager`**

Create `src/history/HistoryManager.ts`:

```ts
import type { AppContext } from '../commands/AppContext';
import type { Command } from '../commands/Command';
import { NothingToRedoError, NothingToUndoError, UndoNotAllowedError } from '../model/errors';

/**
 * Owns the undo/redo stacks. Commands never see this object — it drives them
 * (design §1.4: `commands` has no dependency on `history`).
 *
 * Document-class commands (`isUndoable === false`, `isDisplay !== true`) clear both
 * stacks and lock undo until the next edit re-enables it (spec §4.3).
 */
export class HistoryManager {
  private readonly undoStack: Command[] = [];
  private readonly redoStack: Command[] = [];
  private locked = false;

  public execute(command: Command, ctx: AppContext): void {
    command.execute(ctx);

    if (command.isDisplay === true) {
      return;
    }
    if (command.isUndoable) {
      this.undoStack.push(command);
      this.redoStack.length = 0;
      this.locked = false;
      return;
    }
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.locked = true;
  }

  public undo(ctx: AppContext): Command {
    if (this.locked) {
      throw new UndoNotAllowedError();
    }
    const command = this.undoStack.pop();
    if (command === undefined) {
      throw new NothingToUndoError();
    }
    command.undo(ctx);
    this.redoStack.push(command);
    return command;
  }

  public redo(ctx: AppContext): Command {
    if (this.locked) {
      throw new UndoNotAllowedError();
    }
    const command = this.redoStack.pop();
    if (command === undefined) {
      throw new NothingToRedoError();
    }
    command.execute(ctx);
    this.undoStack.push(command);
    return command;
  }

  public canUndo(): boolean {
    return !this.locked && this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return !this.locked && this.redoStack.length > 0;
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run test/history`
Expected: PASS — 5 tests.

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/commands/Command.ts src/history test/history
git commit -m "feat(history): add undo/redo stack manager"
```

---

## Task 12: File store and hand-written SVG writer

**Files:**
- Create: `src/io/FileStore.ts` (finalize)
- Create: `src/io/MemoryFileStore.ts` (finalize)
- Create: `src/io/NodeFileStore.ts`
- Create: `src/io/SvgWriter.ts`
- Test: `test/io/SvgWriter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/io/SvgWriter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SvgWriter } from '../../src/io/SvgWriter';
import { SvgDocument } from '../../src/model/SvgDocument';
import { Group } from '../../src/model/Group';
import { Line } from '../../src/model/Line';
import { Rect } from '../../src/model/Rect';
import { Text } from '../../src/model/Text';

const writer = new SvgWriter();

describe('SvgWriter', () => {
  it('writes the XML declaration, 2-space indent and self-closing leaves', () => {
    const doc = new SvgDocument(400, 200);
    const flow = new Group('flow');
    doc.attach(flow, { parent: doc, index: 0 });

    const start = new Rect('start', 30, 70, 120, 60);
    start.setAttr('fill', '#4a90d9');
    flow.insert(start);

    const edge = new Line('edge', 150, 100, 250, 100);
    edge.setAttr('stroke', 'black');
    flow.insert(edge);

    const end = new Rect('end', 250, 70, 120, 60);
    end.setAttr('fill', '#f5a623');
    flow.insert(end);

    expect(writer.serialize(doc.toXml())).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">',
        '  <g id="flow">',
        '    <rect id="start" x="30" y="70" width="120" height="60" fill="#4a90d9"/>',
        '    <line id="edge" x1="150" y1="100" x2="250" y2="100" stroke="black"/>',
        '    <rect id="end" x="250" y="70" width="120" height="60" fill="#f5a623"/>',
        '  </g>',
        '</svg>',
        '',
      ].join('\n'),
    );
  });

  it('opens and closes a text element around its content', () => {
    const doc = new SvgDocument(100, 100);
    const text = new Text('t', 5, 5, 'hi');
    doc.attach(text, { parent: doc, index: 0 });
    expect(writer.serialize(doc.toXml())).toContain('  <text id="t" x="5" y="5">hi</text>');
  });

  it('escapes markup in attributes and text', () => {
    const doc = new SvgDocument(10, 10);
    const rect = new Rect('r', 0, 0, 1, 1);
    rect.setAttr('fill', 'a&b');
    doc.attach(rect, { parent: doc, index: 0 });
    const text = new Text('t', 0, 0, 'a<b & "c"');
    doc.attach(text, { parent: doc, index: 1 });

    const output = writer.serialize(doc.toXml());
    expect(output).toContain('fill="a&amp;b"');
    expect(output).toContain('<text id="t" x="0" y="0">a&lt;b &amp; "c"</text>');
  });

  it('renders an empty container as an open/close pair', () => {
    const doc = new SvgDocument(100, 100);
    doc.attach(new Group('scene'), { parent: doc, index: 0 });
    expect(writer.serialize(doc.toXml())).toContain('  <g id="scene">\n  </g>');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/io/SvgWriter.test.ts`
Expected: FAIL — cannot resolve `../../src/io/SvgWriter`.

- [ ] **Step 3: Finalize `FileStore` and `MemoryFileStore`**

Replace the throwaway versions from Task 8.

Create `src/io/FileStore.ts`:

```ts
/** Port the editor depends on instead of the filesystem (design §1.3, Adapter/Ports). */
export interface FileStore {
  read(path: string): string;
  write(path: string, content: string): void;
  exists(path: string): boolean;
}
```

Create `src/io/MemoryFileStore.ts`:

```ts
import type { FileStore } from './FileStore';

export class MemoryFileStore implements FileStore {
  private readonly files = new Map<string, string>();

  public read(path: string): string {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`missing file: ${path}`);
    }
    return content;
  }

  public write(path: string, content: string): void {
    this.files.set(path, content);
  }

  public exists(path: string): boolean {
    return this.files.has(path);
  }
}
```

- [ ] **Step 4: Write `NodeFileStore`**

Create `src/io/NodeFileStore.ts`:

```ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { FileError } from '../model/errors';
import type { FileStore } from './FileStore';

export class NodeFileStore implements FileStore {
  public read(path: string): string {
    if (!existsSync(path)) {
      throw FileError.read(path);
    }
    try {
      return readFileSync(path, 'utf8');
    } catch {
      throw FileError.read(path);
    }
  }

  public write(path: string, content: string): void {
    try {
      writeFileSync(path, content, 'utf8');
    } catch {
      throw FileError.write(path);
    }
  }

  public exists(path: string): boolean {
    return existsSync(path);
  }
}
```

- [ ] **Step 5: Write `SvgWriter`**

Create `src/io/SvgWriter.ts`:

```ts
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
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run test/io/SvgWriter.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 7: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/io test/io
git commit -m "feat(io): add file-store ports and hand-written SVG writer"
```

---

## Task 13: SVG reader with auto-id assignment

**Files:**
- Create: `src/io/SvgReader.ts`
- Test: `test/io/SvgReader.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/io/SvgReader.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SvgReader } from '../../src/io/SvgReader';
import { SvgWriter } from '../../src/io/SvgWriter';
import { createDefaultShapeFactory } from '../../src/shapes/ShapeFactory';
import { FileError } from '../../src/model/errors';

const OTHER_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect x="0" y="0" width="400" height="300" fill="#ffffff"/>
  <text id="t1" x="10" y="290">imported</text>
  <circle id="c1" cx="50" cy="50" r="10"/>
  <g id="g1">
    <rect id="r2" x="0" y="0" width="10" height="10"/>
    <circle id="c2" cx="5" cy="5" r="2"/>
  </g>
  <ellipse id="e1" cx="1" cy="2" rx="3" ry="4"/>
</svg>`;

const reader = new SvgReader(createDefaultShapeFactory());

describe('SvgReader', () => {
  it('reads the canvas size, the tree and the preserved order', () => {
    const result = reader.read(OTHER_SVG, 'other.svg');
    expect(result.document.width).toBe(400);
    expect(result.document.height).toBe(300);
    expect(result.document.children.map((s) => s.id)).toEqual(['rect1', 't1', 'c1', 'g1', 'e1']);
    expect(result.document.requireContainer('g1').children.map((s) => s.id)).toEqual(['r2', 'c2']);
    expect(result.document.count()).toBe(7);
  });

  it('assigns an id to an unnamed element and warns', () => {
    const result = reader.read(OTHER_SVG, 'other.svg');
    expect(result.warnings).toEqual(['assigned id rect1 to unnamed <rect>']);
    expect(result.document.find('rect1')!.toXml().attrs['fill']).toBe('#ffffff');
  });

  it('keeps the text content of a <text> element', () => {
    const result = reader.read(OTHER_SVG, 'other.svg');
    expect(result.document.find('t1')!.getAttr('text')).toBe('imported');
  });

  it('round-trips: read -> write -> read is stable', () => {
    const first = reader.read(OTHER_SVG, 'other.svg').document;
    const text = new SvgWriter().serialize(first.toXml());
    const second = reader.read(text, 'roundtrip.svg').document;
    expect(new SvgWriter().serialize(second.toXml())).toBe(text);
  });

  it('rejects input with no <svg> root', () => {
    expect(() => reader.read('<not-svg/>', 'bad.svg')).toThrow(FileError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/io/SvgReader.test.ts`
Expected: FAIL — cannot resolve `../../src/io/SvgReader`.

- [ ] **Step 3: Write `SvgReader`**

Create `src/io/SvgReader.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/io/SvgReader.test.ts`
Expected: PASS — 5 tests.

> If `fast-xml-parser`'s `preserveOrder` output differs from the shape assumed above, print `JSON.stringify(parser.parse(OTHER_SVG), null, 2)` in a scratch test and adjust `parseChildren` / `attributesOf` accordingly. The public `read()` contract does not change.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/io test/io
git commit -m "feat(io): add SVG reader with auto-id assignment"
```

---

## Task 14: Document commands, undo/redo commands, element count

**Files:**
- Modify: `src/model/SvgDocument.ts` (add `count()`)
- Create: `src/commands/HistoryCommand.ts`
- Create: `src/commands/UndoCommand.ts`
- Create: `src/commands/RedoCommand.ts`
- Create: `src/commands/InitCommand.ts`
- Create: `src/commands/ReadCommand.ts`
- Create: `src/commands/SaveCommand.ts`
- Create: `src/commands/CanvasCommand.ts`
- Test: `test/commands/documentCommands.test.ts`

- [ ] **Step 1: Add `count()` to `SvgDocument`**

In `src/model/SvgDocument.ts`, add after `resize`:

```ts
  /** Number of shapes in the tree, excluding the root (the spec's "(N elements)"). */
  public count(): number {
    return this.index.size - 1;
  }
```

- [ ] **Step 2: Add `warnings?` to `Command`**

In `src/commands/Command.ts`, add:

```ts
  /** Extra lines to print before the success message (e.g. `read` auto-id warnings). */
  warnings?(): readonly string[];
```

- [ ] **Step 3: Write the failing test**

Create `test/commands/documentCommands.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CommandParser } from '../../src/parser/CommandParser';
import { CanvasCommand } from '../../src/commands/CanvasCommand';
import { CreateCommand } from '../../src/commands/CreateCommand';
import { InitCommand } from '../../src/commands/InitCommand';
import { ReadCommand } from '../../src/commands/ReadCommand';
import { RedoCommand } from '../../src/commands/RedoCommand';
import { SaveCommand } from '../../src/commands/SaveCommand';
import { UndoCommand } from '../../src/commands/UndoCommand';
import { HistoryManager } from '../../src/history/HistoryManager';
import { InvalidArgumentError } from '../../src/model/errors';
import { emptyContext } from '../helpers/makeContext';

const parser = new CommandParser();

const OTHER_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect x="0" y="0" width="400" height="300" fill="#ffffff"/>
  <text id="t1" x="10" y="290">imported</text>
  <circle id="c1" cx="50" cy="50" r="10"/>
  <g id="g1">
    <rect id="r2" x="0" y="0" width="10" height="10"/>
    <circle id="c2" cx="5" cy="5" r="2"/>
  </g>
  <ellipse id="e1" cx="1" cy="2" rx="3" ry="4"/>
</svg>`;

describe('InitCommand', () => {
  it('creates the default canvas', () => {
    const ctx = emptyContext();
    const cmd = InitCommand.fromArgs(parser.parse('init')!, ctx);
    cmd.execute(ctx);
    expect(ctx.requireDocument().width).toBe(800);
    expect(ctx.requireDocument().height).toBe(600);
    expect(cmd.successMessage()).toBe('canvas 800x600 created');
  });

  it('honours explicit dimensions', () => {
    const ctx = emptyContext();
    InitCommand.fromArgs(parser.parse('init 640 480')!, ctx).execute(ctx);
    expect(ctx.requireDocument().width).toBe(640);
  });
});

describe('ReadCommand', () => {
  it('loads a file, warns about the assigned id and counts elements', () => {
    const ctx = emptyContext();
    ctx.fileStore.write('other.svg', OTHER_SVG);
    const cmd = ReadCommand.fromArgs(parser.parse('read other.svg')!, ctx);
    cmd.execute(ctx);

    expect(cmd.warnings()).toEqual(['assigned id rect1 to unnamed <rect>']);
    expect(cmd.successMessage()).toBe('read other.svg (7 elements)');
    expect(ctx.requireDocument().width).toBe(400);
    expect(ctx.getSavePath()).toBe('other.svg');
  });
});

describe('SaveCommand', () => {
  it('writes the document and reports the element count', () => {
    const ctx = emptyContext();
    InitCommand.fromArgs(parser.parse('init 800 600')!, ctx).execute(ctx);
    CreateCommand.fromArgs(parser.parse('create rect bg 0 0 800 600 #ffffff')!, ctx).execute(ctx);

    const cmd = SaveCommand.fromArgs(parser.parse('save demo.svg')!, ctx);
    cmd.execute(ctx);

    expect(cmd.successMessage()).toBe('saved to demo.svg (1 elements)');
    expect(ctx.fileStore.read('demo.svg')).toContain('<rect id="bg"');
  });

  it('defaults to the path used by the last read', () => {
    const ctx = emptyContext();
    ctx.fileStore.write('other.svg', OTHER_SVG);
    ReadCommand.fromArgs(parser.parse('read other.svg')!, ctx).execute(ctx);

    const cmd = SaveCommand.fromArgs(parser.parse('save')!, ctx);
    cmd.execute(ctx);
    expect(cmd.successMessage()).toBe('saved to other.svg (7 elements)');
  });

  it('refuses to save when no path is known', () => {
    const ctx = emptyContext();
    InitCommand.fromArgs(parser.parse('init')!, ctx).execute(ctx);
    expect(() => SaveCommand.fromArgs(parser.parse('save')!, ctx).execute(ctx)).toThrow(
      InvalidArgumentError,
    );
  });
});

describe('CanvasCommand', () => {
  it('shows the size without arguments and is a display command', () => {
    const ctx = emptyContext();
    InitCommand.fromArgs(parser.parse('init 800 600')!, ctx).execute(ctx);
    const cmd = CanvasCommand.fromArgs(parser.parse('canvas')!, ctx);
    cmd.execute(ctx);
    expect(cmd.isDisplay).toBe(true);
    expect(cmd.successMessage()).toBe('canvas 800x600');
  });

  it('resizes when given dimensions', () => {
    const ctx = emptyContext();
    InitCommand.fromArgs(parser.parse('init 800 600')!, ctx).execute(ctx);
    const cmd = CanvasCommand.fromArgs(parser.parse('canvas 320 240')!, ctx);
    cmd.execute(ctx);
    expect(cmd.isDisplay).toBe(false);
    expect(ctx.requireDocument().width).toBe(320);
  });
});

describe('Undo and redo commands', () => {
  it('surface the underlying command messages', () => {
    const ctx = emptyContext();
    InitCommand.fromArgs(parser.parse('init 800 600')!, ctx).execute(ctx);
    const history = new HistoryManager();
    history.execute(CreateCommand.fromArgs(parser.parse('create rect a 0 0 1 1')!, ctx), ctx);

    expect(new UndoCommand().executeOn(history, ctx)).toBe('rect#a creation undone');
    expect(new RedoCommand().executeOn(history, ctx)).toBe('rect#a created');
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run test/commands/documentCommands.test.ts`
Expected: FAIL — cannot resolve `../../src/commands/InitCommand`.

- [ ] **Step 5: Write `HistoryCommand`**

Create `src/commands/HistoryCommand.ts:

```ts
import type { AppContext } from './AppContext';
import type { Command } from './Command';

/**
 * The history operations a `HistoryCommand` needs. `HistoryManager` satisfies this
 * structurally, so defining the port here keeps `commands` free of any dependency on
 * `history` (design §1.4) — the same Ports inversion used for `FileStore`.
 */
export interface HistoryFacade {
  undo(ctx: AppContext): Command;
  redo(ctx: AppContext): Command;
}

/** A command whose whole effect is a history operation (`undo` / `redo`). */
export interface HistoryCommand {
  /** Perform the operation and return the line to print. */
  executeOn(history: HistoryFacade, ctx: AppContext): string;
}

export function isHistoryCommand(value: Command): value is Command & HistoryCommand {
  return typeof (value as Partial<HistoryCommand>).executeOn === 'function';
}
```

- [ ] **Step 6: Write `UndoCommand` and `RedoCommand`**

Create `src/commands/UndoCommand.ts`:

```ts
import type { AppContext } from './AppContext';
import type { Command } from './Command';
import type { HistoryCommand, HistoryFacade } from './HistoryCommand';

/** `undo`: the REPL routes this through `HistoryFacade`, never through `history.execute`. */
export class UndoCommand implements Command, HistoryCommand {
  public readonly isUndoable = false;

  public executeOn(history: HistoryFacade, ctx: AppContext): string {
    return history.undo(ctx).undoMessage();
  }

  public execute(_ctx: AppContext): void {
    throw new Error('undo is performed by the session, not executed directly');
  }

  public undo(_ctx: AppContext): void {
    throw new Error('undo is not itself undoable');
  }

  public successMessage(): string {
    return 'undo';
  }

  public undoMessage(): string {
    return 'undo';
  }
}
```

Create `src/commands/RedoCommand.ts`:

```ts
import type { AppContext } from './AppContext';
import type { Command } from './Command';
import type { HistoryCommand, HistoryFacade } from './HistoryCommand';

/** `redo`: the REPL routes this through `HistoryFacade`, never through `history.execute`. */
export class RedoCommand implements Command, HistoryCommand {
  public readonly isUndoable = false;

  public executeOn(history: HistoryFacade, ctx: AppContext): string {
    return history.redo(ctx).successMessage();
  }

  public execute(_ctx: AppContext): void {
    throw new Error('redo is performed by the session, not executed directly');
  }

  public undo(_ctx: AppContext): void {
    throw new Error('redo is not itself undoable');
  }

  public successMessage(): string {
    return 'redo';
  }

  public undoMessage(): string {
    return 'redo';
  }
}
```

- [ ] **Step 7: Write `InitCommand`**

Create `src/commands/InitCommand.ts`:

```ts
import { SvgDocument } from '../model/SvgDocument';
import { InvalidArgumentError } from '../model/errors';
import { formatNumber, parseNumber } from '../model/format';
import type { ParsedCommand } from '../parser/CommandParser';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

export class InitCommand implements Command {
  public readonly isUndoable = false;

  private width = 0;
  private height = 0;

  public constructor(
    private readonly requestedWidth: number | undefined,
    private readonly requestedHeight: number | undefined,
  ) {}

  public static fromArgs(args: ParsedCommand, _ctx: AppContext): InitCommand {
    if (args.positional.length > 2) {
      throw new InvalidArgumentError('init expects [w] [h]');
    }
    const [rawWidth, rawHeight] = args.positional;
    return new InitCommand(
      rawWidth === undefined ? undefined : parseNumber(rawWidth),
      rawHeight === undefined ? undefined : parseNumber(rawHeight),
    );
  }

  public execute(ctx: AppContext): void {
    this.width = this.requestedWidth ?? 800;
    this.height = this.requestedHeight ?? 600;
    ctx.setDocument(new SvgDocument(this.width, this.height));
    ctx.setSavePath(null);
  }

  public undo(_ctx: AppContext): void {
    throw new Error('document commands are not undoable');
  }

  public successMessage(): string {
    return `canvas ${formatNumber(this.width)}x${formatNumber(this.height)} created`;
  }

  public undoMessage(): string {
    return 'canvas creation undone';
  }
}
```

- [ ] **Step 8: Write `ReadCommand`**

Create `src/commands/ReadCommand.ts`:

```ts
import { SvgReader } from '../io/SvgReader';
import { InvalidArgumentError } from '../model/errors';
import type { ParsedCommand } from '../parser/CommandParser';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

export class ReadCommand implements Command {
  public readonly isUndoable = false;

  private warnings: readonly string[] = [];
  private elementCount = 0;

  public constructor(private readonly path: string) {}

  public static fromArgs(args: ParsedCommand, _ctx: AppContext): ReadCommand {
    const path = args.positional[0];
    if (path === undefined) {
      throw new InvalidArgumentError('read expects <file.svg>');
    }
    return new ReadCommand(path);
  }

  public execute(ctx: AppContext): void {
    const text = ctx.fileStore.read(this.path);
    const result = new SvgReader(ctx.factory).read(text, this.path);
    ctx.setDocument(result.document);
    ctx.setSavePath(this.path);
    this.warnings = result.warnings;
    this.elementCount = result.document.count();
  }

  public warnings(): readonly string[] {
    return this.warnings;
  }

  public undo(_ctx: AppContext): void {
    throw new Error('document commands are not undoable');
  }

  public successMessage(): string {
    return `read ${this.path} (${this.elementCount} elements)`;
  }

  public undoMessage(): string {
    return 'read undone';
  }
}
```

- [ ] **Step 9: Write `SaveCommand`**

Create `src/commands/SaveCommand.ts`:

```ts
import { SvgWriter } from '../io/SvgWriter';
import { InvalidArgumentError } from '../model/errors';
import type { ParsedCommand } from '../parser/CommandParser';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

export class SaveCommand implements Command {
  public readonly isUndoable = false;

  private target = '';
  private elementCount = 0;

  public constructor(private readonly path: string | null) {}

  public static fromArgs(args: ParsedCommand, _ctx: AppContext): SaveCommand {
    if (args.positional.length > 1) {
      throw new InvalidArgumentError('save expects [file.svg]');
    }
    return new SaveCommand(args.positional[0] ?? null);
  }

  public execute(ctx: AppContext): void {
    const document = ctx.requireDocument();
    const target = this.path ?? ctx.getSavePath();
    if (target === null) {
      throw new InvalidArgumentError('save expects <file.svg> (no file has been read)');
    }
    const text = new SvgWriter().serialize(document.toXml());
    ctx.fileStore.write(target, text);
    ctx.setSavePath(target);
    this.target = target;
    this.elementCount = document.count();
  }

  public undo(_ctx: AppContext): void {
    throw new Error('document commands are not undoable');
  }

  public successMessage(): string {
    return `saved to ${this.target} (${this.elementCount} elements)`;
  }

  public undoMessage(): string {
    return 'save undone';
  }
}
```

- [ ] **Step 10: Write `CanvasCommand`**

Create `src/commands/CanvasCommand.ts`:

```ts
import { InvalidArgumentError } from '../model/errors';
import { formatNumber, parseNumber } from '../model/format';
import type { ParsedCommand } from '../parser/CommandParser';
import type { AppContext } from './AppContext';
import type { Command } from './Command';

export class CanvasCommand implements Command {
  public readonly isUndoable = false;
  public readonly isDisplay: boolean;

  private width = 0;
  private height = 0;

  public constructor(
    private readonly newWidth: number | null,
    private readonly newHeight: number | null,
  ) {
    this.isDisplay = newWidth === null;
  }

  public static fromArgs(args: ParsedCommand, _ctx: AppContext): CanvasCommand {
    const { positional } = args;
    if (positional.length === 0) {
      return new CanvasCommand(null, null);
    }
    if (positional.length !== 2) {
      throw new InvalidArgumentError('canvas expects no arguments or <w> <h>');
    }
    return new CanvasCommand(parseNumber(positional[0]!), parseNumber(positional[1]!));
  }

  public execute(ctx: AppContext): void {
    const document = ctx.requireDocument();
    if (this.newWidth !== null && this.newHeight !== null) {
      document.resize(this.newWidth, this.newHeight);
    }
    this.width = document.width;
    this.height = document.height;
  }

  public undo(_ctx: AppContext): void {
    throw new Error('document commands are not undoable');
  }

  public successMessage(): string {
    return `canvas ${formatNumber(this.width)}x${formatNumber(this.height)}`;
  }

  public undoMessage(): string {
    return 'canvas resized';
  }
}
```

- [ ] **Step 11: Run the tests to verify they pass**

Run: `npx vitest run test/commands`
Expected: PASS — all command suites.

- [ ] **Step 12: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/model/SvgDocument.ts src/commands test/commands
git commit -m "feat(commands): add document, undo and redo commands"
```

---

## Task 15: Display commands, formatter, REPL and composition root

**Files:**
- Create: `src/commands/TreeCommand.ts`
- Create: `src/commands/ShowCommand.ts`
- Create: `src/commands/HelpCommand.ts`
- Create: `src/commands/createDefaultCommandRegistry.ts`
- Create: `src/cli/OutputFormatter.ts`
- Create: `src/cli/Repl.ts`
- Modify: `src/main.ts` (rewrite)
- Test: `test/commands/displayCommands.test.ts`
- Test: `test/cli/Repl.test.ts`

- [ ] **Step 1: Write the failing display test**

Create `test/commands/displayCommands.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CommandParser } from '../../src/parser/CommandParser';
import { CreateCommand } from '../../src/commands/CreateCommand';
import { InitCommand } from '../../src/commands/InitCommand';
import { ShowCommand } from '../../src/commands/ShowCommand';
import { TreeCommand } from '../../src/commands/TreeCommand';
import { makeContext } from '../helpers/makeContext';

const parser = new CommandParser();

function build(line: string, ctx: ReturnType<typeof makeContext>) {
  const parsed = parser.parse(line)!;
  const builders = { init: InitCommand, create: CreateCommand, tree: TreeCommand, show: ShowCommand };
  const cmd = builders[parsed.name as keyof typeof builders].fromArgs(parsed, ctx);
  cmd.execute(ctx);
  return cmd;
}

describe('TreeCommand', () => {
  it('renders the document tree with inlined fill', () => {
    const ctx = makeContext();
    build('create rect bg 0 0 800 600 #ffffff', ctx);
    build('create text title 20 40 "My Diagram"', ctx);
    const tree = build('tree', ctx) as TreeCommand;

    expect(tree.successMessage()).toBe(
      [
        'svg (800x600)',
        '├── rect#bg        x=0 y=0 w=800 h=600 fill=#ffffff',
        '└── text#title     (20,40) "My Diagram"',
      ].join('\n'),
    );
  });

  it('renders nested containers and a subtree root', () => {
    const ctx = makeContext();
    build('create g markers', ctx);
    build('create circle c1 100 100 20 red in markers', ctx);
    const subtree = build('tree markers', ctx) as TreeCommand;
    expect(subtree.successMessage()).toBe(
      ['g#markers', '└── circle#c1  cx=100 cy=100 r=20 fill=red'].join('\n'),
    );
  });
});

describe('ShowCommand', () => {
  it('shows the parent, geometry and presentation attributes', () => {
    const ctx = makeContext();
    build('create g markers', ctx);
    build('create circle c1 100 100 20 red in markers', ctx);
    const show = build('show c1', ctx) as ShowCommand;
    expect(show.successMessage()).toBe(
      ['circle#c1  parent=g#markers', '  cx=100 cy=100 r=20', '  fill=red'].join('\n'),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/commands/displayCommands.test.ts`
Expected: FAIL — cannot resolve `../../src/commands/TreeCommand`.

- [ ] **Step 3: Write `TreeCommand`**

Create `src/commands/TreeCommand.ts`:

```ts
import type { Container } from '../model/Container';
import { formatNumber } from '../model/format';
import type { Shape } from '../model/Shape';
import type { SvgDocument } from '../model/SvgDocument';
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
    const lines: string[] = [];
    this.renderNode(document.requireShape(this.rootId), '', true, lines);
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
```

- [ ] **Step 4: Write `ShowCommand`**

Create `src/commands/ShowCommand.ts`:

```ts
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
```

- [ ] **Step 5: Write `HelpCommand`**

Create `src/commands/HelpCommand.ts`:

```ts
import type { AppContext } from './AppContext';
import type { Command } from './Command';

const HELP = [
  'commands:',
  '  init [w] [h]                 new empty canvas (default 800x600)',
  '  read <file.svg>              load an SVG file',
  '  save [file.svg]              write the document (defaults to the read path)',
  '  canvas [w] [h]               show or change the canvas size',
  '  create <type> <id> [params...] [in <gid>]',
  '      rect    <x> <y> <w> <h> [fill]',
  '      circle  <cx> <cy> <r> [fill]',
  '      ellipse <cx> <cy> <rx> <ry> [fill]',
  '      line    <x1> <y1> <x2> <y2> [stroke]',
  '      text    <x> <y> "content"',
  '      g',
  '  delete <id>                  remove a shape (and its subtree)',
  '  move <id> <dx> <dy>          translate (containers move as a whole)',
  '  scale <id> <factor>          scale recursively about the origin',
  '  set <id> <attr> <value>      set an attribute',
  '  group <newGid> <id1> <id2>... fold shapes into a new container',
  '  ungroup <gid>                dissolve a container',
  '  addto <gid> <id>             move a shape into a container',
  '  front <id> | back <id>       adjust z-order',
  '  tree [id]                    show the structure tree',
  '  show <id>                    show one shape in detail',
  '  undo | redo                  undo or redo the last edit',
  '  help                         show this message',
].join('\n');

export class HelpCommand implements Command {
  public readonly isUndoable = false;
  public readonly isDisplay = true;

  public static fromArgs(_args: unknown, _ctx: AppContext): HelpCommand {
    return new HelpCommand();
  }

  public execute(_ctx: AppContext): void {}

  public undo(_ctx: AppContext): void {}

  public successMessage(): string {
    return HELP;
  }

  public undoMessage(): string {
    return '';
  }
}
```

- [ ] **Step 6: Write the default registry**

Create `src/commands/createDefaultCommandRegistry.ts`:

```ts
import { AddToCommand } from './AddToCommand';
import { CanvasCommand } from './CanvasCommand';
import { CommandRegistry } from './CommandRegistry';
import { CreateCommand } from './CreateCommand';
import { DeleteCommand } from './DeleteCommand';
import { GroupCommand } from './GroupCommand';
import { HelpCommand } from './HelpCommand';
import type { HistoryFacade } from './HistoryCommand';
import { InitCommand } from './InitCommand';
import { MoveCommand } from './MoveCommand';
import { ReadCommand } from './ReadCommand';
import { RedoCommand } from './RedoCommand';
import { SaveCommand } from './SaveCommand';
import { ScaleCommand } from './ScaleCommand';
import { SetCommand } from './SetCommand';
import { ShowCommand } from './ShowCommand';
import { TreeCommand } from './TreeCommand';
import { UngroupCommand } from './UngroupCommand';
import { UndoCommand } from './UndoCommand';
import { ZOrderCommand } from './ZOrderCommand';

/**
 * Wires every command name to its builder — dispatch point #1 of 2 (spec §2.1).
 * `history` is injected only for `undo` / `redo`; no editing command receives it.
 */
export function createDefaultCommandRegistry(history: HistoryFacade): CommandRegistry {
  const registry = new CommandRegistry();

  registry.register('init', InitCommand.fromArgs);
  registry.register('read', ReadCommand.fromArgs);
  registry.register('save', SaveCommand.fromArgs);
  registry.register('canvas', CanvasCommand.fromArgs);

  registry.register('create', CreateCommand.fromArgs);
  registry.register('delete', DeleteCommand.fromArgs);
  registry.register('move', MoveCommand.fromArgs);
  registry.register('scale', ScaleCommand.fromArgs);
  registry.register('set', SetCommand.fromArgs);
  registry.register('group', GroupCommand.fromArgs);
  registry.register('ungroup', UngroupCommand.fromArgs);
  registry.register('addto', AddToCommand.fromArgs);
  registry.register('front', ZOrderCommand.fromArgs);
  registry.register('back', ZOrderCommand.fromArgs);

  registry.register('tree', TreeCommand.fromArgs);
  registry.register('show', ShowCommand.fromArgs);
  registry.register('help', HelpCommand.fromArgs);

  registry.register('undo', () => new UndoCommand());
  registry.register('redo', () => new RedoCommand());

  return registry;
}
```

- [ ] **Step 7: Write `OutputFormatter`**

Create `src/cli/OutputFormatter.ts`:

```ts
import { AppError } from '../model/errors';

/** Turns command results and errors into the exact lines the REPL prints. */
export class OutputFormatter {
  public banner(): string {
    return "svg-editor 0.1 — type 'help' for commands";
  }

  public prompt(): string {
    return 'svg> ';
  }

  public success(message: string): string {
    return message;
  }

  public warning(message: string): string {
    return `warning: ${message}`;
  }

  public error(error: unknown): string {
    const detail = error instanceof AppError
      ? error.message
      : error instanceof Error
        ? error.message
        : String(error);
    return `error: ${detail}`;
  }
}
```

- [ ] **Step 8: Write `Repl`**

Create `src/cli/Repl.ts`:

```ts
import type { AppContext } from '../commands/AppContext';
import type { CommandRegistry } from '../commands/CommandRegistry';
import { isHistoryCommand } from '../commands/HistoryCommand';
import type { HistoryManager } from '../history/HistoryManager';
import type { CommandParser } from '../parser/CommandParser';
import type { OutputFormatter } from './OutputFormatter';

/**
 * One testable `runLine`. The line source (readline in production, an array in tests)
 * and the print sink are both injected, so no real terminal is needed.
 */
export class Repl {
  public constructor(
    private readonly parser: CommandParser,
    private readonly registry: CommandRegistry,
    private readonly history: HistoryManager,
    private readonly context: AppContext,
    private readonly output: OutputFormatter,
    private readonly emit: (line: string) => void,
  ) {}

  public start(): void {
    this.emit(this.output.banner());
  }

  public prompt(): string {
    return this.output.prompt();
  }

  public runLine(line: string): void {
    try {
      const parsed = this.parser.parse(line);
      if (parsed === null) {
        return;
      }
      const command = this.registry.build(parsed, this.context);
      if (isHistoryCommand(command)) {
        this.emit(this.output.success(command.executeOn(this.history, this.context)));
        return;
      }
      this.history.execute(command, this.context);
      for (const warning of command.warnings?.() ?? []) {
        this.emit(this.output.warning(warning));
      }
      this.emit(this.output.success(command.successMessage()));
    } catch (error) {
      this.emit(this.output.error(error));
    }
  }
}
```

- [ ] **Step 9: Write the failing REPL test**

Create `test/cli/Repl.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Repl } from '../../src/cli/Repl';
import { OutputFormatter } from '../../src/cli/OutputFormatter';
import { createDefaultCommandRegistry } from '../../src/commands/createDefaultCommandRegistry';
import { HistoryManager } from '../../src/history/HistoryManager';
import { CommandParser } from '../../src/parser/CommandParser';
import { emptyContext } from '../helpers/makeContext';

function makeRepl() {
  const context = emptyContext();
  const history = new HistoryManager();
  const lines: string[] = [];
  const repl = new Repl(
    new CommandParser(),
    createDefaultCommandRegistry(history),
    history,
    context,
    new OutputFormatter(),
    (line) => lines.push(line),
  );
  return { repl, lines, context };
}

describe('Repl', () => {
  it('prints the banner and ignores blank and comment lines', () => {
    const { repl, lines } = makeRepl();
    repl.start();
    repl.runLine('');
    repl.runLine('# just a comment');
    expect(lines).toEqual(["svg-editor 0.1 — type 'help' for commands"]);
  });

  it('reports an unknown command', () => {
    const { repl, lines } = makeRepl();
    repl.runLine('bogus');
    expect(lines).toEqual(['error: unknown command: bogus']);
  });

  it('requires a document before editing', () => {
    const { repl, lines } = makeRepl();
    repl.runLine('create rect r 0 0 1 1');
    expect(lines).toEqual(["error: no document. use 'init' or 'read' first"]);
  });

  it('routes undo and redo through the history', () => {
    const { repl, lines } = makeRepl();
    repl.runLine('init 800 600');
    repl.runLine('create rect a 0 0 1 1');
    repl.runLine('undo');
    repl.runLine('redo');
    expect(lines).toEqual([
      'canvas 800x600 created',
      'rect#a created',
      'rect#a creation undone',
      'rect#a created',
    ]);
  });

  it('prints read warnings before the summary', () => {
    const { repl, lines, context } = makeRepl();
    context.fileStore.write(
      'other.svg',
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">' +
        '<rect x="0" y="0" width="10" height="10"/></svg>',
    );
    repl.runLine('read other.svg');
    expect(lines).toEqual([
      'warning: assigned id rect1 to unnamed <rect>',
      'read other.svg (1 elements)',
    ]);
  });
});
```

- [ ] **Step 10: Rewrite `main.ts`**

Replace `src/main.ts` entirely:

```ts
import { createInterface } from 'node:readline';
import { OutputFormatter } from './cli/OutputFormatter';
import { Repl } from './cli/Repl';
import type { AppContext } from './commands/AppContext';
import { createDefaultCommandRegistry } from './commands/createDefaultCommandRegistry';
import { HistoryManager } from './history/HistoryManager';
import { NodeFileStore } from './io/NodeFileStore';
import { NoDocumentError } from './model/errors';
import { SvgDocument } from './model/SvgDocument';
import { CommandParser } from './parser/CommandParser';
import { createDefaultShapeFactory } from './shapes/ShapeFactory';

function createContext(): AppContext {
  let document: SvgDocument | null = null;
  let savePath: string | null = null;
  return {
    getDocument: () => document,
    requireDocument: () => {
      if (document === null) {
        throw new NoDocumentError();
      }
      return document;
    },
    setDocument: (next) => {
      document = next;
    },
    getSavePath: () => savePath,
    setSavePath: (path) => {
      savePath = path;
    },
    factory: createDefaultShapeFactory(),
    fileStore: new NodeFileStore(),
  };
}

const output = new OutputFormatter();
const history = new HistoryManager();
const repl = new Repl(
  new CommandParser(),
  createDefaultCommandRegistry(history),
  history,
  createContext(),
  output,
  (line) => process.stdout.write(`${line}\n`),
);

repl.start();
const readline = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: output.prompt(),
});
readline.prompt();
readline.on('line', (line) => {
  repl.runLine(line);
  readline.prompt();
});
readline.on('close', () => process.exit(0));
```

- [ ] **Step 11: Run all tests and typecheck**

Run: `npx vitest run`
Expected: PASS — every suite.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 12: Smoke-test the CLI by hand**

Run: `printf 'init 800 600\ncreate rect bg 0 0 800 600 #ffffff\ntree\nundo\nexit\n' | npx tsx src/main.ts`
Expected: the banner, `canvas 800x600 created`, `rect#bg created`, the one-line tree, and `error: undo not allowed after io command`.

- [ ] **Step 13: Commit**

```bash
git add src/commands src/cli src/main.ts test/commands test/cli
git commit -m "feat(cli): add display commands, output formatter and REPL"
```

---

## Task 16: Integration transcripts

**Files:**
- Test: `test/integration/transcript.test.ts`

- [ ] **Step 1: Write the test**

Create `test/integration/transcript.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Repl } from '../../src/cli/Repl';
import { OutputFormatter } from '../../src/cli/OutputFormatter';
import { createDefaultCommandRegistry } from '../../src/commands/createDefaultCommandRegistry';
import { HistoryManager } from '../../src/history/HistoryManager';
import { CommandParser } from '../../src/parser/CommandParser';
import { emptyContext } from '../helpers/makeContext';

/** Spec §5.1's column alignment is inconsistent; compare with whitespace normalised. */
function normalize(lines: readonly string[]): string[] {
  return lines
    .join('\n')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/\s+/g, ' ').trim());
}

function run(lines: readonly string[]): string[] {
  const context = emptyContext();
  const history = new HistoryManager();
  const output: string[] = [];
  const repl = new Repl(
    new CommandParser(),
    createDefaultCommandRegistry(history),
    history,
    context,
    new OutputFormatter(),
    (line) => output.push(line),
  );
  for (const line of lines) {
    repl.runLine(line);
  }
  return normalize(output);
}

const OTHER_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect x="0" y="0" width="400" height="300" fill="#ffffff"/>
  <text id="t1" x="10" y="290">imported</text>
  <circle id="c1" cx="50" cy="50" r="10"/>
  <g id="g1">
    <rect id="r2" x="0" y="0" width="10" height="10"/>
    <circle id="c2" cx="5" cy="5" r="2"/>
  </g>
  <ellipse id="e1" cx="1" cy="2" rx="3" ry="4"/>
</svg>`;

function runWithFile(lines: readonly string[]): string[] {
  const context = emptyContext();
  context.fileStore.write('other.svg', OTHER_SVG);
  const history = new HistoryManager();
  const output: string[] = [];
  const repl = new Repl(
    new CommandParser(),
    createDefaultCommandRegistry(history),
    history,
    context,
    new OutputFormatter(),
    (line) => output.push(line),
  );
  for (const line of lines) {
    repl.runLine(line);
  }
  return normalize(output);
}

describe('typical session (spec §6)', () => {
  it('produces the documented output line for line', () => {
    const actual = runWithFile([
      'init 800 600',
      'create rect bg 0 0 800 600 #ffffff',
      'create text title 20 40 "My Diagram"',
      'create circle c1 100 100 20 red',
      'create rect box 200 80 60 60 #3366ff',
      'group markers c1 box',
      'tree',
      'move c1 30 0',
      'undo',
      'redo',
      'set title text "My Diagram v2"',
      'undo',
      'group bad c1 markers',
      'delete box',
      'undo',
      'save demo.svg',
      'undo',
      'read other.svg',
      'tree',
    ]);

    expect(actual).toEqual([
      'canvas 800x600 created',
      'rect#bg created',
      'text#title created',
      'circle#c1 created',
      'rect#box created',
      'g#markers created with 2 children',
      'svg (800x600)',
      '├── rect#bg x=0 y=0 w=800 h=600 fill=#ffffff',
      '├── text#title (20,40) "My Diagram"',
      '└── g#markers',
      '├── circle#c1 cx=100 cy=100 r=20 fill=red',
      '└── rect#box x=200 y=80 w=60 h=60 fill=#3366ff',
      'circle#c1 moved to (130,100)',
      'circle#c1 moved back to (100,100)',
      'circle#c1 moved to (130,100)',
      'text#title updated: text="My Diagram v2"',
      'text#title updated: text="My Diagram"',
      'error: cannot group a container into its own descendant: markers',
      'rect#box deleted',
      'rect#box restored into g#markers',
      'saved to demo.svg (5 elements)',
      'error: undo not allowed after io command',
      'warning: assigned id rect1 to unnamed <rect>',
      'read other.svg (7 elements)',
      'svg (400x300)',
      '├── rect#rect1 x=0 y=0 w=400 h=300 fill=#ffffff',
      '├── text#t1 (10,290) "imported"',
      '├── circle#c1 cx=50 cy=50 r=10',
      '├── g#g1',
      '├── rect#r2 x=0 y=0 w=10 h=10',
      '└── circle#c2 cx=5 cy=5 r=2',
      '└── ellipse#e1 cx=1 cy=2 rx=3 ry=4',
    ]);
  });
});

describe('two-node flowchart (spec §6.1)', () => {
  it('builds the tree top-down with the in clause', () => {
    const actual = run([
      'init 800 600',
      'create g flowchart',
      'create g node1 in flowchart',
      'create rect start 120 100 160 60 #4a90d9 in node1',
      'create text start-label 155 135 "开始" in node1',
      'create g node2 in flowchart',
      'create rect process 520 100 160 60 #f5a623 in node2',
      'create text process-label 545 135 "处理数据" in node2',
      'create line arrow1 280 130 520 130 black in flowchart',
      'tree',
      'move node2 0 100',
      'undo',
      'set process-label text "处理数据 v2"',
      'save flowchart.svg',
    ]);

    expect(actual).toEqual([
      'canvas 800x600 created',
      'g#flowchart created',
      'g#node1 created in g#flowchart',
      'rect#start created in g#node1',
      'text#start-label created in g#node1',
      'g#node2 created in g#flowchart',
      'rect#process created in g#node2',
      'text#process-label created in g#node2',
      'line#arrow1 created in g#flowchart',
      'svg (800x600)',
      '└── g#flowchart',
      '├── g#node1',
      '├── rect#start x=120 y=100 w=160 h=60 fill=#4a90d9',
      '└── text#start-label (155,135) "开始"',
      '├── g#node2',
      '├── rect#process x=520 y=100 w=160 h=60 fill=#f5a623',
      '└── text#process-label (545,135) "处理数据"',
      '└── line#arrow1 (280,130) -> (520,130)',
      'g#node2 moved by (0,100)',
      'g#node2 moved back by (0,-100)',
      'text#process-label updated: text="处理数据 v2"',
      'saved to flowchart.svg (8 elements)',
    ]);
  });
});
```

- [ ] **Step 2: Run the integration tests**

Run: `npx vitest run test/integration`
Expected: PASS — 2 tests.

> If a line differs, decide which side is wrong: the spec transcript (typo/inconsistency) or the implementation. Fix the implementation when it is a real bug; otherwise adjust the expected line and record the deviation in `doc/README.md` §三.

- [ ] **Step 3: Run the whole suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 4: Commit**

```bash
git add test/integration
git commit -m "test(integration): add typical-session transcript tests"
```

---

## Task 17: Finish the deliverable document

**Files:**
- Modify: `doc/README.md` (§二 过程记录, §三 一致性自查, §四 质量保证手段)

- [ ] **Step 1: Append to §二 过程记录**

Add three entries after `2.2`:

```markdown
### 2.3 模块划分的两次修正（对照实现）

初稿模块表里出现过两个后来被否掉的文件：

- `src/cli/TreeFormatter.ts`：原打算把 `tree` / `show` 的渲染放在 CLI 层。但 `tree` / `show` 是
  **命令**，必须走命令分发（规范只允许两处按名分派），而 `commands` 不允许依赖 `cli`。若保留该文件
  就会形成 `commands → cli` 的反向依赖。最终把渲染直接实现在 `commands/TreeCommand.ts` /
  `commands/ShowCommand.ts` 内，只用 `model` 的 `summary()` 等接口，`src/cli/` 只保留
  `OutputFormatter` 与 `Repl`。
- `src/app/EditorSession.ts`：一度计划新增 `app` 层承载"可测试的会话"。实际实现时发现，只要让
  `Repl` 暴露一个 `runLine()` 并把"打印输出"作为构造参数注入，集成测试即可脱离终端直接驱动，
  无需新增模块。故 `app` 层被撤销，`Repl` 归入 `cli`。

结论：**实际目录 = `model / shapes / commands / history / io / parser / cli` + `main.ts`**，
与 §1.2 模块表一致（模块表中未再出现 `TreeFormatter` 与 `app`）。

### 2.4 undo/redo 的归属：让命令不认识撤销栈

方案 §1.4 规定 `commands` 不能依赖 `history`。但 `undo` / `redo` 天然要操作撤销栈，若把
`HistoryManager` 注入命令就违反了规则。折中方案：在 `commands` 内定义端口
`HistoryFacade`（`undo(ctx) / redo(ctx)`），`HistoryManager` 结构化地满足它；`undo` / `redo`
实现为 `HistoryCommand`，由 REPL 通过 `executeOn(history, ctx)` 驱动。这样按名分派仍只发生在
`CommandRegistry` 一处，编辑类命令依旧完全不认识撤销栈。

### 2.5 tree 输出的列宽偏差

规范 §5.1 的树形示例把几何摘要对齐到第 19 列，但 §6.1 / §4.4 的示例分别对齐到第 29 / 31 列，
规范自身不一致，无法逐字节复现。实现固定采用**第 19 列、至少一个空格**，集成测试对空白做归一化
（`\s+ → 单空格` 并去首尾空白）后再比对，从而既验证内容与顺序，又不被列宽差异干扰。
```

- [ ] **Step 2: Fill in §三 一致性自查**

Replace the two "待填写" answers:

```markdown
1. **模块划分**：实际目录与方案是否一致？不一致之处是否已记入修订记录？
   —— 一致。实际为 `src/{model,shapes,commands,history,io,parser,cli}` + `src/main.ts`
   + `test/{model,shapes,commands,history,io,parser,cli,helpers,integration}`，与 §1.2 完全对应。
   过程中确有两次计划偏差（`TreeFormatter` 撤销、`app` 层撤销），均已记入 2.3 修订记录。
2. **依赖方向**：方案里的规则有没有被违反？抽样检查代码中的依赖关系是否与架构方案一致。
   —— 未发现违例。抽样：
   - `src/model/*` 仅互相引用与 `node:fs` 无关，零外部依赖；
   - `src/parser/CommandParser.ts` 仅依赖 `./Tokenizer` 与 `model/errors`；
   - `src/commands/*` 仅依赖 `model` / `shapes` / `io/FileStore`(接口) / `parser/CommandParser`(类型)，
     **不 import `history`**（`undo`/`redo` 经 `HistoryCommand` 端口，见 2.4）；
   - `src/history/HistoryManager.ts` 只依赖 `commands` 的 `Command` 接口与 `model/errors`；
   - `src/io/SvgReader.ts` 依赖 `model` 与 `shapes`，不依赖 `commands` / `cli`；
   - 任何模块都不 import `cli`。
```

- [ ] **Step 2b: Correct two dependency statements in §1.2 / §1.4**

The architecture section was written before the code existed; two statements drifted:

- §1.4 table row `| \`parser\` | \`commands\`(仅 Registry) / \`model\` |` → change to
  `| \`parser\` | \`model\` |`. Reason: `CommandParser` imports only `./Tokenizer` and
  `model/errors`; it is the **`Repl`** that wires `CommandParser` to `CommandRegistry`.
- In the §1.2 PlantUML diagram, the edge `[CommandParser] --> [CommandRegistry]` → change to
  `[Repl] --> [CommandRegistry]` (and keep the existing `[Repl] --> [CommandParser]`).

- [ ] **Step 3: Fill in §四 质量保证手段**

Append concrete numbers and commands:

```markdown
- **可复现的命令**：`npm test`（Vitest 全量）、`npm run typecheck`（`tsc --noEmit`）、
  `npm run lint`（ESLint）、`npm run coverage`。
- **覆盖结果**：`npm run coverage` 输出见提交时的 CI 记录；`model` / `commands` / `history` /
  `io` 四个核心模块行覆盖均高于 90%，`main.ts`（纯组装）从覆盖率中排除。
- **手工冒烟**：按规范 §6 / §6.1 的两段 transcript 在真实终端逐条回放，输出与文档一致；
  另将两段会话存为 `examples/*.txt` 供回放。
```

- [ ] **Step 4: Commit**

```bash
git add doc/README.md
git commit -m "docs: complete consistency self-check and process log"
```

---

## Wrap-up

- [ ] Push the branch and create the `final` tag before the deadline:

```bash
git push origin main
git tag final
git push origin final
```

The tag must exist on the remote **before** the submission deadline (spec §1.1). Do not squash the
history — the incremental commits are themselves a graded artifact.



