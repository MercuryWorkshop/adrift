_surf_the_\_web_adrift\_

# Adrift

Adrift is a Decentralized proxy utilizing the WebRTC protocol.

### Before everything..

install dependencies and build bare-client-custom

```
pnpm install
cd bare-client-custom
pnpm install
pnpm build
cd ..
```

### Getting started

Currently, there aren't any middle nodes, only an exit node which is requires nodejs to run.

### Getting started with the server

inside the server/ directory, run `pnpm install`, followed by `pnpm dev`

### Getting started with the client

Inside the frontend/ directory, run `pnpm install` and then `VITE_ADRIFT_DEV=1 VITE_ADRIFT_SINGLEFILE= pnpm dev`

### Quick server setup (linux)

```
git submodule update --init --recursive
pnpm install
cd bare-client-custom
pnpm install
pnpm build
cd ..
cd server/
pnpm install
pnpm dev
```

### Quick client setup (linux)

```
git submodule update --init --recursive
pnpm install
cd bare-client-custom
pnpm install
pnpm build
cd ..
cd frontend/
pnpm install
VITE_ADRIFT_DEV=1 VITE_ADRIFT_SINGLEFILE= pnpm dev
```
