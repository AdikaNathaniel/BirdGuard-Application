#!/bin/bash
# Starts Tailscale (so the app can reach the Pi over the private tailnet)
# and the single consolidated BirdGuard app process. If that process dies,
# this exits so Fly restarts the whole machine rather than silently running
# in a half-broken state.
set -e

STATE_FILE=/var/lib/tailscale/tailscaled.state

mkdir -p /var/lib/tailscale /var/run/tailscale

tailscaled --state="$STATE_FILE" --socket=/var/run/tailscale/tailscaled.sock &

for i in $(seq 1 20); do
  [ -S /var/run/tailscale/tailscaled.sock ] && break
  sleep 0.5
done

# `tailscale up` refuses partial flag changes on an already-configured
# node ("requires mentioning all non-default flags"), so --hostname and
# --accept-routes must be passed every time, identically. --authkey is
# only needed (and only valid) on the very first run, before the
# persistent volume has a state file.
if [ -s "$STATE_FILE" ]; then
  AUTHKEY_ARG=""
else
  AUTHKEY_ARG="--authkey=${TAILSCALE_AUTHKEY}"
fi

tailscale --socket=/var/run/tailscale/tailscaled.sock up \
  $AUTHKEY_ARG \
  --hostname=birdguard-backend \
  --accept-routes

node /app/app/dist/main.js
