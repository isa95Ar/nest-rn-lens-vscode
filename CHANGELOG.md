# Changelog

## 0.2.0

- Next.js support: track a Next.js app instead of a React Native one. The app
  runs with `next dev` (on port 3001 by default, so it doesn't clash with the
  API) inside a browser window with Desktop, Tablet and Mobile widths.
- When the monorepo has both a React Native and a Next.js app, choose which one
  to track from the sidebar. The choice is remembered per workspace.
- New setup checks: CORS in the API, the Next.js version and the dev server port.
- The "calling screen" check now finds the NestRN Lens headers anywhere in the
  app's source, not just in known file names.
- Traffic shows page paths (`/orders/42`) as the caller for web apps.
- Apps that refuse to be framed (X-Frame-Options or CSP) get an "Open in
  browser" card instead of a blank preview.
- New setting: `nestRnLens.webPort`.

## 0.1.0

First release.

- Setup checks for Turborepo, a NestJS API and an Expo app, with one-click fixes.
- Installs `@nest-rn-lens/nest` and registers it in the API's root module.
- Session panel: the app's web build in a phone frame, with zoom.
- Live Traffic log with the calling screen and the handler, and jump to code on both.
- API and Metro log tabs with search.
