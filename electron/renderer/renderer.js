const components = [
  "configs", "data", "bin", "systemd",
  "shells", "terminal", "wm",
  "themes", "icons", "fonts", "wallpapers",
  "browsers", "flatpak", "snap",
  "custom"
];

const categories = {
  "System & Core": ["configs", "data", "bin", "systemd"],
  "Environment": ["shells", "terminal", "wm"],
  "Appearance": ["themes", "icons", "fonts", "wallpapers"],
  "Applications": ["browsers", "flatpak", "snap"],
  "User Defined": ["custom"]
};

const logBox = document.getElementById("log");
const backupsLog = document.getElementById("backups-log");
const detectOutput = document.getElementById("detect-output");
const latestStatus = document.getElementById("latest-status");
const defaultComponents = components.filter((c) => !["browsers", "containers", "flatpak", "snap"].includes(c));
let detectTimer = null;
let customIncludes = []; // Stores absolute paths

function log(message) {
  const timestamp = new Date().toLocaleTimeString();
  let formattedMessage = message;

  // Try to parse JSON and pretty print
  try {
    if (typeof message === 'string' && (message.trim().startsWith('{') || message.trim().startsWith('['))) {
      const parsed = JSON.parse(message);
      formattedMessage = JSON.stringify(parsed, null, 2);
    }
  } catch (e) {
    // Not JSON, keep as is
  }

  const entry = document.createElement('div');
  entry.style.marginBottom = '12px';
  entry.style.borderBottom = '1px solid #374151';
  entry.style.paddingBottom = '12px';

  const timeSpan = document.createElement('span');
  timeSpan.style.color = '#9ca3af';
  timeSpan.style.fontSize = '12px';
  timeSpan.textContent = `[${timestamp}]`;

  const contentPre = document.createElement('pre');
  contentPre.style.margin = '4px 0 0';
  contentPre.style.whiteSpace = 'pre-wrap';
  contentPre.textContent = formattedMessage;

  entry.appendChild(timeSpan);
  entry.appendChild(contentPre);

  logBox.appendChild(entry);
  logBox.scrollTop = logBox.scrollHeight;
  const statusEl = document.getElementById("status-text");
  if (statusEl) {
    statusEl.textContent = typeof message === 'string' && message.length < 50 ? message : "Check log for details";
  }
}

// Helper to get components by category
function getComponentsByCategory(exclude = []) {
  const result = {};
  for (const [cat, comps] of Object.entries(categories)) {
    result[cat] = comps.filter(c => components.includes(c) && !exclude.includes(c));
  }
  return result;
}

function renderComponents(containerId, exclude = []) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  const grouped = getComponentsByCategory(exclude);

  // Render each category
  for (const [cat, comps] of Object.entries(grouped)) {
    if (comps.length === 0) continue;

    const group = document.createElement("div");
    group.className = "component-group";

    const title = document.createElement("h5");
    title.textContent = cat;
    group.appendChild(title);

    const checkboxes = document.createElement("div");
    checkboxes.className = "checkboxes";

    comps.forEach(comp => {
      const label = document.createElement("label");
      label.className = "chip";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = comp;
      input.checked = true; // All rendered components are checked by default

      const span = document.createElement("span");
      span.textContent = comp; // Capitalize first letter? Nah matches valid component name

      label.appendChild(input);
      label.appendChild(span);
      checkboxes.appendChild(label);
    });

    group.appendChild(checkboxes);
    container.appendChild(group);
  }
}

function setStatus(message) {
  const statusText = document.getElementById("status-text");
  if (!statusText) return;
  statusText.textContent = message || "Ready";
}

function getSelected(containerId) {
  const container = document.getElementById(containerId);
  return Array.from(container.querySelectorAll("input[type=checkbox]"))
    .filter((c) => c.checked)
    .map((c) => c.value);
}

function setSelected(containerId, names) {
  const container = document.getElementById(containerId);
  container.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.checked = names.includes(cb.value);
  });
}

let isRunning = false;

