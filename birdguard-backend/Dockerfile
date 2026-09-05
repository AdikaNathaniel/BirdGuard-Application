# Builds and runs the BirdGuard backend as ONE consolidated NestJS process
# (auth, device/SSH, detections all in one app -- see app/src/app.module.ts)
# plus a Tailscale sidecar so it can reach the Pi over the private tailnet.
#
# This replaced a four-process split (api-gateway + auth-service +
# device-service + detection-service, each its own Node runtime) that OOM-
# killed the small Fly machine this runs on: each separate Node process
# carries its own baseline V8/runtime memory overhead regardless of how
# little work it's doing, and four of those plus tailscaled didn't fit in
# 256MB. The machine only ever had 1 shared vCPU anyway, so those four
# processes were never running in true parallel across cores -- merging
# them into one process costs no real concurrency, only removes the
# duplicated per-process overhead.

# --- Build stage: install deps (incl. devDeps) and compile ---
FROM node:20-alpine AS build

WORKDIR /app

COPY app/package*.json ./app/
RUN cd app && npm ci

COPY app ./app
RUN cd app && npm run build && npm prune --omit=dev

# --- Runtime stage: only compiled output + production node_modules ---
FROM node:20-alpine AS runtime

# Tailscale runs as a sidecar so the app can reach the Pi over a private
# mesh network instead of needing a public route to its LAN IP.
RUN apk add --no-cache bash tailscale iptables ip6tables

WORKDIR /app

COPY --from=build /app/app/node_modules ./app/node_modules
COPY --from=build /app/app/dist ./app/dist
COPY --from=build /app/app/package.json ./app/package.json

COPY start.sh ./start.sh
RUN chmod +x ./start.sh

ENV HTTP_PORT=3000

EXPOSE 3000

CMD ["./start.sh"]
