########
# BASE
########
FROM node:24-alpine AS base

WORKDIR /usr/app

########
# BUILD
########
FROM base AS build

# Copy all jsons
COPY package*.json tsconfig.json ./

# Add dev deps
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copy source code
COPY src src

RUN npm run build

########
# DEPLOY
########
FROM base AS deploy

RUN --mount=type=cache,target=/var/cache/apk \
    apk add --update-cache \
    jq \
    supercronic \
    tini \
    tzdata

COPY entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# backwards compat entrypoint
RUN ln -s /usr/local/bin/docker-entrypoint.sh / 

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# Steal compiled code from build image
COPY --from=build /usr/app/dist dist

USER node
ENV NODE_ENV=production CONFIG_DIR=/config DEMOS_DIR=/demos

VOLUME [ "/config" ]
VOLUME [ "/demos" ]

ENTRYPOINT ["tini", "--", "docker-entrypoint.sh"]