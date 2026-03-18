# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode for development (compiles on file changes)
npm run watch

# Run ESLint
npm run lint

# Run tests
npm run test

# Package extension for distribution
npm run package

# Publish to VSCode Marketplace
npm run publish
```

## Running and Testing the Extension

### Launch from VSCode
- Press `F5` to open a new Extension Development Host window with your extension loaded
- The extension will automatically activate when configuration changes

### Run Tests
- Press `Ctrl+Shift+D` then select "Extension Tests" and press `F5`
- Or run: `npm run test`

## C/C++ Config Parser Extension

This extension parses Linux Kernel style `.config` files and applies macro definitions to VSCode's C/C++ IntelliSense configuration.

### Features
- Parse `.config` files (Linux Kernel style with `CONFIG_XXX=value` format)
- Automatically apply macro defines to `C_Cpp.default.defines`
- File change monitoring with auto-reload
- Enable/disable toggle with automatic backup/restore of original configuration

### Usage

1. **Configure the extension** in VSCode Settings:
   - `ccppConfigParser.enabled` - Enable/disable the extension
   - `ccppConfigParser.configFilePath` - Absolute path to your `.config` file
   - `ccppConfigParser.watchFile` - Watch file for changes (default: true)

2. **Enable the extension** by setting `enabled` to `true`

3. **The extension will**:
   - Parse your `.config` file
   - Convert macros to VSCode defines format
   - Apply to `C_Cpp.default.defines`
   - Monitor file changes if enabled

4. **Disable** to automatically restore your original C_Cpp configuration

### Commands
- `C/C++ Config: 重新加载.config文件` - Manually reload the config file
- `C/C++ Config: 清除宏定义配置` - Clear macros and restore original config
- `C/C++ Config: 显示输出日志` - Show the output channel with logs

### Supported Config Formats
```
CONFIG_FEATURE_A=y           →  CONFIG_FEATURE_A=1
CONFIG_FEATURE_B=m           →  CONFIG_FEATURE_B=1
CONFIG_FEATURE_C=n           →  (skipped)
# CONFIG_FEATURE_D is not set  →  (skipped)
CONFIG_VALUE=123             →  CONFIG_VALUE=123
CONFIG_STRING="hello"        →  CONFIG_STRING=hello
```

## Architecture

### Entry Point
- `src/extension.ts` - Main activation/deactivation logic. Exports `activate()` and `deactivate()` functions called by VSCode.

### Core Modules
```
src/
  core/
    types.ts          - TypeScript interfaces and types
    configParser.ts   - .config file parser
    configManager.ts  - VSCode C_Cpp configuration manager
    index.ts          - Module exports
  extension.ts        - Extension entry point
  test/
    suite/
      configParser.test.ts  - Parser unit tests
      configManager.test.ts - Manager unit tests
```

### Key Concepts
- **Activation Events**: Defined in `package.json` under `activationEvents`. The extension activates when configuration changes.
- **Contribution Points**: Also in `package.json` under `contributes`. Defines commands, menus, settings, etc. that the extension provides.
- **Context Subscriptions**: All disposables (commands, event listeners) must be pushed to `context.subscriptions` for proper cleanup on deactivation.

### Extension Lifecycle
- `activate(context)` - Called when the extension is first activated. Use for setup, registering commands, and initializing state.
- `deactivate()` - Called when the extension is deactivated. Clean up resources here, though most cleanup should be handled via `context.subscriptions`.

### Configuration Management Flow
1. User enables extension → `backupOriginalDefines()` → `loadAndApplyConfig()`
2. User disables extension → `restoreOriginalDefines()`
3. File changes (if watching) → `loadAndApplyConfig()`

## Configuration Files

- `package.json` - Extension manifest with metadata, activation events, and contribution points
- `tsconfig.json` - TypeScript compiler configuration targeting ES2020, CommonJS modules
- `.eslintrc.json` - ESLint configuration with TypeScript rules
- `.vscode/launch.json` - Debug configurations for running extension and tests
- `.vscode/tasks.json` - Build task configuration for watch mode

## Development Agent Workflow

This project uses a dual-agent development model:

### Code Generator Agent
- Generates core module code (parser, manager, types)
- Implements extension logic and commands
- Writes unit tests

### Code Reviewer Agent
- Reviews generated code for correctness
- Validates VSCode API usage
- Checks security and performance

### Checkpoint Process
1. Generator completes code → Checkpoint: Developer review
2. Reviewer audits code → Checkpoint: Developer approval
3. Tests pass → Checkpoint: Integration complete
