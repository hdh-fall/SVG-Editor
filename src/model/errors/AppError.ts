/** Base class for every error whose message is meant to be shown to the user verbatim. */
export class AppError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