async function runAndReport(action, actionName, onSuccess) {
  if (isRunning) return;
  isRunning = true;
  setStatus(`Running ${actionName}...`);

  // Disable buttons
  document.querySelectorAll("button").forEach(b => b.disabled = true);
  document.body.style.cursor = "wait";

  try {
    const result = await action();
    if (!result) return;

    // ... existing logic ...
    const { code, stdout, stderr } = result;
    if (code === 0) {
      log(`${actionName} completed successfully.`);
      if (stdout) log(stdout);
      setStatus("Ready");

      // Send Notification
      new Notification('Backmey', {
        body: `${actionName.charAt(0).toUpperCase() + actionName.slice(1)} completed successfully!`
      });

      if (onSuccess) onSuccess(result);
    } else {
      log(`Error: ${actionName} failed with code ${code} `);
      if (stderr) log(`Stderr: ${stderr} `);
      if (stdout) log(`Stdout: ${stdout} `);
      setStatus("Error");
    }
  } catch (err) {
    log(`Error running ${actionName}: ${err} `);
    setStatus("Error");
  } finally {
    isRunning = false;
    document.querySelectorAll("button").forEach(b => b.disabled = false);
    document.body.style.cursor = "default";
  }
}

function renderCustomIncludes() {
  const container = document.getElementById("custom-includes-list");
  container.innerHTML = "";

  if (customIncludes.length === 0) {
    container.innerHTML = '<div class="subtle" style="font-size: 13px; font-style: italic; padding: 5px 0;">No extra folders selected yet.</div>';
    return;
  }

  customIncludes.forEach((path, index) => {
    const row = document.createElement("div");
    row.style.cssText = "display: flex; align-items: center; justify-content: space-between; background: var(--surface); padding: 8px; border-radius: 6px; border: 1px solid var(--border);";

    const pathSpan = document.createElement("span");
    pathSpan.textContent = path;
    pathSpan.style.cssText = "font-family: monospace; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 10px;";
    pathSpan.title = path;

    const removeBtn = document.createElement("button");
    removeBtn.innerHTML = "&times;";
    removeBtn.className = "ghost";
    removeBtn.style.cssText = "width: 24px; height: 24px; min-width: 24px; padding: 0; line-height: 1; color: var(--error); border-color: var(--error);";
    removeBtn.onclick = () => {
      customIncludes.splice(index, 1);
      renderCustomIncludes();
    };

    row.appendChild(pathSpan);
    row.appendChild(removeBtn);
    container.appendChild(row);
  });
}

function closePreview() {
  document.getElementById('preview-modal').close();
}

