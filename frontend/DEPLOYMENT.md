# TicketTreat Frontend deployment recovery

The Railway **Frontend** service builds from `/frontend` on the
`release/tickettreat-production` branch. Its watch pattern is `/frontend/**`.

## BuildKit worker connection failure

A Railway build can fail before installing dependencies or running `npm run build`:

```text
failed to list workers: Unavailable: connection error:
error reading server preface: raw-read unix @->/run/buildkit/buildkitd.sock:
use of closed network connection
```

This indicates that Railway's remote BuildKit daemon was unavailable during
image creation. It is not, by itself, evidence of a Next.js compilation
problem or an application dependency issue.

1. Confirm that the last successful Frontend deployment remains live.
2. Check GitHub Actions' TypeScript production build, Python tests, and
   browser E2E jobs for the target commit.
3. Trigger a **fresh build** after the Railway builder becomes available.
   A failed deployment without a completed image cannot be redeployed from
   an existing image. A normal push touching `/frontend/**` will trigger a
   new build without changing service settings.
4. Monitor the new Railway deployment until it reaches `SUCCESS`, and
   confirm that the healthy Frontend replica serves the expected version.
5. If the same BuildKit socket error continues, check Railway's status
   and contact Railway support with the failed deployment IDs. Do not
   change database settings, auth secrets, or production application code
   to work around a remote builder outage.

Do not reattach the GitHub source or overwrite the working deployment
just to retry this error. Existing successful deployments should remain
available until a replacement has passed its health check.
