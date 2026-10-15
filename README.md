# QueryScope

QueryScope is a single-user keyword-discovery MVP. It sends a seed through Google Autocomplete via Microlink and displays only returned suggestions. Autocomplete suggestions are not a complete inventory of Google searches and do not include volume, CPC, or keyword difficulty.

## Setup

1. Copy `.env.example` to `.env` and set `MICROLINK_API_KEY` locally. Never commit `.env`.
2. Install dependencies with `npm install`.

## Commands

```powershell
# Start the web app at http://localhost:3000
npm run dev

# Production build and server
npm run build
npm run start

# Offline unit tests (no .env or live requests)
npm test

# Separate authenticated Microlink integration test
npm run test:integration

# One live autocomplete request for chipotle menu
npm run test:live -- --country us

# A-Z live discovery runner (maximum 25 engine requests)
npm run discover:alphabet -- --country us --max-requests 25
```

The web form only starts discovery after **Discover Keywords** is clicked. The current provider localizes by country; the language selector is recorded but cannot be enforced by the provider.

## Deploy with GitHub and Vercel

This application must be deployed as a Next.js server application. Do **not** use a static export: `/api/discover` requires a server-side route and `MICROLINK_API_KEY` must remain in the deployment environment.

### 1. Push the project to GitHub

Confirm that `.env` and every `.env.*` file remain untracked. Only `.env.example` is safe to commit.

```powershell
git init
git add .gitignore .env.example README.md package.json package-lock.json app components src scripts test docs postcss.config.mjs tsconfig.json next-env.d.ts
git commit -m "Prepare QueryScope for Vercel"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USER/queryscope.git
git push -u origin main
```

If this folder is already a Git repository, skip `git init`; if `origin` already exists, use `git remote set-url origin ...` rather than adding it again. Before pushing, run `git status --short` and confirm no `.env` file appears.

### 2. Import the repository in Vercel

1. In the Vercel dashboard, select **New Project** and import the GitHub repository.
2. Keep the framework preset as **Next.js** and the root directory as the repository root.
3. Keep the default install command (`npm install`) and build command (`npm run build`). Do not set an output directory or static-export setting.
4. Before deploying, open **Project Settings → Environment Variables** and add `MICROLINK_API_KEY` with the Microlink key value. Select **Production**, and select **Preview** too if preview deployments should be able to make discovery requests.
5. Optionally add `KEYWORD_DISCOVERY_MAX_REQUESTS` if you want a provider-level process budget different from the local default of `20`.
6. Click **Deploy**. Future pushes create deployments automatically; `main` is normally the production branch.

`MICROLINK_API_KEY` is intentionally not prefixed with `NEXT_PUBLIC_`, so Next.js does not expose it to browser code. It is read only by the server-side Microlink provider used from the API route.