document.addEventListener("DOMContentLoaded", () => {
  // Initial Render
  renderComponents("backup-components", ["custom"]);
  renderComponents("restore-components"); // Include custom here

  // Stream backend output to log
  if (window.backmey.onProgress) {
    window.backmey.onProgress((chunk) => {
      // Split chunks into lines to avoid messy partial logs, but allow some buffering?
      // For now, simple logging of non-empty lines
      const parts = chunk.split('\n');
      parts.forEach(p => {
        if (p.trim()) log(p.replace(/\r/g, ''));
      });
    });
  }

  // Auto-detect desktop environment and allow manual re-run via detect button
  runDetect();
  const detectBtn = document.getElementById("detect");
  if (detectBtn) {
    detectBtn.onclick = () => runDetect();
  }

  const refreshBtn = document.getElementById("refresh-list");
  if (refreshBtn) refreshBtn.onclick = listBackups;
  listBackups();
  renderCustomIncludes();

  document.getElementById("add-custom-include").onclick = async () => {
    const paths = await window.backmey.selectDirectory();
    if (paths && paths.length > 0) {
      let addedCount = 0;
      paths.forEach(path => {
        if (!customIncludes.includes(path)) {
          customIncludes.push(path);
          addedCount++;
        }
      });
      if (addedCount > 0) renderCustomIncludes();
    }
  };

  document.getElementById("backup-run").onclick = () => runBackup(false);
  document.getElementById("backup-preview").onclick = () => runBackup(true);
  document.getElementById("backup-advanced-toggle").onclick = () => toggleAdvanced("backup-advanced");
  document.getElementById("backup-run").addEventListener("click", async () => {
    const destType = document.querySelector('input[name="dest-type"]:checked').value;
    const notes = document.getElementById("backup-notes").value;

    const selectedComponents = getSelected("backup-components");

    if (selectedComponents.length === 0 && !document.getElementById("backup-dconf").checked) {
      // This `if` block is part of the new event listener, but the provided snippet ends abruptly.
      // Assuming the user wants to insert the variable definition and the start of the event listener.
      // The rest of the event listener's body is not provided, so it's left as is.
    }
  });
  document.getElementById("restore-advanced-toggle").onclick = () => toggleAdvanced("restore-advanced");
  document.getElementById("backup-select-all").onclick = () => setSelected("backup-components", components);
  document.getElementById("backup-select-default").onclick = () => setSelected("backup-components", defaultComponents);
  document.getElementById("backup-select-none").onclick = () => setSelected("backup-components", []);

  // Attach event listeners for backup destination
  document.querySelectorAll('input[name="dest-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => toggleDest(e.target.dataset.dest));
  });
  const browseDestBtn = document.getElementById('browse-dest-btn');
  if (browseDestBtn) browseDestBtn.addEventListener('click', browseDest);

  // Attach event listeners for restore source
  document.querySelectorAll('input[name="restore-source"]').forEach(radio => {
    radio.addEventListener('change', (e) => toggleRestoreSource(e.target.dataset.source));
  });
  const browseRestoreSrcBtn = document.getElementById('browse-restore-source-btn');
  if (browseRestoreSrcBtn) browseRestoreSrcBtn.addEventListener('click', browseRestoreSource);

  // Preview modal close button
  const previewCloseBtn = document.getElementById("preview-close-btn");
  if (previewCloseBtn) previewCloseBtn.addEventListener('click', closePreview);

  // Refresh list button
  const refreshListBtn = document.getElementById("refresh-list");
  if (refreshListBtn) refreshListBtn.addEventListener('click', listBackups);

  // Encryption toggle
  const encryptCb = document.getElementById("backup-encrypt");
  if (encryptCb) {
    encryptCb.addEventListener('change', (e) => {
      const group = document.getElementById('passphrase-group');
      if (group) group.style.display = e.target.checked ? 'block' : 'none';
    });
  }

  // Copy buttons
  const copyLogBtn = document.getElementById('copy-log-btn');
  if (copyLogBtn) copyLogBtn.addEventListener('click', (e) => copyToClipboard('log', e));

  const restoreSelectAll = document.getElementById("restore-select-all");
  if (restoreSelectAll) restoreSelectAll.onclick = () => setSelected("restore-components", components);

  const restoreSelectNone = document.getElementById("restore-select-none");
  if (restoreSelectNone) restoreSelectNone.onclick = () => setSelected("restore-components", []);

  document.getElementById("restore-run").onclick = () => {
    const payload = {
      profile: document.getElementById("restore-profile").value || null,
      version: document.getElementById("restore-version").value || null,
      archive: document.getElementById("restore-archive").value || null,
      template: document.getElementById("restore-template").value || null,
      components: getSelected("restore-components"),
      dry_run: false,
      yes: true,
      skip_conflicts: document.getElementById("restore-skip").checked,
      install_packages: document.getElementById("restore-install").checked,
      install_dry_run: document.getElementById("restore-install-dry").checked,
      passphrase: document.getElementById("restore-passphrase").value,
    };

    // Inject Custom Store Dir if selected
    // Note: uldbr.py 'restore' command uses --store-dir to find versioned backups.
    if (restoreSourceType === 'custom' && restoreCustomPath) {
      payload.store_dir = restoreCustomPath;
    }

    runAndReport(() => window.backmey.restore(payload), "restore");
  };

  // Tab switching logic
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class from all buttons and content
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      // Add active class to clicked button
      btn.classList.add('active');

      // Show corresponding content
      const tabId = btn.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');

      // Auto-refresh logic
      if (tabId === 'tab-restore') {
        listBackups();
      }
    });
  });
});

