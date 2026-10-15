# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS deps

WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM node:22-alpine AS build

WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG VITE_APP_ENV=PROD
ENV VITE_APP_ENV=$VITE_APP_ENV
RUN pnpm run build

FROM caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile
COPY docker-entrypoint.sh /usr/bin/docker-entrypoint.sh
COPY --from=build /app/dist /srv

EXPOSE 80

ENTRYPOINT ["/usr/bin/docker-entrypoint.sh"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
