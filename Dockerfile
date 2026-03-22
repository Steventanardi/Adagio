FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# This exposes the port Adagio uses so others can see it
EXPOSE 3000
CMD ["node", "server.js"]
