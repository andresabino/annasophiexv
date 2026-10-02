FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321

COPY package.json package-lock.json ./

RUN npm ci --omit=dev \
    && npm cache clean --force

# Necessário para migrations e scripts administrativos TypeScript
COPY --from=build /app/node_modules/tsx ./node_modules/tsx
COPY --from=build /app/node_modules/.bin/tsx ./node_modules/.bin/tsx

# Aplicação compilada
COPY --from=build /app/dist ./dist

# Runtime administrativo / migrations
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/db ./db
COPY --from=build /app/src/lib ./src/lib

EXPOSE 4321

CMD ["node", "dist/server/entry.mjs"]
