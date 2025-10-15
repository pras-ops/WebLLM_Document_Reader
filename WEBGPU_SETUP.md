# 🎮 WebGPU Setup Guide - Fix GPU Detection Issues

## ✅ Progress So Far

- ✅ CSP Error: **FIXED**
- ⚠️ WebGPU Error: **Need to enable WebGPU**

---

## 🔧 Quick Fix (Most Common Solution)

### **Enable WebGPU in Chrome Flags**

1. **Open Chrome Flags:**
   ```
   chrome://flags
   ```

2. **Search for:** `webgpu`

3. **Enable these flags:**
   - `#enable-unsafe-webgpu` → Set to **Enabled**
   - `#enable-webgpu-developer-features` → Set to **Enabled** (optional)

4. **Click "Relaunch"** button at bottom

5. **Reload extension** at `chrome://extensions/`

6. **Test again!**

---

## 🧪 Check WebGPU Status

### **Step 1: Check GPU Information**

Visit: `chrome://gpu`

**Look for:**
```
Graphics Feature Status
WebGPU: Hardware accelerated
```

**If you see:**
- ✅ "Hardware accelerated" → Good! WebGPU works
- ❌ "Disabled" → Need to enable flags (see above)
- ❌ "Software only" → GPU not detected
- ❌ "Unavailable" → Need to enable flags

### **Step 2: Test WebGPU Support**

Visit: https://webgpureport.org/

**You should see:**
- ✅ Green checkmark = WebGPU available
- ❌ Red X = WebGPU not available

---

## 🔍 Detailed Solutions

### **Solution 1: Enable Hardware Acceleration**

1. Open Chrome Settings: `chrome://settings/`
2. Search for: "hardware acceleration"
3. Enable: "Use hardware acceleration when available"
4. Restart Chrome
5. Check `chrome://gpu` again

### **Solution 2: Update Chrome**

1. Go to: `chrome://settings/help`
2. Chrome will check for updates
3. Update to latest version (need 113+)
4. Restart Chrome

### **Solution 3: Update Graphics Drivers**

**Windows:**
1. Open Device Manager
2. Expand "Display adapters"
3. Right-click your GPU
4. Select "Update driver"
5. Restart computer

**Check GPU:** Press `Win + R`, type `dxdiag`, press Enter

### **Solution 4: Enable Windows Graphics Settings**

1. Open Settings → System → Display
2. Scroll down → Graphics settings
3. Add Chrome.exe
4. Set to "High performance"
5. Restart Chrome

---

## 🖥️ System Requirements

### **Minimum Requirements:**

| Component | Requirement |
|-----------|-------------|
| **Chrome Version** | 113 or higher |
| **RAM** | 4GB minimum, 8GB recommended |
| **GPU** | Any modern GPU (Intel HD, NVIDIA, AMD) |
| **OS** | Windows 10/11, macOS 10.15+, Linux |

### **Check Your System:**

1. **Chrome Version:**
   - Visit: `chrome://version`
   - Should be 113 or higher

2. **RAM:**
   - Windows: Task Manager → Performance
   - Need 4GB+ free

3. **GPU:**
   - Windows: Task Manager → Performance → GPU
   - Should show a GPU listed

---

## 🆘 If WebGPU Still Doesn't Work

### **Option 1: Try CPU Fallback (Slower)**

The extension now includes a WASM fallback that runs on CPU:

1. Reload the extension
2. It will automatically try WASM if WebGPU fails
3. Status will show: "Using CPU fallback..."
4. ⚠️ **Much slower** but works without GPU

**Performance with CPU:**
- Model load: 1-3 minutes (vs 20-30 seconds)
- Response time: 30-60 seconds (vs 5-10 seconds)
- Still works! Just slower

### **Option 2: Use Different Browser**

Try Microsoft Edge (Chromium-based):
1. Download Edge: https://www.microsoft.com/edge
2. Install extension in Edge
3. Edge often has better GPU support

### **Option 3: Check If You Have a GPU**

**Windows - Check Device Manager:**
```
1. Win + X → Device Manager
2. Expand "Display adapters"
3. You should see:
   - Intel HD Graphics (built-in)
   - NVIDIA GeForce (dedicated)
   - AMD Radeon (dedicated)
```

**If NO GPU listed:**
- Your device might not have a GPU
- CPU fallback will be used automatically
- Extension will work but slower

---

## 🎯 Step-by-Step Troubleshooting

### **1. First, Try This (90% Success Rate):**

```
1. chrome://flags
2. Search: webgpu
3. Enable: #enable-unsafe-webgpu
4. Relaunch Chrome
5. Reload extension
6. Test on Wikipedia
```

### **2. If That Doesn't Work:**

