# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
# De server-bundle in .output is zelfstandig; de opstartscripts gebruiken pg, drizzle-orm en zod.
RUN node -e "const p=require('./package.json');require('fs').writeFileSync('/runtime-package.json',JSON.stringify({name:'gerechter-runtime',private:true,type:'module',dependencies:{pg:p.dependencies.pg,'drizzle-orm':p.dependencies['drizzle-orm'],zod:p.dependencies.zod}}))"

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000
COPY --from=build /runtime-package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/.output ./.output
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/drizzle ./drizzle
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1
CMD ["node", "scripts/start.mjs"]
