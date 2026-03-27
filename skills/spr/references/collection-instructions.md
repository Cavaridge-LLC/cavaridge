# SharePoint Permissions Audit — Data Collection Instructions

## Overview

Before the SharePoint Permissions & Security Report can be generated, you need to collect permission data from the target Microsoft 365 tenant. **Four collection methods** are available — choose the one that matches your environment.

## Platform Compatibility Matrix

| Method | Windows | macOS | Linux | Mobile/Tablet | Headless/CI | Auth Options |
|--------|---------|-------|-------|---------------|-------------|-------------|
| **Browser Collector** | ✅ | ✅ | ✅ | ✅ | ❌ | Interactive (MFA) |
| **Python Script** | ✅ | ✅ | ✅ | ❌ | ✅ | Interactive, Device Code, App-Only |
| **PnP.PowerShell** | ✅ | ✅ | ✅ | ❌ | ⚠️ | Interactive, Credential |
| **Graph PowerShell SDK** | ✅ | ✅ | ✅ | ❌ | ✅ | Interactive, App-Only (secret/cert) |

**Recommendation:** Use the **Browser Collector** if you're on mobile, a loaner machine, or any device where installing software isn't practical. Use the **Python Script** for automated scheduled audits, CI/CD pipelines, or Mac/Linux desktops. Use **PowerShell** if you're already in a PS7 environment.

---

## Prerequisites (All Methods)

- **Microsoft 365 admin account** with at least **SharePoint Administrator** or **Global Reader** role
- For item-level scanning: permissions to read all sites and files
- Estimated time: 5-30 minutes per 100 sites depending on depth
- All methods produce the same JSON output (schema v1.0)

## App Registration (Required for Browser Collector and recommended for all)

All methods benefit from a dedicated app registration. The Browser Collector **requires** one.

### One-Time Setup

1. Go to **Entra ID → App registrations → New registration**
2. Name: `AEGIS SPR Collector` (or your preference)
3. Supported account types: **Single tenant**
4. Redirect URI: Select **Single-page application (SPA)**, enter the URL where you'll open the browser collector (e.g., `http://localhost` for local file, or the actual URL if hosted)
5. Click **Register**
6. Go to **API permissions → Add a permission → Microsoft Graph → Delegated**
7. Add these permissions:
   - `Sites.Read.All`
   - `Files.Read.All`
   - `User.Read`
   - `Directory.Read.All` (optional, for richer group data)
8. Click **Grant admin consent**
9. Copy the **Application (client) ID** from the Overview page

For **app-only** (Python or PowerShell unattended):
- Also add **Application** permissions: `Sites.Read.All`, `Files.Read.All`, `User.Read.All`
- Create a client secret or upload a certificate

---

## Option A: Browser Collector (Any Device, Zero Install)

**Best for:** Mobile, tablets, loaner machines, client sites where you can't install software, quick ad-hoc audits.

The browser collector is a single HTML file that runs entirely in your browser. It authenticates via MSAL.js popup, makes Graph API calls directly, and exports the JSON. **No data leaves your browser.**

### Run

1. Open `sp-audit-browser.html` in any modern browser (Chrome, Edge, Safari, Firefox)
   - On mobile: open the file from your cloud storage, email, or a local web server
   - If hosted: navigate to the URL
2. Enter your **Tenant ID** and **App Registration Client ID**
3. Configure scan depth (sites-only is fastest for a quick check)
4. Click **Sign In with Microsoft** — authenticate in the popup
5. Click **Start Audit** — watch the progress
6. Click **Download JSON** when complete

### Notes
- Works on iPhone, iPad, Android — any device with a browser
- Safari on iOS: ensure pop-ups are allowed for the auth flow
- For very large tenants (500+ sites), consider reducing item depth or using a desktop method
- The file can be emailed to yourself, hosted on an internal web server, or opened directly from a file share
- All API calls go directly from your browser to Microsoft Graph — nothing passes through Cavaridge servers

---

## Option B: Python Script (Cross-Platform Desktop + CI/CD)

**Best for:** macOS/Linux desktops, automated scheduled audits, CI/CD pipelines, headless servers.

Python is pre-installed on macOS and most Linux distributions. The script uses MSAL for auth and the requests library for Graph API calls.

### Install

```bash
# macOS / Linux (Python 3 usually pre-installed)
pip3 install msal requests

# Windows
pip install msal requests

# Or with pipx for isolation
pipx install msal requests
```

### Run

```bash
# Interactive (browser popup — works on macOS, Windows, Linux with GUI)
python3 invoke_sp_audit.py --tenant-id contoso.onmicrosoft.com

# Device Code (for SSH, headless, or when browser popup isn't available)
# Prints a URL + code — open on ANY device including your phone to authenticate
python3 invoke_sp_audit.py --tenant-id contoso.onmicrosoft.com --device-code

# App-only (unattended / CI/CD — no human interaction needed)
python3 invoke_sp_audit.py --tenant-id contoso.onmicrosoft.com \
    --client-id 12345678-... --client-secret YOUR_SECRET

# Quick scan (sites only, no item-level)
python3 invoke_sp_audit.py --tenant-id contoso.onmicrosoft.com --no-item-level

# Limited depth
python3 invoke_sp_audit.py --tenant-id contoso.onmicrosoft.com --max-items 500
```

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `--tenant-id` | Yes | — | Azure AD tenant ID or domain |
| `--output` | No | `SPPermissionsAudit_<timestamp>.json` | Output file path |
| `--client-id` | No | Microsoft Graph Explorer default | App registration client ID |
| `--client-secret` | No | — | Enables app-only (unattended) auth |
| `--device-code` | No | `false` | Use device code flow (prints URL + code) |
| `--max-items` | No | `2000` | Max items per drive |
| `--no-item-level` | No | `false` | Skip item scanning (much faster) |

