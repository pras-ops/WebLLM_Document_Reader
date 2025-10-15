# 🧪 Testing Guide - WebLLM Document Chat Extension

## Quick Start Testing

### Step 1: Load the Extension

1. Open Chrome browser
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Navigate to and select the `dist` folder
6. Extension should appear with purple icon

**Expected Result**: Extension loads without errors

### Step 2: Verify Installation

1. Click the extension icon in toolbar (purple gradient icon)
2. A popup window should open (400x500px)
3. Header should show "🤖 WebLLM Doc Chat"

**Expected Result**: Popup opens with gradient header

### Step 3: Test on Simple Webpage

1. Navigate to a text-heavy page, for example:
   - `https://en.wikipedia.org/wiki/Artificial_intelligence`
   - `https://news.ycombinator.com/`
   - Any blog post or article

2. Click the extension icon
3. Watch the status indicator:
   - Should show "Initializing..." 
   - Then "Loading model: X%" with progress
   - Finally "✓ Model ready!"

**Expected Result**: 
- Status updates shown
- Model loads (first time: 5-15 min download)
- Green indicator when ready

### Step 4: Chat Interaction

1. After model is ready, input box should be enabled
2. Type a question, for example:
   - "What is this page about?"
   - "Summarize this article"
   - "What are the main topics?"

3. Click "Send" or press Enter
4. Watch for:
   - Your message appears (purple bubble, right-aligned)
   - "Thinking..." indicator appears
   - AI response appears (white bubble, left-aligned)

**Expected Result**: 
- Question sends successfully
- Response received within 10-30 seconds
- Response relates to page content

## Detailed Test Cases

### Test Case 1: First Installation

**Objective**: Verify fresh installation works

**Steps**:
1. Clear any existing extension data
2. Load extension from `dist` folder
3. Open popup
4. Wait for model download

**Expected**:
- Model downloads automatically
- Progress shown (0% to 100%)
- No errors in console
- Storage shows model cached (~2-4GB)

**Timing**: 2-15 minutes depending on connection

---

### Test Case 2: Page Text Extraction

**Objective**: Verify content script extracts text

**Steps**:
1. Open browser DevTools (F12)
2. Navigate to Wikipedia article
3. Check Console tab
4. Look for content script logs

**Expected**:
- See: "Content script initialized on: [URL]"
- See: "Page text sent to background script"
- No errors

**Debug**: Check `chrome://extensions/` → Errors

---

### Test Case 3: Background Service Worker

**Objective**: Verify background script handles messages

**Steps**:
1. Go to `chrome://extensions/`
2. Find extension
3. Click "service worker" under extension
4. Console should open
5. Navigate to a webpage
6. Open extension popup

**Expected Logs**:
- "Background service worker initialized"
- "Stored document: [Page Title]"
- "Offscreen document created successfully"

---

### Test Case 4: Model Loading

**Objective**: Verify WebLLM initializes correctly

**Steps**:
1. Open extension popup
2. Click "service worker" to see background logs
3. Watch for offscreen document messages
4. Model should load automatically

**Expected Logs**:
- "[Offscreen] Offscreen document loaded"
- "[Offscreen] Starting engine initialization..."
- "[Offscreen] Loading model: Llama-3.2-3B-Instruct-q4f32_1-MLC"
- Progress updates (0% to 100%)
- "[Offscreen] ✓ WebLLM engine initialized successfully"

**Timing**: 
- First time: 5-15 minutes (download)
- Subsequent: 20-30 seconds (load from cache)

---

### Test Case 5: Chat Functionality

**Objective**: Verify Q&A works end-to-end

**Test Questions**:

| Page Type | Sample Question | Expected Response |
|-----------|----------------|-------------------|
| Wikipedia | "Who is this article about?" | Name/subject of article |
| News Article | "What happened?" | Summary of news |
| Blog Post | "What is the main point?" | Key takeaway |
| Product Page | "What does this product do?" | Product description |

**Steps**:
1. Load test page
2. Open popup
3. Wait for ready status
4. Ask question
5. Verify response

**Expected**:
- Response relates to page content
- Response is coherent
- Response time: 5-30 seconds
- No errors

---

### Test Case 6: Error Handling

**Objective**: Verify graceful error handling

**Test Scenarios**:

1. **No Internet (after first load)**
   - Should work offline
   - Model loads from cache
   - Chat functions normally

2. **Empty Page**
   - Navigate to `about:blank`
   - Should show message about insufficient content

