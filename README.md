# Ledger — Deployment Guide

Follow these steps in order. Each step has screenshots described so you know exactly what to look for.

---

## Step 1 — Create a GitHub Account (if you don't have one)

1. Go to https://github.com
2. Click **Sign up**
3. Enter your email, create a password, choose a username
4. Verify your email

---

## Step 2 — Create a New GitHub Repository

1. Once logged in, click the **+** icon (top right) → **New repository**
2. Name it: `ledger`
3. Set it to **Private**
4. Click **Create repository**
5. Leave the page open — you'll need the repo URL in Step 4

---

## Step 3 — Install Git (if not already installed)

**Windows:** Download from https://git-scm.com/download/win → install with defaults  
**Mac:** Open Terminal, type `git --version` — if not found, it prompts you to install  
**Linux:** `sudo apt install git`

Verify it works:
```
git --version
```

---

## Step 4 — Upload the Project to GitHub

Open your terminal (or Git Bash on Windows) and run these commands one by one:

```bash
# 1. Go into the ledger folder you downloaded
cd path/to/ledger

# 2. Initialize git
git init

# 3. Add all files
git add .

# 4. First commit
git commit -m "Initial commit"

# 5. Connect to your GitHub repo (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/ledger.git

# 6. Push the code
git branch -M main
git push -u origin main
```

When prompted, enter your GitHub username and password.  
> ⚠️ GitHub no longer accepts passwords — you need a **Personal Access Token**.  
> Go to GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic) → Generate new token → check `repo` → copy the token and use it as your password.

---

## Step 5 — Create a Free Database on Neon

1. Go to https://neon.tech and click **Sign Up** (you can use your GitHub account)
2. Click **New Project**
3. Name it `ledger`, choose the region closest to you
4. Click **Create Project**
5. On the dashboard, find **Connection string** — it looks like:
   ```
   postgresql://username:password@ep-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```
6. **Copy this string** — you'll need it in the next step

---

## Step 6 — Deploy to Vercel

1. Go to https://vercel.com and log in (you already have an account ✅)
2. Click **Add New** → **Project**
3. Click **Import Git Repository** → connect your GitHub account if not connected
4. Select the `ledger` repository → click **Import**
5. On the configuration screen:
   - Framework Preset: **Other**
   - Root Directory: leave as `/`
6. Open **Environment Variables** section and add:
   - Name: `DATABASE_URL`
   - Value: paste the Neon connection string from Step 5
7. Click **Deploy**
8. Wait ~1 minute — Vercel builds and deploys your app
9. You'll get a URL like: `https://ledger-yourname.vercel.app`

**That's your app — open it on any device, it works everywhere!**

---

## Step 7 — Bookmark on Mobile

**iPhone (Safari):**
1. Open your Vercel URL in Safari
2. Tap the Share button (box with arrow)
3. Tap **Add to Home Screen**
4. Tap **Add**

**Android (Chrome):**
1. Open your Vercel URL in Chrome
2. Tap the 3-dot menu
3. Tap **Add to Home screen**

It'll appear as an app icon on your home screen.

---

## Making Updates Later

If you ever want to update the app (change currency, add categories, etc.):

```bash
# Make your changes to the files, then:
git add .
git commit -m "describe your change"
git push
```

Vercel automatically redeploys within 30 seconds.

---

## Folder Structure

```
ledger/
├── api/
│   └── index.js        ← Backend API (Node.js + Express)
├── public/
│   └── index.html      ← Frontend (the app UI)
├── package.json        ← Dependencies
├── vercel.json         ← Vercel routing config
├── .env.example        ← Template for environment variables
└── .gitignore          ← Prevents secrets from being uploaded
```

## How the Database Works

Two tables are created automatically on first run:

**expenses** — stores each expense entry
| Column | Type | Example |
|--------|------|---------|
| id | text | "abc123" |
| amount | numeric | 450.00 |
| category | text | "food" |
| notes | text | "Lunch at cafe" |
| date | date | 2025-04-07 |
| month | text | "2025-04" |

**income** — stores each income entry  
| Column | Type | Example |
|--------|------|---------|
| id | text | "xyz789" |
| amount | numeric | 85000 |
| source | text | "Salary" |
| notes | text | "April paycheck" |
| date | date | 2025-04-01 |
| month | text | "2025-04" |

No setup needed — tables are created automatically when the app first runs.
