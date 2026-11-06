import { createRecipeImportDeps, type RecipeImportDeps } from '.'

let deps: RecipeImportDeps | undefined

/** Eén gedeelde set (met één verbindingspool) voor de server functions van de app. */
export function recipeImportDeps(): RecipeImportDeps {
  deps ??= createRecipeImportDeps()
  return deps
}
