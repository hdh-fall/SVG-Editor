import { AppError } from './AppError';

export class UnknownCommandError extends AppError {
  public constructor(name: string) {
    super(`unknown command: ${name}`);
  }
}
