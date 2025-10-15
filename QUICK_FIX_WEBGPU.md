# ⚡ QUICK FIX - Enable WebGPU (2 Minutes)

## 🎯 Your Current Issue

```
Error: Unable to find a compatible GPU
Failed to create WebGPU Context Provider
```

**Cause:** WebGPU is disabled in Chrome

---

## ✅ SOLUTION (Follow These Steps)

### **Step 1: Enable WebGPU Flag** (30 seconds)

1. Copy this and paste in Chrome address bar:
   ```
   chrome://flags/#enable-unsafe-webgpu
   ```

2. You'll see a yellow highlighted flag

3. Click the dropdown next to it

4. Select **"Enabled"**

5. Click **"Relaunch"** button (bottom right)

---

### **Step 2: Reload Extension** (10 seconds)

1. After Chrome restarts, go to:
   ```
   chrome://extensions/
   ```

2. Find **"WebLLM Doc Chat"**

3. Click the 🔄 **Reload** button

---

### **Step 3: Test** (1 minute)

1. Visit any webpage (try Wikipedia)

2. Click the extension icon

3. Wait for model to load

4. Ask a question

5. ✅ **Should work now!**

---

## 🎮 Alternative: Check GPU Status

Visit: `chrome://gpu`

**Look for:**
```
Graphics Feature Status
WebGPU: Hardware accelerated ✅
```

**If you see "Disabled":** Do Step 1 above

---

## 🐢 Backup Plan: CPU Fallback

**Good news:** The extension now has automatic CPU fallback!

**If WebGPU still doesn't work:**
- Extension will automatically use CPU
- ⚠️ **Slower** but **works**
- Model load: 2-3 minutes (vs 30 seconds)
- Responses: 30-60 seconds (vs 5-10 seconds)

**Look for this in console:**
```
[Offscreen] WebGPU not available
[Offscreen] Falling back to WASM backend (slower, but works on CPU)...
[Offscreen] ✓ Using WASM backend (CPU-based, slower but compatible)
```

---

## 📊 What to Expect

### With WebGPU (After Fix): ⚡

| Step | Time |
|------|------|
| Model Download (first time) | 5-15 min |
| Model Load (cached) | 20-30 sec |
| Response per question | 5-10 sec |

### With CPU Fallback: 🐢

| Step | Time |
|------|------|
| Model Download (first time) | 5-15 min |
| Model Load (cached) | 1-3 min |
| Response per question | 30-60 sec |

---

## ✅ Quick Checklist

```
☐ 1. Enable chrome://flags/#enable-unsafe-webgpu
☐ 2. Relaunch Chrome
☐ 3. Reload extension at chrome://extensions/
☐ 4. Test on any webpage
☐ 5. Watch for "Using WebGPU backend" or "Using WASM backend"
```

---

## 🎉 Either Way, It Will Work!

- **Best:** Enable WebGPU → Fast responses ⚡
- **Backup:** CPU fallback → Slower but works 🐢

**The extension is smart enough to choose the best option automatically!**

---

## 🔍 Verify It's Working

### **Check Console Logs:**

**Good (WebGPU):**
```
✓ Using WebGPU backend (fast)
```

**Good (CPU Fallback):**
```
✓ Using WASM backend (CPU-based, slower but compatible)
```

**Bad (Still broken):**
```
✗ Failed to initialize WebLLM
```
→ If you see this, check: [WEBGPU_SETUP.md](WEBGPU_SETUP.md)

---

## 🚀 TL;DR

```
1. chrome://flags/#enable-unsafe-webgpu → Enable → Relaunch
2. chrome://extensions/ → Reload extension
3. Test on Wikipedia
4. Done!
```

**Or just use CPU fallback (automatic, slower but works)**

---

## 📞 Need More Help?

See detailed guide: [WEBGPU_SETUP.md](WEBGPU_SETUP.md)

---

**You're almost there! Just enable WebGPU and test again!** 🎯

