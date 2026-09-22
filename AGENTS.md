# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Expo tunnel troubleshooting (learned 2026-09-21)
- If `expo start --tunnel` fails with `TypeError: Cannot read properties of undefined (reading 'body')`, it's the ngrok agent failing to start — retry, it was transient (worked on next attempt).
- ERR_NGROK_316 for `*.ngrok.app` names only happens on manual `ngrok http` runs (ngrok 2.x agent tries to bind the shared account's reserved domain). It does NOT affect the Expo CLI path, which requests `{random}-{user}-{port}.exp.direct` — verify with: `ngrok http 8081 --hostname=<test>.exp.direct --config ~/.expo/ngrok.yml`.
- `EXPO_UNSTABLE_TUNNEL_V2=1` does NOT work in this environment: the ws-tunnel TLS handshake fails through the egress proxy (`write EPROTO ... wrong version number`). Use the ngrok path.
- Never put EXPO_TOKEN in the command string — always via the exec `env` parameter (a command string with `env EXPO_TOKEN=...` gets echoed in background completion notifications).
