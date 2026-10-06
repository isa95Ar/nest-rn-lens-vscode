<p align="center">
  <img src="docs/banner.png" alt="NestRN Lens: React Native and NestJS" width="480" />
</p>

# NestRN Lens

**Watch your React Native app talk to your NestJS API, live, inside VS Code.**

NestRN Lens runs your Expo app and your NestJS API from a Turborepo and opens
them side by side in an editor panel: the app in a phone frame on top, and every
API request it makes in a traffic log below. Click a request to jump to the
screen that sent it or to the controller method that answered it.

```
GET /orders/:id   200   12ms   mobile · ios   screens/order-details.tsx:23  →  OrdersController.findOne
```

![The NestRN Lens panel: the app in a phone frame, with live API traffic below](docs/session.png)

## What you get

- **Setup checks** that confirm your monorepo is ready, and fix what's missing
  with one click.
- **The app in a phone frame**, running from the same Metro server your devices
  use, with zoom from 50% to 200%.
- **A live Traffic log**: method, route, status, duration, the calling screen and
  the handler, plus totals for requests, routes, average latency and errors.
- **Jump to code** on both ends of every request.
- **API and Metro logs** in their own tabs, with search.

## Requirements

| Requirement   | Details                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Monorepo      | A Turborepo (`turbo.json`) using npm, yarn or pnpm workspaces                                    |
| API           | A NestJS app (10, 11 or 12) inside the monorepo                                                  |
| App           | An Expo app, SDK 52 or newer, inside the monorepo                                                |
| Web support   | `react-native-web` and `react-dom` in the Expo app (the in-editor preview runs the web build)   |
| Interceptor   | [`@nest-rn-lens/nest`](https://www.npmjs.com/package/@nest-rn-lens/nest) in the API. The setup step installs it for you |

The Turborepo can be your workspace folder or sit up to two folders below it.

## Getting started

1. Open your monorepo in VS Code.
2. Click the **NestRN Lens** icon in the Activity Bar.
3. Wait for the setup checks. Anything that fails has a fix button: click it,
   and the checks run again when it finishes.
4. Click **Launch session**.

The panel starts your API and Metro, then loads the app. Use the app in the
phone frame (or on a device connected to the same Metro) and watch requests
appear in the **Traffic** tab.

## Setup checks

![Setup checks: inspecting the workspace, one-click fixes, ready to launch](docs/setup.png)

| Check                          | Passes when                                                       | Fix button                                      |
| ------------------------------ | ----------------------------------------------------------------- | ----------------------------------------------- |
| Turborepo workspace            | `turbo.json` exists and `turbo` is installed                      | Installs dependencies                           |
| NestJS API and React Native app | A workspace package depends on `@nestjs/core`, another on `react-native` | None: these are your apps                |
| `@nest-rn-lens/nest` in the API | The package is installed **and** registered in the root module   | Installs it and registers it                    |
| Expo SDK                       | Expo SDK 52 or newer is installed                                 | Installs dependencies                           |
| Metro bundler config           | No `metro.config.js`, or one that extends `expo/metro-config`     | None: explains what to change                   |
| Single copy of React           | Only one version of `react` and `react-dom` is installed          | None: explains the `overrides` fix              |
| In-editor preview support      | `react-native-web` and `react-dom` are installed in the app       | Installs the missing ones with `expo install`   |
| App sends the calling screen   | The app sends the `x-nest-rn-lens-*` headers                      | None (warning only)                             |

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
| Toolbar   | Status of Metro and the API, plus Reload app, Open in browser, Restart both, and Stop             |
| Stage     | The app in a phone frame. Zoom with `−` / `+`, click the percentage for 100%, **Fit** to follow the panel size. Pinch or Ctrl/Cmd + scroll works on the background around the phone |
| Traffic   | One row per request, newest first. Filter by route, screen or handler. Click the screen or the handler to open it |
| API, Metro | Raw output of each process, with errors and warnings highlighted                                 |

Drag the bar above the tabs to resize the logs. Closing the panel stops the API
and Metro.

## Showing the calling screen

The interceptor reports **who** made a request from three headers the app sends:

| Header                    | Example                                       |
| ------------------------- | --------------------------------------------- |
| `x-nest-rn-lens-app`      | `mobile`                                      |
| `x-nest-rn-lens-caller`   | `/repo/apps/mobile/src/screens/orders.tsx:23` |
| `x-nest-rn-lens-trace-id` | any id; the API creates one if missing        |

Without them, requests still appear, as `unknown` with the platform guessed
from the user agent. `@nest-rn-lens/react-native`, a `fetch` wrapper that sets
these headers automatically in development, is coming soon. Until then you can
send at least the app name yourself:

```ts
fetch(`${API_URL}/orders`, { headers: { 'x-nest-rn-lens-app': 'mobile' } });
```

## Considerations

- **Development only.** The interceptor is off when `NODE_ENV=production`
  unless you enable it, and the app's headers should only be sent in dev builds.
- **Let NestRN Lens start your servers.** If something already listens on the
  API or Metro port (say `npm run dev` in a terminal), the panel reuses it and
  marks it **External**. It can't read that process's output, so the Traffic and
  log tabs stay empty. Stop it and click **Restart**.
- **Keep debug logs on.** The Traffic tab reads the events the interceptor logs
  at `debug` level. If your app limits Nest's logger (for example
  `logger: ['error', 'warn', 'log']`) or sets `log: false` in
  `NestRnLensModule.forRoot()`, add `debug` back or remove that option.
