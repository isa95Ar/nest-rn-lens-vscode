# Changelog

## 0.4.0

- Setup guide: a **?** icon in the sidebar (and a **Setup guide** link under the
  checks) opens step-by-step instructions for your app, with the steps your
  project already passes marked, the fix buttons, and code to copy.
- New fix: **Enable CORS** adds a development-only `app.enableCors()` to the
  API's `main.ts`.
- New fix: **Add NestRN Lens client** adds a small file that tags every request
  to your API, for Next.js (app name and page) and React Native (app name),
  without changing your `fetch` calls.
- The Traffic tab's empty state links to the setup guide.

## 0.3.0

- Request and response details: click a request in Traffic to see its response
  body, request body, query, route params and headers (needs
  `@nest-rn-lens/nest` 0.2.0, which redacts secrets). The setup check offers an
  **Update** button for older versions.
- README: a short step-by-step guide to integrate a React Native or Next.js app.

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
