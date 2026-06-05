# syntax=docker/dockerfile:1

# ---- build stage: compile TypeScript -> dist/ ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime stage ----
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production

# LibreOffice powers DOC/DOCX -> PDF via the libreoffice-convert package.
# Writer pulls in libreoffice-core (provides the `soffice` binary); fonts give
# reasonable text rendering in the generated PDFs.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libreoffice-writer \
      fonts-liberation \
      fonts-dejavu \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

# Cloud Run's filesystem is read-only except /tmp; soffice needs a writable HOME
# for its user profile, so point HOME at the writable tmpfs.
ENV HOME=/tmp

# Cloud Run injects PORT (default 8080); index.ts reads process.env.PORT.
EXPOSE 8080
CMD ["node", "dist/index.js"]