function runDetect() {
  detectOutput.textContent = "Detecting...";
  if (detectTimer) {
    clearTimeout(detectTimer);
  }
  let resolved = false;
  detectTimer = setTimeout(() => {
    if (resolved) return;
    detectOutput.textContent = "Detection taking longer than expected...";
    log("Detect timeout after 6s");
  }, 6000);

  const timeoutPromise = new Promise((resolve) =>
    setTimeout(() => resolve({ code: 124, stdout: "", stderr: "timeout" }), 9000)
  );

  runAndReport(
    () => Promise.race([window.backmey.detect(), timeoutPromise]),
    "detect",
    ({ code, stdout, stderr }) => {
      resolved = true;
      console.log("[uldbr-ui] detect result", { code, stdout, stderr });
      if (detectTimer) clearTimeout(detectTimer);
      if (code !== 0) {
        detectOutput.innerHTML = `< span style = "color: #ef4444;" > Detection failed(${code}) ${stderr || ""}</span > `;
        return;
      }
      try {
        const data = JSON.parse(stdout);
        const desktop = data.desktop || "unknown";
        const display = data.display_server || "unknown";
        detectOutput.innerHTML = `
    <div style="margin-bottom: 4px;">Desktop: <span style="color: var(--primary);">${data.desktop}</span></div>
    <div>Display: <span style="color: var(--primary);">${data.display_server}</span></div>
  `;
        log(`Detect success: desktop = ${desktop}, display = ${display} `);
      } catch {
        detectOutput.textContent = stdout.trim() || "Detection complete.";
        log("Detect success (raw): " + (stdout || "").trim());
      }
    },
    (err) => {
      resolved = true;
      console.log("[backmey-ui] detect error", err);
      if (detectTimer) clearTimeout(detectTimer);
      detectOutput.innerHTML = `< span style = "color: #ef4444;" > Detection failed: ${err}</span > `;
    }
  );
}

function copyToClipboard(elementId, event) {
  const el = document.getElementById(elementId);
  const text = el.innerText || el.textContent;

  navigator.clipboard.writeText(text).then(() => {
    const btn = event ? event.currentTarget : null;
    if (!btn) return;
    const originalText = btn.textContent;
    btn.textContent = "Copied!";
    btn.style.color = "#38bdf8";

    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.color = "";
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy: ', err);
  });
}

let selectedCustomPath = null;

function toggleDest(type) {
  document.getElementById('dest-custom').style.display = type === 'custom' ? 'block' : 'none';
  document.getElementById('dest-cloud').style.display = type === 'cloud' ? 'block' : 'none';
}

async function browseDest() {
  const path = await window.backmey.selectDirectory();
  if (path) {
    selectedCustomPath = path;
    document.getElementById('custom-path-display').textContent = path;
    document.getElementById('custom-path-display').title = path;
  }
}

