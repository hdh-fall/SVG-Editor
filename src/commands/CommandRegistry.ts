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
