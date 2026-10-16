# Running via GitHub Codespaces (No Local Install Needed)

This lets each group member run the full app — backend, frontend, and database — entirely in the browser, with **nothing installed on their own PC**. Node.js, MySQL, everything runs in a temporary cloud computer that GitHub gives them for free.

This project already includes a `.devcontainer/` folder that sets all of this up automatically.

---

## Part 1: You — Push the Project to GitHub (do this once)

1. Go to [github.com](https://github.com) and log in (create a free account if you don't have one).
2. Click the **`+`** icon (top-right) → **New repository**.
3. Name it something like `freightsync`, keep it **Private** (so only your group can see it) or Public if you don't mind, then click **Create repository**.
4. On the new repo's page, GitHub shows you commands under "…or push an existing repository from the command line." You'll need to run these from inside your `freightsync` project folder. In VS Code, open a terminal in your project folder and run (replace the URL with the one YOUR repo page shows you):
```
git init
git add .
git commit -m "Initial commit - FreightSync"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/freightsync.git
git push -u origin main
```
(If `git` isn't recognized, install it from [git-scm.com](https://git-scm.com) first, then reopen your terminal.)

5. Refresh your repo's page on GitHub — you should now see all your project files listed there.

## Part 2: Add Your Members (so they can access it)

1. On your repo's GitHub page, click **Settings** → **Collaborators** (left sidebar).
2. Click **Add people**, and type each member's GitHub username or email.
3. They'll get an email/notification invite — they need to accept it.

*(If your repo is Public, you can skip this — anyone can view it, though only collaborators can push changes.)*

---

## Part 3: Each Member — Open Their Own Codespace

Each member does this on their own GitHub account:

1. Go to the repo page on GitHub (you'll send them the link).
2. Click the green **`<> Code`** button.
3. Click the **Codespaces** tab (next to "Local").
4. Click **Create codespace on main**.
5. Wait — a browser tab opens showing VS Code, and it automatically starts installing everything (Node packages, MySQL, sample data). This takes **2–4 minutes** the first time. You'll see a terminal at the bottom running the setup script — let it finish.

## Part 4: Start the App

Once setup finishes (you'll see "=== Setup complete! ===" in the terminal):

1. In that terminal, run:
```
cd backend && npm run dev
```
Wait for: `FreightSync API running on http://localhost:4000`

2. Click the **`+`** icon in the terminal panel to open a **second terminal**, then run:
```
cd frontend && npx serve .
```

3. A small popup should appear in the bottom-right saying a port was forwarded — click **"Open in Browser."** (If you miss the popup, click the **"Ports"** tab next to the terminal, find port `3000`, and click the little globe/link icon next to it.)

4. This opens the login page in a new browser tab, with a real `https://...app.github.dev` address — that's your live Codespace running the app.

## Part 5: Log In

| Username | Role | Password |
|---|---|---|
| admin | Administrator | Password123! |
| lmanager | Logistics Manager | Password123! |
| rplanner | Route Planner | Password123! |
| opscoord | Operations Coordinator | Password123! |
| spadmin1 | Service Provider Admin | Password123! |

---

## Good to Know

- **Each member's Codespace is separate** — same as running locally, everyone gets their own database with their own data (matches the "independent copies" setup you asked for).
- **Free usage:** GitHub gives every personal account 120 free core-hours/month (~60 hours on the default 2-core machine). Fine for occasional use; if you leave Codespaces running/idle a lot across the month, you could use it up. Codespaces auto-stop after 30 minutes of inactivity by default.
- **Closing the tab doesn't delete your work.** Your Codespace and its data stay saved. Next time, go to the repo → Codespaces tab → click your existing Codespace to resume it (don't create a new one each time, or you'll have to re-run setup and lose previous data).
- **To fully delete a Codespace** (e.g. to free up storage quota): repo → Codespaces tab → find it in "Your codespaces" → click `...` → Delete.
- If setup.sh fails partway (e.g. a network hiccup), you can re-run it manually from the terminal:
```
bash .devcontainer/setup.sh
```
