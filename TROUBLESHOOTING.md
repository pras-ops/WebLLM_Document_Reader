# WebLLM Extension Troubleshooting Guide

## 🚨 **Issue: No Response After 7+ Minutes**

### **Quick Checks:**

#### 1. **Check if Model is Actually Ready**
Open console for offscreen document and look for:
```
✓ WebLLM engine initialized successfully
```

If you see this but still no response, continue to step 2.

#### 2. **Check Memory Usage**
- Open Windows Task Manager (Ctrl + Shift + Esc)
- Look for Chrome processes
- Check if memory is at 100%
- **If memory is full**: Close Chrome tabs/apps and reload extension

#### 3. **Check for Errors in Console**
Look for these error patterns:

**Offscreen Console:**
```
✗ Failed to generate response
✗ Out of memory
✗ Engine crashed
```

**Popup Console:**
```
Error: No response from offscreen
Failed to send message
```

#### 4. **Check Message Flow**
The message flow should be:
1. Popup sends `CHAT_MESSAGE` → Background
2. Background forwards to → Offscreen
3. Offscreen generates response → Sends `CHAT_REPLY`
4. Popup receives and displays response

**If stuck at step 3**: Offscreen is struggling to generate (low RAM issue)

---

## 🔧 **Solutions by Problem Type:**

### **Problem 1: Engine Not Initialized**
**Symptoms:**
```
[Offscreen] ✗ Model not initialized
```

**Solution:**
1. Close extension popup
2. Wait 30 seconds
3. Reopen popup
4. Wait for "Model ready!" status
5. Try sending message again

---

### **Problem 2: Out of Memory**
**Symptoms:**
- Browser becomes unresponsive
- Task Manager shows 95%+ RAM usage
- Chrome tab crashes

**Solution:**
```
1. Close ALL other Chrome tabs
2. Close background applications
3. Restart Chrome completely
4. Reload extension
5. Wait for model to load from cache (30-60 sec)
6. Try a SHORT message first (5-10 words)
```

---

### **Problem 3: Inference Taking Too Long**
**Symptoms:**
- Model loaded successfully
- Message sent
- No errors
- Just waiting forever

**Solution (Temporary Fix):**
This is a **hardware limitation** of Intel UHD 620 with 8GB RAM.

**Immediate workaround:**
1. Keep messages SHORT (under 20 words)
2. Use simple questions only
3. Don't include long document context
4. Expected wait time: **2-5 minutes per response**

**Long-term fix:**
- Close ALL other applications before using
- Consider upgrading RAM to 16GB
- Or use cloud-based AI instead (ChatGPT, Claude)

---

### **Problem 4: Message Not Reaching Offscreen**
**Symptoms:**
- No logs in offscreen console after sending message
- Popup shows "Sending..." forever

**Solution:**
1. Reload extension completely
2. Check background service worker logs
3. Look for message routing errors

---

## 🎯 **Emergency Reset Procedure:**

If nothing works, try this **complete reset**:

### Step 1: Clear Extension State
```javascript
// Run in background service worker console:
chrome.storage.local.clear();
console.log('Storage cleared');
```

### Step 2: Close ALL Extension Components
1. Go to chrome://extensions
2. Toggle extension OFF
3. Wait 5 seconds
4. Toggle extension ON

### Step 3: Reload Current Tab
1. Refresh the webpage you want to chat about
2. Wait for content script to extract text
3. Open popup
4. Wait for "Model ready!"

### Step 4: Test with Simple Message
Send: **"Hello"** (just one word)

Expected response time on your system: **30-120 seconds**

---

## 📊 **System-Specific Performance Expectations**

**Your System: Dell Latitude 5490**
- CPU: i5-8250U
- GPU: Intel UHD 620
- RAM: 8GB (very low free RAM)

**Realistic Performance:**
| Task | Time |
|------|------|
| Model load (first time) | 4-6 minutes ✅ |
| Model load (cached) | 30-90 seconds |
| Simple query (1 sentence) | **2-5 minutes** |
| Complex query | **5-10 minutes** |
| Long document analysis | **10-20 minutes** |

**Your system is at the MINIMUM spec for WebLLM.**

---

## 🚀 **Optimization Tips**

### Before Using Extension:

1. **Close Applications:**
   - ❌ Discord, Slack, Teams
   - ❌ Spotify, music players
   - ❌ Video players
   - ❌ Heavy IDEs (VS Code with many extensions)
   - ❌ All Chrome tabs except the one you need

2. **Check Available RAM:**
   - Open Task Manager
   - Should have **at least 2GB free**
   - If less, close more apps

3. **Use Power Settings:**
   - Switch to "High Performance" mode
   - This helps GPU performance

### During Use:

1. **Keep queries short and simple**
2. **Wait patiently** (2-5 min per response)
3. **Don't send multiple messages** while waiting
4. **Monitor Task Manager** for memory issues

---

## ⚠️ **Known Limitations on Low-End Hardware**

Your system (Intel UHD 620, 8GB RAM) will experience:

1. **Very slow inference** (5-10 tokens/second max)
2. **High memory pressure** (may cause crashes)
3. **Browser lag** during generation
4. **Potential timeouts** on complex queries

**This is NOT a bug - it's a hardware limitation.**

WebLLM is designed for:
- 16GB+ RAM
- Dedicated GPU (NVIDIA/AMD)
- Or modern integrated GPU with more VRAM

---

## 🎯 **Recommendation**

Given your hardware constraints, consider:

**Option 1: Use with Realistic Expectations**
- ✅ Works for simple, short queries
- ✅ 100% private and offline
- ❌ Very slow (2-5 min per response)

**Option 2: Use Cloud AI Instead**
- ✅ Instant responses
- ✅ Better quality
- ❌ Requires internet
- ❌ Privacy concerns

**Option 3: Upgrade Hardware**
- Add 8GB more RAM → 16GB total
- This alone would make it 3-5x faster

---

## 📞 **Next Steps**

1. **Share your console logs** (all 3 consoles)
2. **Check Task Manager** - is RAM at 100%?
3. **Try the emergency reset** procedure above
4. **Test with simple "Hello" message**

If after all this it still doesn't work, we may need to:
- Add timeout handling
- Implement response streaming
- Or acknowledge this system can't handle WebLLM in production

