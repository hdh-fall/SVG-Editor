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
