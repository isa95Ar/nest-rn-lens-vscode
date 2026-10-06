<p align="center">
  <img src="docs/banner.png" alt="NestRN Lens: React Native and NestJS" width="480" />
</p>

# NestRN Lens

**Watch your React Native or Next.js app talk to your NestJS API, live, inside VS Code.**

NestRN Lens runs your app and your NestJS API from a Turborepo and opens them
side by side in an editor panel: the app on top (in a phone frame for React
Native, in a browser window for Next.js) and every API request it makes in a
traffic log below. Click a request to jump to the code that sent it or to the
controller method that answered it.

```
GET /orders/:id   200   12ms   mobile · ios   screens/order-details.tsx:23  →  OrdersController.findOne
GET /orders       200    8ms   web · web      /orders                       →  OrdersController.findAll
```

![The NestRN Lens panel: the app in a phone frame, with live API traffic below](docs/session.png)

## What you get

- **Setup checks** that confirm your monorepo is ready, and fix what's missing
  with one click.
- **Your app inside VS Code**: an Expo app in a phone frame, running from the
  same Metro server your devices use, or a Next.js app in a browser window with
  Desktop, Tablet and Mobile widths. Zoom from 50% to 200%.
- **A live Traffic log**: method, route, status, duration, the calling screen or
  page and the handler, plus totals for requests, routes, average latency and
  errors.
- **Jump to code** on both ends of every request.
- **Server logs** for the API and for Metro or Next.js, in their own tabs, with
  search.

## Requirements

