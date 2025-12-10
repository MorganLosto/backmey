const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

const cliPath = app.isPackaged
  ? path.join(process.resourcesPath, "backmey.py")
  : path.join(__dirname, "..", "backmey.py");
const pythonCmd = process.env.BACKMEY_PYTHON || "python3";
const storeDir = process.env.BACKMEY_STORE_DIR || "";
const templateDir = process.env.BACKMEY_TEMPLATE_DIR || "";

function logDebug(...args) {
  const ts = new Date().toISOString();
  // eslint-disable-next-line no-console
  console.log(`[backmey-main ${ts}]`, ...args);
}

function runCli(args, timeoutMs = 8000, customEnv = {}, sender = null) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let finished = false;

    const proc = spawn(pythonCmd, [cliPath, ...args], {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, ...customEnv, PYTHONUNBUFFERED: "1" },
    });
    logDebug("spawn", pythonCmd, cliPath, args.join(" "));
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      proc.kill("SIGKILL");
      const result = { code: 124, stdout, stderr: (stderr || "") + " timeout" };
      logDebug("timeout", result);
      resolve(result);
    }, timeoutMs);

    proc.stdout.on("data", (data) => {
      const chunk = data.toString();
      stdout += chunk;
      if (sender) sender.send("cli-progress", chunk);
    });
    proc.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderr += chunk;
      if (sender) sender.send("cli-progress", chunk);
    });
    proc.on("close", (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const result = { code, stdout, stderr };
      logDebug("exit", code, stdout.trim(), stderr.trim());
      resolve(result);
    });
    proc.on("error", (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const result = { code: 127, stdout, stderr: String(err) };
      logDebug("error", result);
      resolve(result);
    });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    icon: path.join(__dirname, "logo.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

ipcMain.handle("detect", async () => {
  logDebug("ipc detect start");
  try {
    const result = await runCli(["detect"], 4000);
    logDebug("ipc detect result", result);
    if (result.code === 0) return result;
  } catch (e) {
    logDebug("CLI detect exception", e);
  }

  // Fallback detection
  const desktop = process.env.XDG_CURRENT_DESKTOP || process.env.DESKTOP_SESSION || "unknown";
  const display = process.env.XDG_SESSION_TYPE || "unknown";
  const fallback = {
    code: 0,
    stdout: JSON.stringify({
      desktop,
      display_server: display,
      session: (desktop || "").toLowerCase(),
      source: "fallback",
    }),
    stderr: "CLI failed or timed out. Used internal fallback.",
  };
  logDebug("ipc detect fallback", fallback);
  return fallback;
});

ipcMain.handle("list", async (_event, payload) => {
  const args = ["list", "--templates"];
  if (payload && payload.json) args.push("--json");
  if (payload && payload.store_dir) args.push("--store-dir", payload.store_dir);
  if (payload && payload.template_dir) args.push("--template-dir", payload.template_dir);
  return runCli(args);
});

ipcMain.handle("backup", async (event, payload) => {
  const args = ["backup"];
  const env = {};

  if (payload.profile) args.push("--profile", payload.profile);
  if (payload.version) args.push("--version", payload.version);
  if (payload.output) args.push("--output", payload.output);
  if (payload.sync_command) args.push("--sync-command", payload.sync_command);
  if (payload.skip_dconf) args.push("--skip-dconf");
  if (payload.notes) args.push("--notes", payload.notes);
  if (payload.with_browser_profiles) args.push("--with-browser-profiles");
  if (payload.no_packages) args.push("--no-packages");
  if (payload.report_sizes) args.push("--report-sizes");
  if (payload.dry_run) args.push("--dry-run");

  if (payload.components && payload.components.length > 0) {
    args.push("--components", payload.components.join(","));
  }

  // Encryption
  if (payload.encrypt) {
    args.push("--encrypt");
    if (payload.passphrase) {
      env.BACKMEY_PASSPHRASE = payload.passphrase;
    }
  }

  if (payload.smart_exclude) {
    args.push("--smart-exclude");
  }

  if (payload.custom_excludes && typeof payload.custom_excludes === "string") {
    const parts = payload.custom_excludes.split(",").map(s => s.trim()).filter(s => s.length > 0);
    parts.forEach(p => args.push(`--exclude=${p}`));
  }

  if (payload.custom_includes && Array.isArray(payload.custom_includes)) {
    payload.custom_includes.forEach(p => args.push(`--include=${p}`));
  }

  // Pass event.sender to allow streaming progress
  return runCli(args, 600000, env, event.sender);
});

ipcMain.handle("restore", async (event, payload) => {
  const args = ["restore"];
  const env = {};

  if (payload.archive) args.push("--archive", payload.archive);
  if (payload.profile) args.push("--profile", payload.profile);
  if (payload.version) args.push("--version", payload.version);
  if (payload.store_dir) args.push("--store-dir", payload.store_dir);
  if (payload.template) args.push("--template", payload.template);
  if (payload.template_dir) args.push("--template-dir", payload.template_dir);
  if (payload.components && payload.components.length > 0) {
    args.push("--components", payload.components.join(","));
  }
  if (payload.yes) args.push("--yes");
  if (payload.skip_conflicts) args.push("--skip-conflicts");
  if (payload.dry_run) args.push("--dry-run");
  if (payload.no_snapshot) args.push("--no-snapshot");
  if (payload.install_packages) args.push("--install-packages");
  if (payload.install_managers && payload.install_managers.length > 0) {
    args.push("--install-managers", payload.install_managers.join(","));
  }
  if (payload.install_dry_run) args.push("--install-dry-run");

  // Decryption
  if (payload.passphrase) {
    env.BACKMEY_PASSPHRASE = payload.passphrase;
  }

  return runCli(args, 600000, env, event.sender);
});

ipcMain.handle("inspect", async (event, payload) => {
  const args = ["inspect"];
  const env = {};
  if (payload.archive) args.push("--archive", payload.archive);
  if (payload.profile) args.push("--profile", payload.profile);
  if (payload.version) args.push("--version", payload.version);
  if (payload.store_dir) args.push("--store-dir", payload.store_dir);

  if (payload.passphrase) {
    env.BACKMEY_PASSPHRASE = payload.passphrase;
  }
  return runCli(args, 30000, env);
});

ipcMain.handle("select-directory", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "multiSelections"],
  });
  return result.filePaths; // Returns array of strings
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
