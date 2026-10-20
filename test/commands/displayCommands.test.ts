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
  const builders = {
    init: InitCommand,
    create: CreateCommand,
    tree: TreeCommand,
    show: ShowCommand,
  };
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
      ['g#markers', '└── circle#c1      cx=100 cy=100 r=20 fill=red'].join('\n'),
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
