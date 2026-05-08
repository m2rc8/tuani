FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN npm install --legacy-peer-deps

RUN npm --workspace packages/api exec prisma generate

RUN npm run build:api

EXPOSE 3000

CMD ["npm", "run", "start"]