- **The preview is the web build.** VS Code can't embed an iOS simulator or an
  Android emulator, so the phone frame shows Expo's web build of your app.
  Native-only modules without a web version won't render there; use a device or
  simulator for those screens, and their requests still show up in Traffic.
- **Allow CORS in development.** The web build calls your API from another
  origin with custom headers, so the API needs `app.enableCors()` in dev.
- **The API port must match.** The panel waits for the API on
  `nestRnLens.apiPort` (3000 by default) and passes it as `PORT`. If your
  `main.ts` ignores `PORT`, set the setting to the port it uses.
- **One API and one app.** If the monorepo has several of each, the first of
  each (alphabetically by folder) is used for now.
- **Everything stays local.** Traffic is read from your own processes and never
  leaves your machine.

## Settings

| Setting                 | Default | Description                           |
| ----------------------- | ------- | ------------------------------------- |
| `nestRnLens.apiPort`    | `3000`  | Port the NestJS API listens on.       |
| `nestRnLens.metroPort`  | `8081`  | Port for Metro (the Expo dev server). |

## Commands

| Command                           | What it does                                         |
| --------------------------------- | ---------------------------------------------------- |
| `NestRN Lens: Re-check workspace` | Runs the setup checks again                          |
| `NestRN Lens: Launch session`     | Opens the panel and starts the API and Metro         |
| `NestRN Lens: Stop session`       | Closes the panel and stops both servers              |

## Development

```bash
npm install
npm run watch      # rebuilds on every change
```

Press F5 to open a new VS Code window with the extension loaded.

| Folder            | Runs in               | What it does                                     |
| ----------------- | --------------------- | ------------------------------------------------ |
| `src/validation/` | Extension host (Node) | Setup checks and the root-module edit            |
| `src/session/`    | Extension host (Node) | Starts the API and Metro, parses traffic events  |
| `src/webview/`    | Webviews (browser)    | React UIs for the sidebar and the panel          |
| `src/shared/`     | Both                  | Message types between the host and the webviews  |
| `media/`          | Webviews              | Styles and icons                                 |

## License

MIT

NestRN Lens is an independent project, not affiliated with or endorsed by
NestJS, Meta (React, React Native), Expo or Vercel (Turborepo). Their names and
logos are trademarks of their respective owners.
