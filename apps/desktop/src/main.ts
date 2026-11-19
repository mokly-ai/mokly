import { readFileSync, writeFileSync } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  MenuItem,
  protocol,
  screen,
  session,
  shell,
} from "electron";
import electronUpdater from "electron-updater";

import { contentSecurityPolicy, readConfiguration } from "./config.js";
import { safeDiagnostic } from "./diagnostics.js";
import { exportHandler, registerScheme } from "./export-handler.js";
import { exchangeObserver } from "./handoff.js";
import { startDesktop } from "./lifecycle.js";
import { installMenu } from "./menu.js";
import { installNavigation } from "./navigation.js";
import { installPermissions } from "./permissions.js";
import { startUpdates, updateMode } from "./updates.js";
import { createWindow } from "./window.js";

const warn = (error: unknown) =>
  console.warn("[desktop]", safeDiagnostic(error));
registerScheme(protocol);
const profile = app.commandLine.getSwitchValue("user-data-dir");
if (profile) app.setPath("userData", profile);
let configuration: ReturnType<typeof readConfiguration>;

startDesktop({
  app,
  platform: process.platform,
  arguments: process.argv,
  warn,
  prepare: ({ started, settled }) => {
    configuration = readConfiguration(
      { read: (path) => readFileSync(path, "utf8"), resolve },
      {
        packaged: app.isPackaged,
        root: app.getAppPath(),
        environment: process.env,
      },
    );
    installPermissions(session.defaultSession);
    protocol.handle(
      "mokly-app",
      exportHandler(
        { resolve, sep, extname, realpath, stat, read: readFile },
        resolve(configuration.directory),
        contentSecurityPolicy(
          configuration.config,
          configuration.catalogueSource,
        ),
      ),
    );
    const exchange = {
      urls: [configuration.config.apiOrigin + "/v1/auth/desktop/callback"],
    };
    session.defaultSession.webRequest.onBeforeRequest(
      exchange,
      (request, callback) => {
        if (request.method === "POST") started(request.id);
        callback({});
      },
    );
    session.defaultSession.webRequest.onCompleted(
      exchange,
      exchangeObserver(settled),
    );
    session.defaultSession.webRequest.onErrorOccurred(
      exchange,
      exchangeObserver(settled),
    );
  },
  createWindow: () => {
    const statePath = resolve(app.getPath("userData"), "window.json");
    return createWindow({
      create: (options) => new BrowserWindow(options),
      readState: () => readFileSync(statePath, "utf8"),
      saveState: (value) => writeFileSync(statePath, value),
      visible: (bounds) =>
        screen
          .getAllDisplays()
          .some(
            ({ workArea }) =>
              bounds.x < workArea.x + workArea.width &&
              bounds.x + bounds.width > workArea.x &&
              bounds.y < workArea.y + workArea.height &&
              bounds.y + bounds.height > workArea.y,
          ),
      warn,
    });
  },
  wireWindow: (active) =>
    installNavigation(active.webContents, configuration.config.appOrigin, {
      openExternal: (url) => shell.openExternal(url),
      load: (url) => active.loadURL(url),
      warn,
    }),
  updates: () =>
    startUpdates(
      {
        updater:
          process.platform === "linux" && !process.env.APPIMAGE
            ? new electronUpdater.DebUpdater()
            : electronUpdater.autoUpdater,
        showDialog: (options) => dialog.showMessageBox(options),
        openExternal: (url) => shell.openExternal(url),
        every: (callback, milliseconds) => {
          const timer = setInterval(callback, milliseconds);
          return () => clearInterval(timer);
        },
        warn,
      },
      updateMode(app.isPackaged, process.platform, process.env.APPIMAGE),
    ),
  menu: (check) =>
    installMenu(
      {
        current: () => Menu.getApplicationMenu(),
        item: (options) => new MenuItem(options),
      },
      check,
    ),
});
