FROM node:18-alpine as build

WORKDIR /build

COPY ["./*", "/build"]

RUN cd server && node esbuild.bundle.js

FROM node:18-alpine as runtime

WORKDIR /app

ENV ADRIFT_IS_DOCKER true

COPY --from=build ["/build/server/*", "/app"]

ENTRYPOINT [ "node", "dist/main.js", "--start"]