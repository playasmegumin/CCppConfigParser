# C/C++ Config Parser

VSCode扩展，用于解析 Linux Kernel 风格的 `.config` 文件，并自动将宏定义应用到 C/C++ IntelliSense 配置中。

## 功能特性

- 📄 **解析 .config 文件** - 支持 Linux Kernel 风格的配置格式
- 🔄 **自动应用宏定义** - 将 `CONFIG_XXX` 宏转换为 VSCode C_Cpp 配置
- 💾 **配置备份与恢复** - 启用/禁用扩展时自动备份和恢复原始配置
- 👁️ **文件监控** - 可选的文件变化监控，自动重新加载配置
- ⚙️ **配置界面** - 通过 VSCode 设置界面管理配置

## 使用方法

### 1. 安装扩展

从 VSCode Marketplace 安装，或下载 `.vsix` 文件手动安装。

### 2. 配置设置

打开 VSCode 设置 (Ctrl+,)，搜索 "C/C++ Config Parser"：

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| `ccppConfigParser.enabled` | 启用扩展功能 | `false` |
| `ccppConfigParser.configFilePath` | `.config` 文件的绝对路径 | `""` |
| `ccppConfigParser.watchFile` | 监控文件变化并自动更新 | `true` |

### 3. 启用扩展

将 `enabled` 设置为 `true`，扩展会自动：
1. 备份当前的 `C_Cpp.default.defines` 配置
2. 解析指定的 `.config` 文件
3. 将宏定义应用到 IntelliSense

### 4. 禁用扩展

将 `enabled` 设置为 `false`，扩展会自动恢复原始配置。

## 支持的配置格式

```
# 布尔值
CONFIG_FEATURE_A=y           →  CONFIG_FEATURE_A=1
CONFIG_FEATURE_B=m           →  CONFIG_FEATURE_B=1
CONFIG_FEATURE_C=n           →  (跳过)

# "is not set" 格式
# CONFIG_FEATURE_D is not set  →  (跳过)

# 数值
CONFIG_VALUE=123             →  CONFIG_VALUE=123
CONFIG_HEX=0xABCD            →  CONFIG_HEX=0xABCD

# 字符串
CONFIG_STRING="hello"        →  CONFIG_STRING=hello
```

## 命令

按 `Ctrl+Shift+P` 打开命令面板，搜索以下命令：

- **C/C++ Config: 重新加载.config文件** - 手动重新加载配置
- **C/C++ Config: 清除宏定义配置** - 清除并恢复原始配置
- **C/C++ Config: 显示输出日志** - 查看扩展日志

## 开发

### 构建

```bash
npm install
npm run compile
```

### 测试

```bash
npm test
```

### 打包

```bash
npm run package
```

### 发布

```bash
npm run publish
```

## 智能体协作开发

本项目采用双智能体开发模式：

- **Code Generator** - 负责代码生成和功能实现
- **Code Reviewer** - 负责代码审核和质量把控

详见 [AGENT_WORKFLOW.md](./AGENT_WORKFLOW.md)

## 许可证

MIT
