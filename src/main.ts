import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';

// Scaffold stub: proves tsx + readline work end to end.
// Replaced by the real REPL (src/cli/Repl.ts) during implementation.
const BANNER = "svg-editor 0.1 — type 'help' for commands";

function main(): void {
  console.log(BANNER);

  const rl = createInterface({ input: stdin, output: stdout, prompt: 'svg> ' });
  rl.prompt();

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (trimmed !== '' && !trimmed.startsWith('#')) {
      console.log(`error: not implemented: ${trimmed}`);
    }
    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

main();
