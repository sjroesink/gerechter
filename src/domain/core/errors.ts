export type DomainErrorCode =
  'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'NO_ACTIVE_HOUSEHOLD' | 'CONFLICT' | 'INVALID'

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'DomainError'
  }
}

export class Unauthenticated extends DomainError {
  constructor(message = 'Je bent niet ingelogd.') {
    super('UNAUTHENTICATED', message)
  }
}

export class Forbidden extends DomainError {
  constructor(message = 'Je hebt geen rechten voor deze actie.') {
    super('FORBIDDEN', message)
  }
}

/** Ook gebruikt voor gegevens van een ander huishouden: die bestaan voor jou niet. */
export class NotFound extends DomainError {
  constructor(message = 'Niet gevonden.') {
    super('NOT_FOUND', message)
  }
}

export class NoActiveHousehold extends DomainError {
  constructor(message = 'Je bent geen lid van een huishouden.') {
    super('NO_ACTIVE_HOUSEHOLD', message)
  }
}

export class Conflict extends DomainError {
  constructor(message: string) {
    super('CONFLICT', message)
  }
}

export class Invalid extends DomainError {
  constructor(message: string) {
    super('INVALID', message)
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError
}
