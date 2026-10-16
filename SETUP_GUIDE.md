# Setup Guide — Run Your Own Copy (For Group Members)

This walks you through running Module 9 on **your own computer**, step by step. Follow every step in order — don't skip ahead. This assumes **Windows + VS Code**.

---

## Part 1: Install the Tools

1. **Install Node.js** — go to [nodejs.org](https://nodejs.org), download and install the **LTS** version. Just click Next through the installer.
2. **Install MySQL** — download the MySQL Installer from [dev.mysql.com](https://dev.mysql.com/downloads/mysql/). When it asks which products to install, only select:
   - **MySQL Server**
   - **MySQL Workbench**
   (Skip MySQL Shell and MySQL Router — not needed.)
3. During MySQL setup, it will ask you to set a **root password**. Choose something simple you'll remember and write it down — you'll type it several more times.
4. **Install VS Code** if you don't have it — [code.visualstudio.com](https://code.visualstudio.com)

---

## Part 2: Get the Project Files

1. Extract (unzip) the `freightsync.zip` file you were given, anywhere you like (e.g. your Desktop or Downloads folder).
2. Open VS Code.
3. `File → Open Folder…` → select the extracted `freightsync` folder.

---

## Part 3: Set Up the Database

1. Open **MySQL Workbench**.
2. On the home screen, under "MySQL Connections," click the **`+`** icon.
3. Fill in:
   - Connection Name: `Local`
   - Hostname: `127.0.0.1`
   - Port: `3306`
   - Username: `root`
4. Click **Test Connection**, type your root password, confirm it succeeds, click **OK** to save.
5. **Double-click** the "Local" tile to open a connected SQL tab.
6. Go to **File → Open SQL Script…** → select `database/schema.sql` from the project folder → Open.
7. Click anywhere inside the script text, then press **`Ctrl+Shift+Enter`** to run the whole thing.
8. Repeat: **File → Open SQL Script…** → select `database/seed.sql` → Open → click inside it → **`Ctrl+Shift+Enter`**.
9. To confirm it worked: in the left "Schemas" panel, click the refresh icon — you should see a database called `freightsync` with tables inside (routes, tariffs, sops, schedules, users, etc.)

---

## Part 4: Set Up the Backend

1. Back in VS Code, open a terminal: press `` Ctrl+` ``.
2. Make sure you're using **Command Prompt**, not PowerShell (check the dropdown arrow next to the `+` in the terminal panel — pick "Command Prompt" if given a choice).
3. Type:
```
cd backend
```
(If it says path not found, type `dir` first to see what's actually there, and `cd` into whatever folder contains `package.json` and `server.js`.)

4. In the VS Code file explorer sidebar, right-click the `backend` folder → **New File...** → name it exactly:
```
.env
```
5. Paste this into the new empty file:
```
PORT=4000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=freightsync
JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRES_IN=8h
CORS_ORIGIN=*
```
6. Edit these two lines:
   - `DB_PASSWORD=` → put your MySQL root password after the `=`
   - `JWT_SECRET=...` → replace with any random text you make up
7. Save (`Ctrl+S`).
8. Back in the terminal, run these one at a time, waiting for each to finish:
```
npm install
```
```
npm run seed
```
```
npm run dev
```
9. You should see: `FreightSync API running on http://localhost:4000`
10. **Leave this terminal open and running** — don't close it or type anything else in it.

---

## Part 5: Set Up the Frontend

1. Open a **second, separate terminal** (click the `+` icon in the terminal panel — don't reuse the backend one).
2. Type:
```
cd frontend
```
3. Then:
```
npx serve .
```
(If asked "Ok to proceed?", type `y` and Enter.)
4. It will print a URL like `http://localhost:3000`.
5. Open that URL in your web browser.

---

## Part 6: Log In

| Username | Role | Password |
|---|---|---|
| admin | Administrator | Password123! |
| lmanager | Logistics Manager | Password123! |
| rplanner | Route Planner | Password123! |
| opscoord | Operations Coordinator | Password123! |
| spadmin1 | Service Provider Admin | Password123! |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `cd backend` says path not found | Type `dir` to see the actual folder names, and `cd` into the right one (the zip may have extracted one folder deeper than expected) |
| `npm install` / `npm run dev` says "running scripts is disabled" | You're in PowerShell — switch your terminal to **Command Prompt** instead |
| Login page says "Failed to fetch" | Backend terminal isn't running, or `CORS_ORIGIN` in `.env` doesn't match — set it to `CORS_ORIGIN=*` and restart `npm run dev` |
| Login says "Invalid credentials" | Run `npm run seed` again in the backend terminal (accounts may exist but passwords weren't set yet) |
| MySQL Workbench script says "unconnected" | You opened the script before connecting — close it, double-click your "Local" connection tile first, then re-open the script |

If none of these fix it, take a screenshot of the exact error and ask your groupmate (or whoever set this up) for help.