// Override runBackup to handle new destination logic
async function runBackup(forceDryRun) {
  const btnId = forceDryRun ? "backup-preview" : "backup-run";
  const btn = document.getElementById(btnId);
  const originalText = btn.textContent;

  if (forceDryRun) btn.textContent = "Running Preview...";
  else btn.textContent = "Running Backup...";

  try {
    const destTypeElem = document.querySelector('input[name="dest-type"]:checked');
    if (!destTypeElem) throw new Error("No destination type selected");
    const destType = destTypeElem.value;

    // Define selectedComponents here so it's available for the payload
    const selectedComponents = getSelected("backup-components");

    const payload = {
      profile: document.getElementById("backup-profile").value || null,
      version: document.getElementById("backup-version").value || null,
      notes: document.getElementById("backup-notes").value || null,
      with_browser_profiles: selectedComponents.includes("browsers"),
      report_sizes: document.getElementById("backup-report").checked,
      no_packages: document.getElementById("backup-no-packages").checked,
      dry_run: forceDryRun,
      skip_dconf: !document.getElementById("backup-dconf").checked,
      smart_exclude: document.getElementById("backup-smart-exclude").checked,
      custom_excludes: document.getElementById("backup-custom-exclude").value,
      custom_includes: customIncludes,
      components: selectedComponents.filter((c) => c !== "browsers"),
      encrypt: document.getElementById("backup-encrypt").checked,
      passphrase: document.getElementById("backup-passphrase").value,
    };

    // Browsers and Containers are special flags or just components?
    // In uldbr.py we added "containers" handling in the main loop.
    // So passing it in "components" list IS correct.
    // However, the existing code filters "browsers" out because it uses a separate flag --with-browser-profiles ?
    // Let me check main.js. Yes, `if (payload.with_browser_profiles) args.push("--with-browser-profiles"); `
    // But for containers, I didn't add a special flag in uldbr.py, I treated it as a component name "containers".
    // So I should NOT filter it out here if I want it passed in the `components` list.

    // Wait, `getSelected` returns ALL checked values.
    // If I want "containers" to be passed as a component, I should just let it be in `components`.
    // But verify if `uldbr.py` accepts "containers" in `args.components`.
    // My change in uldbr.py iterates `args.components`.
    // So verify `COMPONENTS` dict.
    // "containers" is NOT in global `COMPONENTS` dict.
    // The loop logic I added: `if comp == "containers": ... continue`.
    // So yes, it needs to be in `components` list.

    // Correction: I should NOT filter it out.
    // But I DO filter out "browsers" because that travels via separate flag.
    // So:
    if (destType === 'custom') {
      if (!selectedCustomPath) {
        log("Error: Please select a custom destination path.");
        return;
      }
      payload.store_dir = selectedCustomPath;
    } else {
      if (document.getElementById("backup-output").value) {
        payload.output = document.getElementById("backup-output").value;
      }
    }

    if (document.getElementById("backup-sync").value) {
      payload.sync_command = document.getElementById("backup-sync").value;
    }

    if (forceDryRun) {
      payload.report_sizes = true;
    }

    await runAndReport(
      () => window.backmey.backup(payload),
      payload.dry_run ? "backup-dry-run" : "backup",
      (result) => {
        if (forceDryRun && result.code === 0) {
          showPreviewReport(result.stdout);
        }
      }
    );
  } catch (err) {
    log(`Error preparing backup: ${err.message} `);
  } finally {
    if (btn) btn.textContent = originalText;
  }
}

function showPreviewReport(stdout) {
  const modal = document.getElementById('preview-modal');
  const content = document.getElementById('preview-content');

  // Simple parsing of the CLI output
  const lines = stdout.split('\n');
  let inReport = false;
  let html = '<table style="width: 100%; border-collapse: collapse;">';
  let totalLine = "";

  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.includes("Component size report:")) {
      inReport = true;
      return;
    }
    if (inReport) {
      if (trimmed.startsWith('-')) {
        const parts = trimmed.substring(1).split(':');
        if (parts.length >= 2) {
          const name = parts[0].trim();
          const size = parts.slice(1).join(':').trim();
          html += `<tr style="border-bottom: 1px solid #374151;"><td style="padding: 8px 0;">${name}</td><td style="text-align: right; color: var(--accent);">${size}</td></tr>`;
        }
      } else if (trimmed.startsWith('Total:')) {
        totalLine = trimmed;
        inReport = false;
      }
    }
  });
  html += '</table>';

  if (totalLine) {
    html += `<div style="margin-top: 16px; font-weight: bold; border-top: 2px solid var(--border); padding-top: 12px; text-align: right;">${totalLine}</div>`;
  }

  if (html === '<table style="width: 100%; border-collapse: collapse;"></table>') {
    content.textContent = "No component size report found in output. Raw output:\n" + stdout;
  } else {
    content.innerHTML = html;
  }

  modal.showModal();
}

function toggleAdvanced(id) {
  const el = document.getElementById(id);
  el.classList.toggle("show");
}

// Restoration Source Logic
let restoreSourceType = 'default';
let restoreCustomPath = null;

function toggleRestoreSource(type) {
  restoreSourceType = type;
  document.getElementById('restore-custom-src').style.display = type === 'custom' ? 'block' : 'none';
  listBackups();
}

