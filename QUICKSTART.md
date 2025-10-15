# ⚡ Quick Start Guide

## Install & Run in 5 Minutes

### 1️⃣ Install Extension

```bash
# In the project folder
npm install
npm run build
```

### 2️⃣ Load in Chrome

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (top-right toggle)
4. Click "Load unpacked"
5. Select the `dist` folder
6. Done! ✅

### 3️⃣ Test It

1. Visit: https://en.wikipedia.org/wiki/Artificial_intelligence
2. Click the extension icon (purple)
3. Wait for "Model ready!" (~20-30 seconds, or longer on first use)
4. Type: "What is this article about?"
5. Press Enter
6. Get your answer! 🎉

## First Time Setup

**⏱️ First use downloads a 2-4GB AI model**
- This happens automatically
- Takes 5-15 minutes depending on internet speed
- Only happens once - then cached

## Quick Tips

✅ **Works on**: News sites, blogs, Wikipedia, documentation  
✅ **Best for**: Articles with 500+ words  
✅ **Ask**: Summaries, explanations, questions about content  

❌ **Won't work on**: PDFs (coming in Phase 2)  
❌ **Needs**: Chrome 113+, 4GB+ RAM, WebGPU  

## Troubleshooting

**Extension won't load?**
- Check Chrome version: Must be 113+
- Reload the extension at `chrome://extensions/`

**Model won't download?**
- Check internet connection
- Need 6GB+ free disk space
- Check browser console for errors

**Slow or no response?**
- Verify WebGPU works: Visit `chrome://gpu`
- Close other tabs to free RAM
- Try a simpler question first

## What's Next?

- 📖 Read [README.md](README.md) for full documentation
- 🧪 See [TESTING.md](TESTING.md) for detailed testing
- 🐛 Report issues on GitHub

---

**Made with ❤️ using WebLLM**

