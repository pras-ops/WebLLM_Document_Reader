# 🔐 Fix GitHub Authentication Issue

## ❌ **Current Problem**

```
remote: Permission to pras-ops/WebLLM_Document_Reader.git denied to ajPrashant.
fatal: unable to access 'https://github.com/pras-ops/WebLLM_Document_Reader.git/': The requested URL returned error: 403
```

**Issue**: You're logged in as `ajPrashant` but trying to push to `pras-ops/WebLLM_Document_Reader`.

---

## ✅ **Solutions**

### **Option 1: Use Personal Access Token (Recommended)**

This is the most secure and reliable method.

#### **Step 1: Create Personal Access Token**

1. Go to GitHub: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Give it a name: `WebLLM Document Reader Upload`
4. Set expiration: **90 days** (or your preference)
5. Select scopes:
   - ✅ **repo** (all sub-items)
   - ✅ **workflow** (if using GitHub Actions)
6. Click **"Generate token"**
7. **COPY THE TOKEN** immediately (you won't see it again!)

Example token: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

#### **Step 2: Update Git Remote URL**

```powershell
# Remove current remote
git remote remove origin

# Add remote with token (REPLACE YOUR_TOKEN!)
git remote add origin https://YOUR_TOKEN@github.com/pras-ops/WebLLM_Document_Reader.git

# Verify
git remote -v

# Push to GitHub
git push -u origin main
```

**Replace `YOUR_TOKEN` with the token you just copied!**

---

### **Option 2: Use GitHub CLI (Easiest)**

If you have GitHub CLI installed:

```powershell
# Login to GitHub CLI
gh auth login

# Follow prompts:
# - Select: GitHub.com
# - Select: HTTPS
# - Authenticate with: Login with a web browser
# - Copy the one-time code and press Enter
# - Browser opens, paste code, authorize

# Then push
git push -u origin main
```

Don't have GitHub CLI? Install it: https://cli.github.com/

---

### **Option 3: Use SSH (Advanced)**

If you prefer SSH keys:

```powershell
# Change remote to SSH
git remote remove origin
git remote add origin git@github.com:pras-ops/WebLLM_Document_Reader.git

# If you don't have SSH key set up, follow:
# https://docs.github.com/en/authentication/connecting-to-github-with-ssh
```

---

### **Option 4: Use Git Credential Manager**

Windows usually has this installed:

```powershell
# Clear cached credentials
git credential-manager delete https://github.com

# Try pushing again (will prompt for login)
git push -u origin main
```

A browser window should open for GitHub authentication.

---

## 🎯 **Recommended Solution for You**

**Use Personal Access Token (Option 1)** - It's quick and secure.

### **Quick Steps:**

1. **Create token**: https://github.com/settings/tokens/new
2. **Run these commands** (replace YOUR_TOKEN):

```powershell
git remote remove origin
git remote add origin https://YOUR_TOKEN@github.com/pras-ops/WebLLM_Document_Reader.git
git push -u origin main
```

3. **Done!** Your code will be on GitHub.

---

## ⚠️ **Security Tips**

### **DO:**
- ✅ Store token in a password manager
- ✅ Set token expiration (not "No expiration")
- ✅ Use minimal necessary scopes
- ✅ Delete token after use if it's one-time

### **DON'T:**
- ❌ Share your token publicly
- ❌ Commit token to code
- ❌ Use token in multiple places
- ❌ Keep unused tokens active

---

## 🔄 **Alternative: Push from Different Account**

If you want to use `ajPrashant` account instead:

1. **Transfer repository** to `ajPrashant`:
   - Go to repository settings
   - Scroll to "Danger Zone"
   - Click "Transfer ownership"
   - Transfer to `ajPrashant`

2. **Or create new repository** under `ajPrashant`:
   ```powershell
   # Create at: https://github.com/new
   # Name it: webllm-doc-chat
   
   # Update remote
   git remote remove origin
   git remote add origin https://github.com/ajPrashant/webllm-doc-chat.git
   git push -u origin main
   ```

---

## 📝 **After Successful Push**

Once you successfully push, you should see:

```
Enumerating objects: 31, done.
Counting objects: 100% (31/31), done.
Delta compression using up to 8 threads
Compressing objects: 100% (28/28), done.
Writing objects: 100% (31/31), XXX KiB | XXX MiB/s, done.
Total 31 (delta 5), reused 0 (delta 0), pack-reused 0
remote: Resolving deltas: 100% (5/5), done.
To https://github.com/pras-ops/WebLLM_Document_Reader.git
 * [new branch]      main -> main
Branch 'main' set up to track remote branch 'main' from 'origin'.
```

Then visit: **https://github.com/pras-ops/WebLLM_Document_Reader**

You'll see all your files and beautiful README! 🎉

---

## 🆘 **Still Having Issues?**

### **Error: Token Invalid**
- Regenerate token at https://github.com/settings/tokens
- Make sure you selected "repo" scope
- Copy the FULL token (starts with `ghp_`)

### **Error: 403 Still**
- Make sure you're the owner of `pras-ops/WebLLM_Document_Reader`
- Check repository settings → Collaborators
- Try GitHub CLI method instead

### **Error: Repository Not Found**
- Verify repository exists at https://github.com/pras-ops/WebLLM_Document_Reader
- Check repository name spelling
- Make sure repository is not deleted

---

## ✨ **Quick Reference**

```powershell
# Method 1: Personal Access Token
git remote remove origin
git remote add origin https://YOUR_TOKEN@github.com/pras-ops/WebLLM_Document_Reader.git
git push -u origin main

# Method 2: GitHub CLI
gh auth login
git push -u origin main

# Method 3: Credential Manager (Windows)
git credential-manager delete https://github.com
git push -u origin main
```

---

**Choose your method and push your amazing project to GitHub!** 🚀

