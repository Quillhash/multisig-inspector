# Multisig Inspector

A local-first, read-only Gnosis Safe multisig auditor.

Transparent, client-side, and usable without trusting a hosted application
backend. This app is not a wallet manager and does not create, sign, queue, or
execute transactions.

## Trust model

- Direct RPC reads through `viem`
- No wallet connection
- No transaction creation, signing, or execution
- Transaction Inspector can optionally send transaction fields to GoPlus for a
  current-state dry run; decoding and hash verification remain local
- Safe Transaction Service is used only to list queued/history transactions when
  importing by Safe address or URL
- No backend database
- Scan snapshots are stored locally in IndexedDB
- Reports export as Markdown and JSON

## What it reads

- Safe owners
- Approval threshold
- Nonce
- Enabled modules
- Guard storage slot
- Fallback handler storage slot
- Singleton/mastercopy storage slot
- Safe version when available

## Local development

Optional GoPlus simulation requires server-only credentials in `.env.local`:

```text
GOPLUS_APP_KEY=your_app_key
GOPLUS_APP_SECRET=your_app_secret
```

These values must also be configured as Vercel environment variables in
production. They are never sent to the browser.

Canonical URLs, the sitemap, Open Graph tags and structured data are built from
`NEXT_PUBLIC_SITE_URL`. Set it to the public URL the app is served from, with no
trailing slash. It defaults to `https://multisiginspector.quillaudits.com`.

```text
NEXT_PUBLIC_SITE_URL=https://multisiginspector.quillaudits.com
```

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run test
npm run type-check
npm run lint
npm run build
```

## License

[MIT](./LICENSE)
