FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .

CMD ["npm", "start", "--", "--host", "0.0.0.0"]
