import { createFileRoute } from '@tanstack/react-router'
import { imageResponse } from '~/server/images'
import { auth, db } from '~/server/runtime'

export const Route = createFileRoute('/afbeeldingen/$imageId')({
  server: {
    handlers: {
      GET: ({ request, params }) => imageResponse(request, params.imageId, { db: db(), auth: auth() }),
    },
  },
})
