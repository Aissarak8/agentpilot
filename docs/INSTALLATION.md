# Installation

## Requirements

- Windows 11 (currently tested)
- VS Code 1.90.0 or newer
- Node.js 22 for source builds
- An installed and authenticated official Codex CLI/native executable for Codex features
- PowerShell for native Windows notifications

AgentPilot has no runtime npm dependencies. Packaging uses `@vscode/vsce@4.0.0` through `npx`.

## Install a prebuilt VSIX

The repository checkout may contain the locally built `agentpilot-1.0.0-rc.1.vsix`. There is currently no documented GitHub Release download.

1. Open VS Code's Extensions view.
2. Choose **Views and More Actions (…) → Install from VSIX…**.
3. Select the VSIX.
4. Run **Developer: Reload Window**.
5. Confirm `AgentPilot: Open Dashboard` appears in the Command Palette.

CLI alternative:

```powershell
code --install-extension .\agentpilot-1.0.0-rc.1.vsix
```

## Build from source

```powershell
git clone https://github.com/Aissarak8/agentpilot.git
cd agentpilot
npm install
npm test
npm run package:rc
code --install-extension .\agentpilot-1.0.0-rc.1.vsix
```

The first packaging run downloads the pinned VSCE tool from npm. Inspect the generated VSIX before installing it when working from an untrusted fork.

## Configure Codex

Install and authenticate the official Codex CLI using the current official OpenAI documentation. Verify the native executable independently:

```powershell
codex --version
```

On Windows, AgentPilot must launch a native executable without a shell. If `codex.exe` is not on the VS Code Extension Host PATH, set **AgentPilot: Codex CLI Path** to its absolute path. Do not select a `.cmd` or `.bat` shim.

Authentication stays inside the official Codex process. AgentPilot does not request, read, copy, or store authentication credentials.

## First activation

1. Open a disposable project folder.
2. Review and trust the workspace if appropriate.
3. Open the Dashboard; it must not launch Codex.
4. Open Codex Chat and send a harmless task.
5. Review the one-time startup confirmation. A stopped or restarted process requires confirmation again.
6. Confirm that follow-up turns in the active authorized process do not repeat startup confirmation.

## Upgrade and rollback

Installing a newer VSIX updates the extension. To roll back, uninstall AgentPilot and install the earlier VSIX. Local metadata under `%USERPROFILE%\.agentpilot` is retained. Back it up before deleting it; uninstalling the extension does not remove it.
