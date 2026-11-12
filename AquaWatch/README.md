# AquaWatch

A responsive water issue reporting portal inspired by [Water Quality Monitoring](https://github.com/Akhilanisha/Water_Quality_Monitoring). The overview counts reports submitted to the portal. It does not ingest sensor readings or assess whether water is safe.

## Start a demo on Windows

Install **Node.js 24 or newer**. Extract the ZIP, open PowerShell in the `AquaWatch` folder, and run:

```powershell
node -v
npm.cmd run demo
```

Open [http://localhost:3000](http://localhost:3000). Demo mode loads sample data into memory and prints a random staff password and a tracking reference in the terminal. Use **Staff console** to sign in. Demo changes disappear when the server stops. Stop it with **Ctrl+C**.

## Run with persistent data

```powershell
$env:ADMIN_PASSWORD = Read-Host 'Choose a staff password (at least 12 characters)' -MaskInput
npm.cmd start
```

Use PowerShell 7 for `-MaskInput`. On Windows PowerShell 5.1, use `Read-Host` without that switch in a private terminal, or set the environment variable before starting the server. On macOS or Linux, export the password in your shell and run `npm start`. The app creates `data/aquawatch.sqlite` automatically. Without `ADMIN_PASSWORD`, citizen functions work and staff sign-in is disabled.

1. Submit a report and save its tracking reference.
2. Sign into the staff console, open the report, and save a status and optional public note.
3. Look up the reference in **Track a report** to see the new status.

Public lookup requires the reference and shows the issue type, dates, status and public note. Staff can view the contact details provided with the report. Staff sessions are held in memory and expire after eight hours or when the process restarts.

## Configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | HTTP port | `3000` |
| `HOST` | Bind address | `127.0.0.1` |
| `DATABASE_PATH` | SQLite file path | `data/aquawatch.sqlite` |
| `ADMIN_PASSWORD` | Password for the shared staff account | Staff sign-in disabled |
| `APP_ORIGIN` | Public origin when using a reverse proxy, such as `https://water.example.org` | Local HTTP origin |
| `COOKIE_SECURE` | Set to `1` when serving the app over HTTPS | Off for local HTTP |

For remote hosting, use an HTTPS reverse proxy and set `APP_ORIGIN` and `COOKIE_SECURE=1`. Keep the SQLite file on a persistent volume and use a single application process. Configure proxy-level rate limits if the application is accessed through a proxy. The app uses the immediate connection address for its own limits.

## Source files

- `server.mjs` serves the frontend and JSON API, manages staff sessions, and persists reports using SQLite.
- `public/index.html`, `public/styles.css`, and `public/app.js` implement the interface.
- `public/assets/water.webp` is adapted from the reference repository’s water photo. The bundled Manrope font includes its license.

The app uses standard browser modules and Node.js built-ins. There are no npm packages to install. Existing React/Spring Boot/MySQL records are not imported automatically.
