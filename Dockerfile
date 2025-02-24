FROM node:18 AS builder

WORKDIR /app

COPY package.json package-lock.json ./ 
RUN npm install

COPY . .

RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm install --omit=dev

COPY --from=builder /app/.next /app/.next
COPY --from=builder /app/public /app/public
COPY --from=builder /app/node_modules /app/node_modules

ENV NODE_ENV=dev

EXPOSE 3000

CMD npm run start
