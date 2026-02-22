FROM node:22-alpine

WORKDIR /app

COPY dist ./dist
COPY package*.json ./
COPY node_modules ./node_modules

EXPOSE 8080
CMD ["node", "dist/index.js"]