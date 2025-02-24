FROM node:18

ARG NOVE_ENV=production
ENV NODE_ENV=$NODE_ENV

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

RUN npm run build

CMD ["npm", "run", "start"]

