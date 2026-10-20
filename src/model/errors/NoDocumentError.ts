import { AppError } from './AppError';

export class NoDocumentError extends AppError {
  public constructor() {
    super("no document. use 'init' or 'read' first");
  }
}
