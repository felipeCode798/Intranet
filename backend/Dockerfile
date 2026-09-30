# API NestJS + Prisma
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=3100 UPLOAD_DIR=uploads
# Se conservan las dependencias de desarrollo (prisma CLI y ts-node) para poder
# ejecutar migraciones y, si hace falta, el seed desde la terminal del contenedor
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json tsconfig.json ./
COPY prisma ./prisma
RUN mkdir -p uploads
EXPOSE 3100
# Aplica las migraciones pendientes en cada arranque y luego inicia el API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
