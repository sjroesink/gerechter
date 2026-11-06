import { isDomainError, type Ctx } from '~/domain/core'

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean }

/** Gedeelde adapter: rechten en validatie blijven in het domein. */
export async function tool(
  getCtx: () => Promise<Ctx>,
  run: (ctx: Ctx) => Promise<unknown>,
): Promise<ToolResult> {
  try {
    const result = await run(await getCtx())
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  } catch (error) {
    if (isDomainError(error)) return { content: [{ type: 'text', text: error.message }], isError: true }
    throw error
  }
}