```
1. chrome://settings
2. Search: hardware acceleration
3. Enable it
4. Restart Chrome
5. Test again
```

### **3. If Still Not Working:**

```
1. Check: chrome://gpu
2. Look for WebGPU status
3. Screenshot any errors
4. Visit: webgpureport.org
5. See what it says
```

### **4. Last Resort:**

```
Extension will use CPU fallback automatically
- Slower but works
- No GPU required
- Just wait longer for responses
```

---

## 📊 Expected Console Output (After Fix)

### ✅ **With WebGPU (Fast):**
```
[Offscreen] Attempting to initialize with WebGPU...
[Offscreen] ✓ Using WebGPU backend (fast)
[Offscreen] Progress: 0% - Loading...
[Offscreen] Progress: 100% - Model loaded successfully
[Offscreen] ✓ WebLLM engine initialized successfully
```

### ✅ **With WASM Fallback (Slower but works):**
```
[Offscreen] Attempting to initialize with WebGPU...
[Offscreen] WebGPU not available: [error message]
[Offscreen] Falling back to WASM backend (slower, but works on CPU)...
[Offscreen] ✓ Using WASM backend (CPU-based, slower but compatible)
[Offscreen] Progress: 0% - Loading...
[Offscreen] Progress: 100% - Model loaded successfully
[Offscreen] ✓ WebLLM engine initialized successfully
```

---

## 🧪 Test After Changes

After enabling WebGPU:

1. **Reload extension** at `chrome://extensions/`
2. **Navigate to:** https://en.wikipedia.org/wiki/Artificial_intelligence
3. **Click extension icon**
4. **Watch console:** Should see "Using WebGPU backend (fast)"
5. **Wait for model load** (first time: 5-15 min)
6. **Ask a question**
7. **Get response** (5-10 seconds with GPU, 30-60 with CPU)

---

## 🎮 Common GPU Issues

### **Issue: "Failed to create WebGPU Context Provider"**

**Causes:**
- WebGPU flag not enabled
- Hardware acceleration disabled
- Old graphics drivers

**Solutions:**
1. Enable `#enable-unsafe-webgpu` flag
2. Enable hardware acceleration
3. Update GPU drivers

### **Issue: "WebGPU: Software only, hardware acceleration unavailable"**

**Causes:**
- GPU drivers not installed
- GPU not detected by Chrome
- Running in VM or remote desktop

**Solutions:**
1. Update GPU drivers
2. Enable GPU in BIOS (if disabled)
3. Use CPU fallback (automatic)

### **Issue: Works on Edge but not Chrome**

**Solution:**
- Use Edge! Both are Chromium-based
- Or update Chrome to latest version

---

## ✨ What Changed in Latest Build

### **New Features:**

1. ✅ **Automatic Fallback:**
   - Tries WebGPU first
   - Falls back to WASM (CPU) if GPU unavailable
   - Works on any system!

2. ✅ **Better Error Messages:**
   - Clear logs about which backend is used
   - Helpful troubleshooting tips
   - Progress indicators

3. ✅ **Works Without GPU:**
   - CPU fallback is automatic
   - No manual configuration needed
   - Just slower, but functional

---

## 🚀 Quick Start (TL;DR)

```bash
# Enable WebGPU
1. chrome://flags → #enable-unsafe-webgpu → Enable → Relaunch

# Reload Extension
2. chrome://extensions → Find extension → Reload

# Test
3. Visit any webpage → Click extension icon → Wait for model

# If slow:
- Extension is using CPU fallback (works, just slower)
- Or wait for GPU to enable properly
```

---

## 📞 Still Need Help?

### **Gather This Info:**

1. Chrome version: `chrome://version`
2. GPU status: `chrome://gpu`
3. WebGPU test: https://webgpureport.org/
4. Console errors: Right-click extension → Inspect
5. Your OS: Windows/Mac/Linux

### **Common Fixes Summary:**

| Issue | Fix |
|-------|-----|
| WebGPU disabled | Enable in `chrome://flags` |
| No GPU detected | Update drivers or use CPU fallback |
| Old Chrome | Update to 113+ |
| Hardware acceleration off | Enable in settings |

---

## ✅ Success Checklist

After following this guide:

- [ ] Chrome version 113+
- [ ] WebGPU flag enabled
- [ ] Hardware acceleration enabled
- [ ] Extension reloaded
- [ ] Tested on a webpage
- [ ] Model loading (or using CPU fallback)
- [ ] Can send/receive messages

---

**The extension now works with OR without WebGPU!**

**With GPU: Fast ⚡**  
**Without GPU: Slower but works 🐢**

---

*Last Updated: After CSP and WebGPU fallback fixes*

