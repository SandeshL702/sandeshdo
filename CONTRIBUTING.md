# Contributing

Keep it small. Keep it useful.

1. Fork → branch → PR against `main`
2. One change per PR (parser, reminder, UI, Sandy)
3. Hinglish parser cases go in `src/lib/parser.test.ts`
4. Don’t add accounts, ads, or analytics

```bash
npm i
npm run typecheck
node --experimental-strip-types --test src/lib/parser.test.ts
```

If you speak Hinglish and a phrase doesn’t parse, open an issue with the exact sentence and the time you expected.