async function browseRestoreSource() {
  const path = await window.backmey.selectDirectory();
  if (path) {
    restoreCustomPath = path;
    document.getElementById('restore-src-display').textContent = path;
    document.getElementById('restore-src-display').title = path;
    listBackups();
  }
}

async function listBackups() {
  const container = document.getElementById("backups-list");
  container.innerHTML = '<div style="grid-column: 1/-1; color: var(--muted); font-style: italic;">Loading backups...</div>';

  const payload = { json: true };
  if (restoreSourceType === 'custom' && restoreCustomPath) {
    payload.store_dir = restoreCustomPath;
  }

  // We are not passing template_dir for custom source, defaulting to standard behavior or standard template dir

  try {
    const result = await window.backmey.list(payload);
    if (result.code !== 0) {
      container.innerHTML = `<div style="grid-column: 1/-1; color: var(--error);">Error listing backups: ${result.stderr}</div>`;
      return;
    }

    let data;
    try {
      data = JSON.parse(result.stdout);
    } catch (e) {
      container.innerHTML = `<div style="grid-column: 1/-1; color: var(--error);">Failed to parse list data</div>`;
      log("JSON Parse Error on List: " + result.stdout);
      return;
    }

    renderBackupsList(data);
  } catch (err) {
    container.innerHTML = `<div style="grid-column: 1/-1; color: var(--error);">Error: ${err}</div>`;
  }
}

