FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN mkdir -p uploads/photos

EXPOSE 4000

CMD ["node", "server.js"]
