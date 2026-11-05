import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Registratie en wachtwoordherstel lopen alleen via onze eigen domeinfuncties.
 * Die zetten deze context; de Better Auth-hooks weigeren alles daarbuiten.
 */
type AuthFlowContext = {
  allowSignUp?: boolean
  capturedResetToken?: string
}

const storage = new AsyncLocalStorage<AuthFlowContext>()

export function runAuthFlow<T>(context: AuthFlowContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(context, fn)
}

export function currentAuthFlow(): AuthFlowContext | undefined {
  return storage.getStore()
}
