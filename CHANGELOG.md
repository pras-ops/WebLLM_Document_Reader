# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2025-10-15

### 🎉 **Initial Release - Phase 1 Complete**

#### ✅ Added
- **Core Extension Structure**
  - Chrome Extension Manifest V3 implementation
  - Background service worker for message routing
  - Popup UI for chat interface
  - Content script for automatic page text extraction
  - Offscreen document for WebLLM processing

- **WebLLM Integration**
  - WebGPU-accelerated LLM inference
  - Llama-3.2-3B-Instruct model support
  - Model caching for faster subsequent loads
  - Progress indicators during model download

- **Chat Functionality**
  - Basic question-answering about web pages
  - Context-aware responses
  - Document text extraction
  - Simple chat interface

- **Content Security Policy**
  - Added `wasm-unsafe-eval` for WebAssembly support
  - Proper CSP configuration for Chrome extensions

- **Build System**
  - Webpack configuration for TypeScript
  - Development and production builds
  - TypeScript strict mode
  - ESLint configuration

#### 🔧 Fixed
- TypeScript compilation errors (TS2694, TS2339, TS2564)
- Content Security Policy violation for WebAssembly
- WebGPU initialization on Windows systems
- Message routing between extension components
- Offscreen document creation and lifecycle

#### 📚 Documentation
- Comprehensive README.md
- WebGPU setup guide (WEBGPU_SETUP.md)
- CSP fix documentation (CSP_FIX.md)
- Troubleshooting guide (TROUBLESHOOTING.md)
- Quick start guide (QUICKSTART.md)

#### ⚡ Performance
- Model caching reduces reload time from 4+ minutes to 13 seconds
- WebGPU acceleration for faster inference
- Optimized message passing between components

#### 🐛 Known Issues
- Response generation slow on low-end hardware (2-5 minutes)
- No response streaming (responses appear all at once)
- Limited to 8GB+ RAM systems
- Requires WebGPU support (Chrome 113+)

#### 🎯 Testing
- Tested on Windows 11 with Intel UHD 620
- Tested on systems with 8GB RAM
- Verified WebGPU initialization and model loading
- Confirmed chat functionality works end-to-end

---

## [Unreleased]

### 🚧 **Phase 2: Document Processing** (In Progress)

#### Planned Features
- [ ] PDF.js integration for PDF text extraction
- [ ] File System Access API for local file uploads
- [ ] Text chunking for large documents
- [ ] Basic RAG (Retrieval Augmented Generation)
- [ ] Improved context management

### 🔮 **Phase 3: Enhanced UX** (Planned)

#### Planned Features
- [ ] Response streaming (show text as it generates)
- [ ] Model management UI (switch between models)
- [ ] Chat history persistence (IndexedDB)
- [ ] Better loading indicators
- [ ] Improved error handling and user feedback
- [ ] Settings page

### 💡 **Phase 4: Advanced Features** (Future)

#### Planned Features
- [ ] Multiple model support (1B, 3B, 7B variants)
- [ ] Custom prompt templates
- [ ] Export/import chat history
- [ ] Performance analytics dashboard
- [ ] Context window optimization

---

## Version History

### Version Numbering
- **MAJOR**: Incompatible API changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Schedule
- **Phase 1**: Foundation (Released 2025-10-15)
- **Phase 2**: Document Processing (Target: 2025-11-15)
- **Phase 3**: Enhanced UX (Target: 2025-12-15)
- **Phase 4**: Advanced Features (Target: 2026-01-15)
- **Phase 5**: Chrome Web Store Launch (Target: 2026-02-15)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute to this project.

---

## Support

For issues and feature requests, please use [GitHub Issues](../../issues).

