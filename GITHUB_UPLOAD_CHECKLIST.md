# Nexus Chat GitHub Upload Checklist

Use this checklist before uploading Nexus Chat to GitHub.

## Safe To Commit

- `src/`
- `server/`
- `shared/`
- `public/`
- `index.html`
- `package.json`
- `package-lock.json`
- `vite.config.js`
- `README.md`
- `LAUNCH_CHECKLIST.md`
- `LAUNCH_CONTENT.md`
- `QUIZORA_STYLE_AUDIT.md`
- `NEXUS_QUIZORA_UI_TRANSLATION_PLAN.md`
- `.env.example`
- `.gitignore`

## Do Not Commit

- `.env`
- Firebase Admin service account JSON files
- Razorpay secrets or webhook secrets
- private keys, certificates, `.pem`, `.p12`, `.pfx`, `.key`
- `node_modules/`
- `dist/`
- logs, local cache, local databases

## Before First Push

```bash
npm install
npm run build
npm run check
```

## Git Commands

If this folder is not already a git repository:

```bash
git init
git add .
git commit -m "Prepare Nexus Chat for GitHub upload"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

If it is already a git repository:

```bash
git status
git add .
git commit -m "Prepare Nexus Chat for GitHub upload"
git push
```

## Production Notes

- Keep real production values only in the server `.env`, not in GitHub.
- Use `.env.example` as the public template.
- Set `ALLOW_ADMIN_KEY_IN_PRODUCTION=false` unless you intentionally enable and protect that fallback.
- Keep `BILLING_ENABLED=false` until Razorpay live keys and webhook verification are ready.
- Update `CLIENT_ORIGIN` on the VPS to the final HTTPS domain.
