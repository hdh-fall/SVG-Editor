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
    if (error instanceof Error) {
      return `error: ${error.message}`;
    }
    return `error: ${String(error)}`;
  }
}
