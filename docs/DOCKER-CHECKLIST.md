# ✅ Docker Build Checklist

Print this out or keep it handy! Follow these steps every time.

---

## 📋 Quick Checklist

### Before Every Commit
- [ ] Run `npm run validate`
- [ ] Fix any errors shown
- [ ] Run validation again until it passes ✅
- [ ] Commit your code

### Before Every Docker Build
- [ ] Run `npm run test:docker`
- [ ] Wait 2-3 minutes for full simulation
- [ ] Confirm you see "✓ Docker build test passed!"
- [ ] Run `docker compose up --build -d`

---

## 🎯 One-Time Setup (Highly Recommended)

- [ ] Run `npm run setup:hooks`
- [ ] Confirm "✓ Git hooks installed" message
- [ ] Now commits are auto-validated!

---

## 🚨 If Docker Build Fails

1. [ ] Don't panic! Run `npm run validate`
2. [ ] Read the error messages carefully
3. [ ] Fix the issues one by one
4. [ ] Run `npm run validate` again
5. [ ] When it passes, run `npm run test:docker`
6. [ ] When that passes, try Docker build again

---

## 📝 Daily Workflow

```
Morning:
├─ git pull
├─ npm install (if package.json changed)
└─ npm run dev

During Development:
├─ Code changes
├─ Test in browser
└─ Repeat

Before Commit:
├─ npm run validate ✅
├─ git add .
└─ git commit -m "message"

Before Docker Build:
├─ npm run test:docker ✅
└─ docker compose up --build -d
```

---

## 💡 Pro Tips

- ✅ Validation passing = Safe to commit
- ✅ Docker test passing = Safe to build
- ⚠️ Yellow warnings = Non-critical, review when you have time
- ❌ Red errors = Must fix before proceeding

---

## 🆘 Emergency Commands

```bash
# Clear everything and start fresh
docker compose down
docker system prune -af
rm -rf .next node_modules
npm install
npm run validate

# Force rebuild without cache
docker compose build --no-cache

# Check what's running
docker compose ps

# View logs
docker compose logs -f
```

---

## 📞 Need Help?

1. Check `DOCKER-BUILD-GUIDE.md` in root directory
2. Check `docs/Documentation/docker-build-validation.md` for full guide
3. Run `npm run validate` to see what's wrong

---

**Remember:** Two quick commands save hours of debugging!
- `npm run validate` (30 seconds)
- `npm run test:docker` (2-3 minutes)

Use them every time! 🎉
