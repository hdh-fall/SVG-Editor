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
      '│ ├── rect#r2 x=0 y=0 w=10 h=10',
      '│ └── circle#c2 cx=5 cy=5 r=2',
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
      '│ ├── rect#start x=120 y=100 w=160 h=60 fill=#4a90d9',
      '│ └── text#start-label (155,135) "开始"',
      '├── g#node2',
      '│ ├── rect#process x=520 y=100 w=160 h=60 fill=#f5a623',
      '│ └── text#process-label (545,135) "处理数据"',
      '└── line#arrow1 (280,130) -> (520,130)',
      'g#node2 moved by (0,100)',
      'g#node2 moved back by (0,-100)',
      'text#process-label updated: text="处理数据 v2"',
      'saved to flowchart.svg (8 elements)',
    ]);
  });
});