### Device Code Flow (SSH / Headless / Unique Situations)

The `--device-code` flag is perfect for when you're SSH'd into a server, running in a container, or on a machine without a browser. It prints a URL and a code — you open that URL **on any other device** (your phone, another computer, etc.), enter the code, and authenticate there. The script picks up the token automatically.

```
============================================================
  To authenticate, open: https://microsoft.com/devicelogin
  Enter code: ABCD-EFGH
============================================================
```

---

## Option C: PnP.PowerShell (Windows/macOS/Linux with PowerShell 7)

**Best for:** SharePoint admins already comfortable with PnP, environments where PnP is already installed, when you need the deepest SharePoint-native permission detail (role definition bindings, broken inheritance detection).

### Install

```powershell
# Requires PowerShell 7+ (pwsh, not Windows PowerShell 5.x)
# Check version: $PSVersionTable.PSVersion

# Install PowerShell 7 if needed:
#   macOS:    brew install powershell/tap/powershell
#   Linux:    https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-linux
#   Windows:  winget install Microsoft.PowerShell

Install-Module PnP.PowerShell -Scope CurrentUser -Force
```

### Run

```powershell
# Interactive login (browser popup for MFA)
./Invoke-SPPermissionsAudit-PnP.ps1 -TenantAdminUrl "https://TENANT-admin.sharepoint.com"

# With credential object (no MFA)
$cred = Get-Credential
./Invoke-SPPermissionsAudit-PnP.ps1 -TenantAdminUrl "https://TENANT-admin.sharepoint.com" -Credential $cred

# Faster scan: limit item depth
./Invoke-SPPermissionsAudit-PnP.ps1 -TenantAdminUrl "https://TENANT-admin.sharepoint.com" -MaxItemsPerList 500

# Skip known non-production sites
./Invoke-SPPermissionsAudit-PnP.ps1 -TenantAdminUrl "https://TENANT-admin.sharepoint.com" `
    -ExcludeSites @("https://contoso.sharepoint.com/sites/appcatalog")
```

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| TenantAdminUrl | Yes | — | SharePoint Admin Center URL |
| OutputPath | No | `./SPPermissionsAudit_<timestamp>.json` | Output file path |
| IncludeItemLevel | No | `$true` | Scan individual files/folders |
| MaxItemsPerList | No | 5000 | Max items per list. 0 = unlimited |
| ExcludeSites | No | `@()` | Site URLs to skip |
| Credential | No | Interactive | PSCredential for auth |

---

## Option D: Microsoft Graph PowerShell SDK (Windows/macOS/Linux with PowerShell 7)

**Best for:** When PnP isn't available but PowerShell is, when you need certificate-based app-only auth.

### Install

```powershell
# Full SDK (large)
Install-Module Microsoft.Graph -Scope CurrentUser -Force

# Or just the needed submodules (smaller)
Install-Module Microsoft.Graph.Sites, Microsoft.Graph.Files, Microsoft.Graph.Identity.DirectoryManagement -Scope CurrentUser -Force
```

### Run

```powershell
# Interactive (delegated) login
./Invoke-SPPermissionsAudit-Graph.ps1 -TenantId "contoso.onmicrosoft.com"

# App-only with client secret
./Invoke-SPPermissionsAudit-Graph.ps1 -TenantId "contoso.onmicrosoft.com" `
    -ClientId "12345678-abcd-..." `
    -ClientSecret (ConvertTo-SecureString "secret" -AsPlainText -Force)

# App-only with certificate
./Invoke-SPPermissionsAudit-Graph.ps1 -TenantId "contoso.onmicrosoft.com" `
    -ClientId "12345678-abcd-..." -CertificateThumbprint "AABBCC..."
```

---

## Output

All methods produce a JSON file (typically 500KB-50MB) with `schemaVersion: "1.0"`. The filename defaults to `SPPermissionsAudit_YYYYMMDD_HHmmss.json`.

**Next step:** Upload the JSON file to Claude and say:
> "Run a SharePoint permissions report for [Client Name]"

---

## Troubleshooting

| Issue | Resolution |
|-------|------------|
| **Browser collector: popup blocked** | Allow popups for the page. On iOS Safari: Settings → Safari → Block Pop-ups → Off |
| **Browser collector: CORS error** | This shouldn't happen (calls go to Microsoft directly), but ensure you're using HTTPS if hosted |
| **Python: `msal` not found** | Run `pip3 install msal requests` (use `pip3` on macOS, not `pip`) |
| **macOS: PowerShell not found** | Install with `brew install powershell/tap/powershell`, then run with `pwsh` |
| **Access denied on some sites** | The account needs SharePoint Admin role, or Site Collection Administrator on each site |
| **Throttling (429 errors)** | All scripts have built-in retry. Run during off-peak hours for large tenants |
| **Device code: "AADSTS50011"** | Add `http://localhost` as a redirect URI (type: Public client/native) in the app registration |
| **Empty groups/permissions** | Some system sites restrict enumeration. Logged in the site's `errors` array |
| **Very large output** | Normal for 100+ sites. Reduce with `--no-item-level` or `--max-items 500` |
| **Mobile browser slow** | Use "Sites only" mode (set Max Items to 0). Item-level scanning is CPU-heavy |