function renderBackupsList(data) {
  const container = document.getElementById("backups-list");
  container.innerHTML = '';

  const backups = data.backups || {};
  const templates = data.templates || [];

  if (Object.keys(backups).length === 0 && templates.length === 0) {
    container.innerHTML = '<div style="grid-column: 1/-1; color: var(--muted); font-style: italic;">No backups found in this location.</div>';
    return;
  }

  // Render Backups
  for (const [profile, versions] of Object.entries(backups)) {
    const card = document.createElement('div');
    card.className = "card backup-card"; // Inline styles removed in favor of CSS class

    const latest = versions[versions.length - 1];

    // Sort versions new to old
    const sortedVersions = [...versions].reverse();

    // Generate pills with formatted dates
    const versionPills = sortedVersions.map(v => {
      let label = v;
      // Try to parse timestamp YYYYMMDD-HHMMSS
      const match = v.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/);
      if (match) {
        const [_, y, m, d, h, min, s] = match;
        const date = new Date(y, m - 1, d, h, min, s);
        // Format: Dec 10, 18:16
        label = date.toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
      } else {
        // Fallback: strip extensions
        label = v.replace(/\.tar\.(gz|zst)$/, '').replace(/\.tgz$/, '');
      }

      return `<div class="version-pill" data-version="${v}" title="${v}" style="
        padding: 5px 12px; 
        background: rgba(255,255,255,0.03); 
        border: 1px solid var(--border); 
        border-radius: 6px; 
        font-size: 12px; 
        font-weight: 500;
        cursor: pointer; 
        white-space: nowrap;
        transition: all 0.2s;
        color: var(--text);
        display: flex;
        align-items: center;
        gap: 6px;
      ">
        <span style="opacity: 0.7; font-size: 10px;">📅</span> ${label}
      </div>`;
    }).join('');

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
         <div style="font-weight: 600; font-size: 16px; color: var(--accent); display: flex; align-items: center; gap: 8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            ${profile}
         </div>
         <div style="font-size: 11px; color: var(--muted); background: rgba(0,0,0,0.2); padding: 2px 8px; border-radius: 4px;">
           ${versions.length} versions
         </div>
      </div>
      
      <div class="version-list" style="
        display: flex; 
        gap: 8px; 
        overflow-x: auto; 
        padding-bottom: 8px;
        margin-bottom: 0;
        scrollbar-width: thin;
        scrollbar-color: var(--border) transparent;
      ">
        ${versionPills}
      </div>
      <input type="hidden" id="sel-${profile}" value="${sortedVersions[0]}" /> 
    `;

    container.appendChild(card);

    // Pill click logic
    const versionList = card.querySelector('.version-list');
    const hiddenInput = card.querySelector(`#sel-${profile}`);
    const pills = versionList.querySelectorAll('.version-pill');

    // Select first by default
    if (pills.length > 0) {
      pills[0].style.borderColor = "var(--accent)";
      pills[0].style.background = "rgba(56, 189, 248, 0.1)";
    }

    pills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent card selection toggle loop (optional)

        // Update styling
        pills.forEach(p => {
          p.style.borderColor = "var(--border)";
          p.style.background = "var(--bg)";
        });
        pill.style.borderColor = "var(--accent)";
        pill.style.background = "rgba(56, 189, 248, 0.1)";

        // Update hidden input
        hiddenInput.value = pill.dataset.version;

        // Trigger restore selection
        prefillRestore(profile);

        // Select card visually
        container.querySelectorAll('.backup-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
    });

    // Clicking card selects profile (and current version)
    card.addEventListener('click', () => {
      prefillRestore(profile);
      container.querySelectorAll('.backup-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    });

    // Auto-select and inspect the very first backup profile found
    // This runs only once per render, for the first item in the loop (if we track it),
    // or we can just do it if container.children.length === 1 (since we just appended it).
    if (Object.keys(backups).indexOf(profile) === 0) {
      // Visually select card
      card.classList.add('selected');
      // Trigger inspection (async)
      prefillRestore(profile);
    }
  }

  // Render Templates
  if (templates.length > 0) {
    const tplHeader = document.createElement('div');
    tplHeader.style.gridColumn = "1/-1";
    tplHeader.style.marginTop = "16px";
    tplHeader.innerHTML = '<h4 style="margin: 0; color: var(--fg);">Templates</h4>';
    container.appendChild(tplHeader);

    templates.forEach(tpl => {
      const card = document.createElement('div');
      card.className = "card";
      card.style.padding = "16px";
      card.style.border = "1px solid var(--border)";
      card.style.borderRadius = "6px";
      card.style.background = "rgba(30, 41, 59, 0.5)";

      card.innerHTML = `
  <div style="font-weight: bold; font-size: 16px; margin-bottom: 8px; color: #10b981;">${tpl}</div>
    <button class="secondary template-btn" data-template="${tpl}" style="width: 100%; margin-top: 12px;">Select Template</button>
`;
      container.appendChild(card);

      // Attach event listener for the template button
      const templateBtn = card.querySelector('.template-btn');
      templateBtn.addEventListener('click', () => prefillTemplate(tpl));
    });
  }
}

async function prefillRestore(profile) {
  const version = document.getElementById(`sel-${profile}`).value;
  document.getElementById("restore-profile").value = profile;
  document.getElementById("restore-version").value = version;
  document.getElementById("restore-template").value = "";

  // Flash status
  setStatus(`Inspecting ${profile} (${version})...`);

  // Build payload
  const payload = {
    profile,
    version,
    passphrase: document.getElementById("restore-passphrase").value
  };

  if (restoreSourceType === 'custom' && restoreCustomPath) {
    payload.store_dir = restoreCustomPath;
  }

  try {
    const result = await window.backmey.inspect(payload);
    if (result.code !== 0) {
      log("Inspect failed: " + result.stderr);
      setStatus("Inspect failed");
      return;
    }

    try {
      const manifest = JSON.parse(result.stdout);
      if (manifest.components) {
        const comps = manifest.components.map(c => c.component);
        const uniqueComps = [...new Set(comps)];
        setSelected("restore-components", uniqueComps);
        setStatus(`Ready to restore ${uniqueComps.length} component(s)`);
        log(`Auto-selected components from backup: ${uniqueComps.join(", ")}`);
      }
      if (manifest.notes) {
        log(`Backup Notes: ${manifest.notes}`);
      }
    } catch (e) {
      log("Failed to parse manifest: " + e);
    }

  } catch (err) {
    log("Error inspecting backup: " + err);
  }
}

function prefillTemplate(tpl) {
  document.getElementById("restore-profile").value = "";
  document.getElementById("restore-version").value = "";
  document.getElementById("restore-template").value = tpl;
  setStatus(`Selected template: ${tpl} `);
}
