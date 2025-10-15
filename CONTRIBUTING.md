# Contributing to WebLLM Document Chat

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

---

## 🎯 **How Can I Contribute?**

### **Reporting Bugs**
- Use the [GitHub Issues](../../issues) page
- Check if the bug has already been reported
- Include detailed steps to reproduce
- Provide your system specs (OS, Chrome version, GPU, RAM)
- Include console logs from offscreen.html

### **Suggesting Features**
- Open a [GitHub Discussion](../../discussions) first
- Explain the use case and benefits
- Consider implementation complexity
- Check if it aligns with project goals

### **Code Contributions**
- Fork the repository
- Create a feature branch
- Make your changes
- Test thoroughly
- Submit a pull request

---

## 🛠 **Development Setup**

### **Prerequisites**
```bash
# Node.js 18+ and npm
node --version  # Should be 18.x or higher
npm --version

# Chrome/Edge browser with WebGPU support
# Enable chrome://flags/#enable-unsafe-webgpu
```

### **Getting Started**
```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/webllm-doc-chat.git
cd webllm-doc-chat

# Install dependencies
npm install

# Start development build
npm run dev

# In another terminal, run type checking
npm run type-check
```

### **Load Extension in Chrome**
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder
5. Make changes and reload extension to test

---

## 📝 **Coding Guidelines**

### **TypeScript**
- Use strict TypeScript types
- Avoid `any` type where possible
- Document complex type definitions
- Use interfaces for message types

### **Code Style**
- Follow existing code formatting
- Use meaningful variable names
- Add comments for complex logic
- Keep functions focused and small

### **File Organization**
```
src/
├── background/    # Background service worker
├── content/       # Content scripts
├── popup/         # Popup UI
├── offscreen/     # WebLLM integration
└── shared/        # Shared utilities and types
```

### **Example: Adding a New Feature**

```typescript
// src/shared/types.ts
export interface NewFeatureMessage extends ExtensionMessage {
  type: 'NEW_FEATURE';
  payload: {
    // Define your payload type
  };
}

// src/background/background.ts
case 'NEW_FEATURE':
  await this.handleNewFeature(message as NewFeatureMessage);
  break;

// Add handler method
private async handleNewFeature(message: NewFeatureMessage): Promise<void> {
  // Implementation
}
```

---

## ✅ **Testing Guidelines**

### **Manual Testing Checklist**
- [ ] Test on minimum hardware specs (8GB RAM, integrated GPU)
- [ ] Test on recommended hardware specs (16GB+, dedicated GPU)
- [ ] Test first-time model download
- [ ] Test cached model loading
- [ ] Test with various document types
- [ ] Test error handling (no internet, low memory)
- [ ] Check console for errors (all 3 contexts)

### **Performance Testing**
- Monitor memory usage during operation
- Check model loading time
- Measure response generation time
- Test with multiple tabs open

---

## 📋 **Pull Request Process**

### **Before Submitting**
1. **Build successfully**: `npm run build`
2. **Type check passes**: `npm run type-check`
3. **Lint passes**: `npm run lint`
4. **Test manually**: Load extension and verify changes
5. **Update documentation**: Update README.md if needed

### **PR Template**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Performance improvement
- [ ] Documentation update

## Testing
- Tested on: [Hardware specs]
- Manual testing steps: [List steps]
- Screenshots: [If applicable]

## Checklist
- [ ] Code follows project style
- [ ] Self-reviewed code
- [ ] Commented complex code
- [ ] Updated documentation
- [ ] Tested on multiple systems
```

---

## 🎨 **UI/UX Guidelines**

- Keep popup simple and clean
- Provide clear loading indicators
- Show helpful error messages
- Use consistent color scheme
- Ensure accessibility (keyboard navigation, screen readers)

---

## 🐛 **Debugging Tips**

### **Console Locations**
1. **Background**: `chrome://extensions` → "service worker"
2. **Offscreen**: `chrome://extensions` → "offscreen.html"
3. **Popup**: Right-click popup → "Inspect"
4. **Content**: F12 on any webpage

### **Common Issues**
- **WebGPU errors**: Check `chrome://gpu`
- **Message not received**: Check message routing in background
- **Model not loading**: Check offscreen console
- **No response**: Check memory usage in Task Manager

---

## 📚 **Resources**

- [WebLLM Documentation](https://github.com/mlc-ai/web-llm)
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

## 🤝 **Community**

- Be respectful and constructive
- Help others in discussions
- Share your testing results
- Report both bugs AND successes

---

## 📄 **License**

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to WebLLM Document Chat!** 🎉