3. **Very Long Page**
   - Large article (100KB+ text)
   - Should truncate to 50KB
   - Still function

4. **Rapid Clicks**
   - Click Send multiple times quickly
   - Should queue or disable appropriately

---

## Performance Testing

### Memory Usage Test

**Steps**:
1. Open Chrome Task Manager (Shift+Esc)
2. Load extension
3. Open popup
4. Chat with several pages
5. Monitor memory

**Expected**:
- Initial: ~100-200MB
- Model loaded: +2-4GB
- During chat: +500MB peak
- Should not continuously grow

### Speed Test

**Benchmark Questions**:

| Metric | Target | Acceptable | Fail |
|--------|--------|------------|------|
| Model Load (cached) | <30s | <60s | >120s |
| First Response | <15s | <30s | >60s |
| Subsequent Response | <10s | <20s | >45s |

**Steps**:
1. Load model (measure time)
2. Ask first question (measure time)
3. Ask second question (measure time)
4. Compare to targets

---

## Browser Compatibility

### Chrome Testing

**Versions to Test**:
- Chrome 113 (minimum)
- Chrome 120+ (recommended)
- Chrome Latest

**Steps**:
1. Check `chrome://version`
2. Verify WebGPU at `chrome://gpu`
3. Load extension
4. Run basic tests

### Edge Testing

**Versions to Test**:
- Edge 113+

**Steps**: Same as Chrome

---

## Common Issues & Solutions

### Issue: "WebGPU not available"

**Solution**:
1. Check Chrome version (need 113+)
2. Visit `chrome://gpu`
3. Ensure WebGPU is "Hardware accelerated"
4. If not, try `chrome://flags/#enable-unsafe-webgpu`

### Issue: Model won't download

**Solution**:
1. Check internet connection
2. Check available storage (need 6GB+)
3. Clear browser cache
4. Try different network

### Issue: Popup won't open

**Solution**:
1. Check extension errors at `chrome://extensions/`
2. Reload extension
3. Check browser console for errors

### Issue: No response to questions

**Solution**:
1. Verify model loaded (check status)
2. Check page has content (>100 chars)
3. Look at service worker console for errors
4. Try simpler question

### Issue: Very slow responses

**Solution**:
1. Verify WebGPU enabled (not CPU fallback)
2. Close other tabs (free RAM)
3. Restart browser
4. Check if antivirus is interfering

---

## Debug Checklist

When things don't work, check:

- [ ] Chrome version >= 113
- [ ] Extension loaded without errors
- [ ] Service worker is running
- [ ] Content script injected (check page console)
- [ ] Offscreen document created (check background console)
- [ ] Model downloaded and loaded
- [ ] WebGPU available (`chrome://gpu`)
- [ ] Sufficient RAM available (4GB+)
- [ ] No console errors in any context

---

## Automated Testing (Future)

### Unit Tests (Coming Soon)

```bash
npm run test
```

Will test:
- Text extraction logic
- Message passing
- Prompt building
- Storage operations

### Integration Tests (Planned)

- Extension lifecycle
- Model loading
- End-to-end chat flow

### E2E Tests (Planned)

Using Puppeteer:
- Full user workflows
- Multiple browser scenarios
- Performance benchmarks

---

## Reporting Issues

When reporting bugs, include:

1. **Environment**:
   - Chrome version
   - OS version
   - RAM available
   - GPU model

2. **Steps to Reproduce**:
   - Exact steps taken
   - URL tested (if applicable)
   - Question asked

3. **Console Logs**:
   - Background console
   - Page console
   - Popup console

4. **Screenshots**:
   - Error messages
   - Extension popup
   - Console output

---

## Test Results Template

```
Date: ___________
Tester: ___________
Chrome Version: ___________

Test Case 1: Installation - [ ] Pass [ ] Fail
Test Case 2: Text Extraction - [ ] Pass [ ] Fail  
Test Case 3: Background Worker - [ ] Pass [ ] Fail
Test Case 4: Model Loading - [ ] Pass [ ] Fail
Test Case 5: Chat Functionality - [ ] Pass [ ] Fail
Test Case 6: Error Handling - [ ] Pass [ ] Fail

Performance:
- Model Load Time: _____ seconds
- First Response: _____ seconds
- Memory Usage: _____ MB

Issues Found:
1. ________________
2. ________________
3. ________________

Notes:
________________________________
________________________________
```

---

**Happy Testing! 🧪**