| Requirement   | Details                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Monorepo      | A Turborepo (`turbo.json`) using npm, yarn or pnpm workspaces                                    |
| API           | A NestJS app (10, 11 or 12) inside the monorepo                                                  |
| App           | An Expo app (SDK 52 or newer) **or** a Next.js app (13 or newer) inside the monorepo. If you have both, you choose which one to track |
| Interceptor   | [`@nest-rn-lens/nest`](https://www.npmjs.com/package/@nest-rn-lens/nest) in the API. The setup step installs it for you |

For Expo apps, the in-editor preview runs the app's web build, so the app also
needs `react-native-web` and `react-dom`. The setup step installs them too.

The Turborepo can be your workspace folder or sit up to two folders below it.

## Getting started

1. Open your monorepo in VS Code.
2. Click the **NestRN Lens** icon in the Activity Bar.
3. If the monorepo has both a React Native and a Next.js app, pick one under
   **Track**. The choice is remembered for this workspace.
4. Wait for the setup checks. Anything that fails has a fix button: click it,
   and the checks run again when it finishes.
5. Click **Launch session**.

The panel starts your API and the app's dev server (Metro or `next dev`), then
loads the app. Use it in the panel, or on a device or browser of your own, and
watch requests appear in the **Traffic** tab.

## Setup checks

![Setup checks: inspecting the workspace, one-click fixes, ready to launch](docs/setup.png)

These run for every app:

| Check                               | Passes when                                                      | Fix button                     |
| ----------------------------------- | ---------------------------------------------------------------- | ------------------------------ |
| Turborepo workspace                 | `turbo.json` exists and `turbo` is installed                     | Installs dependencies          |
| NestJS API and a client app         | A workspace depends on `@nestjs/core`, another on `react-native` or `next` | None: these are your apps |
| `@nest-rn-lens/nest` in the API     | The package is installed **and** registered in the root module   | Installs it and registers it   |
| API accepts browser requests (CORS) | The API's `main.ts` enables CORS                                 | None (warning only)            |

Then, for a **React Native** app:

| Check                        | Passes when                                                   | Fix button                                    |
| ---------------------------- | ------------------------------------------------------------- | --------------------------------------------- |
| Expo SDK                     | Expo SDK 52 or newer is installed                             | Installs dependencies                         |
| Metro bundler config         | No `metro.config.js`, or one that extends `expo/metro-config` | None: explains what to change                 |
| Single copy of React         | Only one version of `react` and `react-dom` is installed      | None: explains the `overrides` fix            |
| In-editor preview support    | `react-native-web` and `react-dom` are installed in the app   | Installs the missing ones with `expo install` |
| App sends the calling screen | The app sends the `x-nest-rn-lens-*` headers                  | None (warning only)                           |

Or, for a **Next.js** app:

| Check                      | Passes when                                                      | Fix button            |
| -------------------------- | ---------------------------------------------------------------- | --------------------- |
| Next.js version            | Next.js 13 or newer is installed                                 | Installs dependencies |
| Next.js dev server port    | The app has a `dev` script, and its port doesn't clash with the API's | None: explains what to change |
| App sends the calling page | The app sends the `x-nest-rn-lens-*` headers                     | None (warning only)   |

Every fix that runs a command does it in a visible VS Code terminal, so you can
see exactly what happens.

### What "Install and register" does

It makes two changes to your API, then opens the root module so you can review
them:

1. Runs `npm install @nest-rn-lens/nest` (or `yarn add`, `pnpm add`) in the API
   folder.
2. Adds the module to your root module, the one passed to
   `NestFactory.create()` in `src/main.ts`:

```diff
  import { Module } from '@nestjs/common';
  import { OrdersModule } from './orders/orders.module';
+ import { NestRnLensModule } from '@nest-rn-lens/nest';

  @Module({
-   imports: [OrdersModule],
+   imports: [NestRnLensModule.forRoot({ app: 'api' }), OrdersModule],
  })
  export class AppModule {}
```

`app` is the API's folder name and labels it in the traffic log. If the root
module has an unusual shape, nothing is changed and the check tells you what to
add by hand. To set it up yourself instead, see the
[`@nest-rn-lens/nest` README](https://www.npmjs.com/package/@nest-rn-lens/nest).

## The session panel

| Area      | What it does                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------- |
| Toolbar   | Status of the app's dev server and the API, plus Reload app, Open in browser, Restart both, and Stop |
| Stage     | The app, in a phone frame (React Native) or a browser window (Next.js). Zoom with `−` / `+`, click the percentage for 100%, **Fit** to follow the panel size. Pinch or Ctrl/Cmd + scroll works on the background around the app |
| Traffic   | One row per request, newest first. Filter by route, screen or handler. Click a screen or a handler to open it |
| Log tabs  | Raw output of the API and of Metro or Next.js, with errors and warnings highlighted              |

Drag the bar above the tabs to resize the logs. Closing the panel stops both
servers.

### Next.js apps

![A Next.js app in the browser window, with live API traffic below](docs/session-next.png)

- The browser window has **Home**, **Reload** and an address field: type a path
  such as `/orders/42` and press Enter to open it.
- **Desktop**, **Tablet** and **Mobile** (next to the zoom controls) set the
  page width to 1280, 820 or 390 pixels.
- The address field doesn't follow links you click inside the page. Browsers
  don't let one site read where another site's page has navigated.
- If your app sends `X-Frame-Options` or a CSP `frame-ancestors` header, it
  can't be shown inside the panel. The panel says so and offers **Open in
  browser**; its requests still show up in Traffic.

## Showing who made each request

The interceptor reports **who** made a request from three headers the app sends:

| Header                    | React Native example                          | Next.js example |
| ------------------------- | --------------------------------------------- | --------------- |
| `x-nest-rn-lens-app`      | `mobile`                                      | `web`           |
| `x-nest-rn-lens-caller`   | `/repo/apps/mobile/src/screens/orders.tsx:23` | `/orders/42`    |
| `x-nest-rn-lens-trace-id` | any id; the API creates one if missing        | same            |

Without them, requests still appear, as `unknown` with the platform guessed
from the user agent. A client package that sets these headers automatically in
development is coming soon. Until then, add them where your app calls the API.

In a React Native app, send at least the app name:

```ts
fetch(`${API_URL}/orders`, { headers: { 'x-nest-rn-lens-app': 'mobile' } });
```

In a Next.js app, the caller is the page the request came from, which the
browser already knows:

```ts
const headers: Record<string, string> = {};
if (process.env.NODE_ENV !== 'production') {
  headers['x-nest-rn-lens-app'] = 'web';
  if (typeof window !== 'undefined') {
    headers['x-nest-rn-lens-caller'] = window.location.pathname;
  }
}
fetch(`${API_URL}/orders`, { headers });
```

In the Traffic tab, a file caller opens in the editor when you click it; a page
caller is shown as the page path.

## Considerations

- **Development only.** The interceptor is off when `NODE_ENV=production`
  unless you enable it, and the app's headers should only be sent in dev builds.
- **Let NestRN Lens start your servers.** If something already listens on the
  API's or the app's port (say `npm run dev` in a terminal), the panel reuses it
  and marks it **External**. It can't read that process's output, so the Traffic
  and log tabs stay empty. Stop it and click **Restart**.
- **Keep debug logs on.** The Traffic tab reads the events the interceptor logs
  at `debug` level. If your app limits Nest's logger (for example
  `logger: ['error', 'warn', 'log']`) or sets `log: false` in
  `NestRnLensModule.forRoot()`, add `debug` back or remove that option.
- **Allow CORS in development.** A Next.js app, and the web build of an Expo
  app, call your API from another origin with custom headers, so the API needs
  `app.enableCors()` in dev. The CORS check warns when it's missing.
- **Ports.** The API runs on `nestRnLens.apiPort` (3000), Metro on
  `nestRnLens.metroPort` (8081), and Next.js on `nestRnLens.webPort` (3001,
  passed as `PORT`) unless its `dev` script sets `-p` itself. Next.js and NestJS
  both default to 3000, which is why Next.js is moved. If your API's `main.ts`
  ignores `PORT`, set `nestRnLens.apiPort` to the port it uses.
- **The React Native preview is the web build.** VS Code can't embed an iOS
  simulator or an Android emulator, so the phone frame shows Expo's web build of
  your app. Native-only modules without a web version won't render there; use a
  device or simulator for those screens, and their requests still show up in
  Traffic.
- **Next.js server-side requests.** Requests from Server Components, route
  handlers or server actions come from Node, not the browser. They show up with
  the app name you send, but there's no page to report as the caller.
- **One API and one app per type.** If the monorepo has several APIs, or several
  apps of the same type, the first one (alphabetically by folder) is used for now.
- **Everything stays local.** Traffic is read from your own processes and never
  leaves your machine.

## Settings

| Setting                 | Default | Description                                                         |
| ----------------------- | ------- | ------------------------------------------------------------------- |
| `nestRnLens.apiPort`    | `3000`  | Port the NestJS API listens on.                                     |
| `nestRnLens.metroPort`  | `8081`  | Port for Metro (the Expo dev server).                               |
| `nestRnLens.webPort`    | `3001`  | Port for the Next.js dev server, unless its `dev` script sets one.  |

## Commands

| Command                           | What it does                                           |
| --------------------------------- | ------------------------------------------------------ |
| `NestRN Lens: Re-check workspace` | Runs the setup checks again                            |
| `NestRN Lens: Launch session`     | Opens the panel and starts the API and the app         |
| `NestRN Lens: Stop session`       | Closes the panel and stops both servers                |

## Development

```bash
npm install
npm run watch      # rebuilds on every change
```

Press F5 to open a new VS Code window with the extension loaded.

| Folder            | Runs in               | What it does                                               |
| ----------------- | --------------------- | ---------------------------------------------------------- |
| `src/validation/` | Extension host (Node) | Setup checks and the root-module edit                      |
| `src/session/`    | Extension host (Node) | Starts the API and Metro or Next.js, parses traffic events |
| `src/webview/`    | Webviews (browser)    | React UIs for the sidebar and the panel                    |
| `src/shared/`     | Both                  | Message types between the host and the webviews            |
| `media/`          | Webviews              | Styles and icons                                           |

## License

MIT

NestRN Lens is an independent project, not affiliated with or endorsed by
NestJS, Meta (React, React Native), Expo or Vercel (Turborepo, Next.js). Their
names and logos are trademarks of their respective owners.
