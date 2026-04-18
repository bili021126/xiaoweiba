# Changelog

All notable changes to XiaoWeiba will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-04-18

### 🎉 Major Features

#### Memory-Driven Architecture (Phase 0 Complete)
- **MemorySystem as Central Hub**: All commands now route through MemorySystem for automatic context injection
- **EventBus Integration**: Decoupled module communication via event-driven architecture
- **TaskTokenManager Authorization**: Secure write permission system with 5-minute token expiry and graceful degradation

#### Core Commands (10 Available)
- ✅ `xiaoweiba.explainCode` - Code explanation with memory recording
- ✅ `xiaoweiba.generateCommit` - Git commit message generation with authorization
- ✅ `xiaoweiba.checkNaming` - Variable naming convention checker
- ✅ `xiaoweiba.generateCode` - AI code generation with read-only fallback
- ✅ `xiaoweiba.optimizeSQL` - SQL query optimization
- ✅ `xiaoweiba.configureApiKey` - API key configuration with real connection test
- ✅ `xiaoweiba.exportMemory` - Export episodic memories to JSON
- ✅ `xiaoweiba.importMemory` - Import memories from JSON with deduplication
- ✅ `xiaoweiba.repair-memory` - Database repair utility
- ✅ `xiaoweiba.openChat` - Open AI chat panel

### 🔧 Bug Fixes

- **D4**: Fixed fake API connection test - now performs real LLM API call
- **Export/Import Field Mapping**: Corrected database field name `latency_ms` ↔ `durationMs`
- **TASK_COMPLETED Event Duplication**: Eliminated 16 duplicate event publications across 8 commands
- **Table Name Consistency**: Fixed `episodic_memories` → `episodic_memory` (singular)

### 🏗️ Architecture Improvements

- **BaseCommand Pattern**: Unified command execution with automatic memory context retrieval
- **Constructor Simplification**: Removed dual-constructor pattern from ExplainCodeCommand
- **Command Naming**: Standardized to camelCase (`xiaoweiba.exportMemory` instead of `export-memory`)
- **Dependency Injection**: Consistent tsyringe usage across all modules

### 🧪 Testing

- **Test Suite Recovery**: Restored 52 test files from Git history
- **Mock Factory**: Created `tests/helpers/mockFactory.ts` for unified mocking
- **Core Module Tests**: 
  - BaseCommand: 6/6 tests passing (100%)
  - EpisodicMemory: 7/7 tests passing (100%)
  - MemorySystem: 12/15 tests passing (80%)
- **Overall Coverage**: 89% pass rate (25/28 P1 tests)

### 📊 Performance

- **N+1 Query Optimization**: Batch retrieval for related memories
- **Recursive Call Fix**: Eliminated infinite recursion in memory search
- **Statement Resource Management**: Proper SQL statement cleanup with try-finally

### 📝 Documentation

- Phase 0 implementation reports
- Code review summaries
- Test execution guides
- Security testing documentation

### ⚠️ Known Issues (Deferred to v0.3.1)

- **D1**: Generated code in read-only mode only shows in notification (not easily copyable)
- **D3**: Proactive recommendations lack "dismiss" or "don't show again" option
- **D2**: Diff confirmation Webview lacks line-by-line highlighting
- **D5**: Commit history view is plain text without interactivity
- **D6**: Session title generation is too simple (first 30 chars)

---

## [0.2.1] - Previous Release

- Initial memory system implementation
- Basic command structure
- SQLite integration

---

**Full Commit History**: https://github.com/bili021126/xiaoweiba/commits/dev
