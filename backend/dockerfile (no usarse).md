FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "start:dev"]




compose.yaml

version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: denuncias-db
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
      POSTGRES_DB: ${DB_NAME:-denuncias_db}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: denuncias-api
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://${DB_USER:-postgres}:${DB_PASSWORD:-postgres}@postgres:5432/${DB_NAME:-denuncias_db}
      JWT_SECRET: ${JWT_SECRET:-dev_secret_change_me}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN:-1h}
      PORT: 3000
      NODE_ENV: development
      CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:5173}
    volumes:
      - ./backend:/app
      - /app/node_modules
    depends_on:
      postgres:
        condition: service_healthy
    command: sh -c "npx prisma migrate dev && npm run start:dev"

volumes:
  postgres_data: