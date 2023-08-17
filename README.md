_surf_the_web_adrift_fix_ --------- "ce why do you keep making stupid proxies with zero use case"

# Adrift

Adrift is a fast and modern decentralized web proxy network, utilizing transport over WebRTC.

Clients will invisibly connect to one of several tracking servers to exchange an "offer". From there, it uses NAT traversal to link up with a random exit node also running adrift, without the need to port forward. This lightens the load on individial server hosters and makes the network difficult to effectively block. [more information](https://coolelectronics.me/blog/surf-the-web-adrift)

See a functional demo [here](https://adrift-6c1f6.web.app/)

### Before everything..

install dependencies and build bare-client-custom

```
pnpm install
cd bare-client-custom
pnpm install
pnpm build
cd ..
```

### Getting started with the server

inside the server/ directory, run `pnpm install`, followed by `pnpm start`

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

# To host a tracker...

As of now, the project relies on at least one central tracking server to keep offers forwarded smoothly. If you have the infrastructure to keep a tracker of your own running 24/7 and want to host one yourself, here's how to.

Create a new firebase project. Enable authentication and a realtime DB. Set these rules in the realtime DB

```
{
  "rules": {
    "peers":{
    	"$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "swarm": {
      "$id": {
        ".read": true,
        ".write":true,
      }
    }
  }
}
```

Next, create a service account with all permissions. Download the authentication file and save it to `tracker/src/admin-creds.json`
cd into `tracker/`, `pnpm start`, and make sure to choose a port with the `PORT` environment variable that's accessible from the internet.

Open `tracker-list/index.ts`, and add a new entry. Name your entry accordingly, copying in the client-side firebase tokens for the `firebase` field, and putting the domain where your tracker is available in the `tracker` field. After testing, submit a PR and if we trust you, it will be merged and your tracker will show as an option.
