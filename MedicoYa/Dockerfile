FROM node:20-alpine

WORKDIR /app

COPY . .

RUN npm install --legacy-peer-deps

RUN npm --workspace packages/api exec prisma generate

RUN npm run build:api

EXPOSE 3000

CMD ["sh", "-c", "npm --workspace packages/api exec prisma migrate deploy && npm run start"]
