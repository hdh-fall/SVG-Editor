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
