/**
 * C/C++ Config Parser Extension
 *
 * Parses Linux Kernel style .config files and applies macro definitions
 * to VSCode C/C++ IntelliSense configuration.
 */

import * as vscode from 'vscode';
import { ConfigManager } from './core/configManager';

const CONFIG_SECTION = 'ccppConfigParser';

export function activate(context: vscode.ExtensionContext) {
    console.log('C/C++ Config Parser extension is now active!');

    const configManager = new ConfigManager();
    let fileWatcher: vscode.FileSystemWatcher | undefined;

    // Register commands
    const reloadCommand = vscode.commands.registerCommand('ccppConfigParser.reloadConfig', async () => {
        const result = await configManager.reloadConfig();

        if (result.success) {
            vscode.window.showInformationMessage(`已重新加载配置，应用了 ${result.appliedCount} 个宏定义`);
        } else {
            vscode.window.showErrorMessage(`重新加载失败: ${result.error}`);
        }
    });

    const clearCommand = vscode.commands.registerCommand('ccppConfigParser.clearConfig', async () => {
        await configManager.clearConfig();
        vscode.window.showInformationMessage('已清除宏定义配置并恢复原始设置');
    });

    const showOutputCommand = vscode.commands.registerCommand('ccppConfigParser.showOutput', () => {
        configManager.showOutput();
    });

    context.subscriptions.push(reloadCommand, clearCommand, showOutputCommand);

    // Setup file watcher for .config file changes
    function setupFileWatcher(): void {
        // Dispose existing watcher
        if (fileWatcher) {
            fileWatcher.dispose();
            fileWatcher = undefined;
        }

        const config = configManager.getConfig();
        if (!config.enabled || !config.watchFile || !config.configFilePath) {
            return;
        }

        try {
            // Watch the .config file for changes
            fileWatcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(
                    vscode.Uri.file(config.configFilePath),
                    '*'
                ),
                false, // ignoreCreateEvents
                false, // ignoreChangeEvents
                false  // ignoreDeleteEvents
            );

            // Also watch using the full path pattern
            fileWatcher = vscode.workspace.createFileSystemWatcher(config.configFilePath);

            fileWatcher.onDidChange(async () => {
                configManager.log(`检测到配置文件变化: ${config.configFilePath}`);
                const result = await configManager.loadAndApplyConfig();

                if (result.success) {
                    vscode.window.showInformationMessage(
                        `配置文件已更新，应用了 ${result.appliedCount} 个宏定义`,
                        '查看日志'
                    ).then(selection => {
                        if (selection === '查看日志') {
                            configManager.showOutput();
                        }
                    });
                } else {
                    vscode.window.showErrorMessage(`自动更新失败: ${result.error}`);
                }
            });

            fileWatcher.onDidDelete(() => {
                vscode.window.showWarningMessage('配置文件已被删除');
            });

            context.subscriptions.push(fileWatcher);
            configManager.log(`已启动文件监控: ${config.configFilePath}`);
        } catch (error) {
            configManager.log(`启动文件监控失败: ${error}`, true);
        }
    }

    // Handle configuration changes
    const configChangeHandler = vscode.workspace.onDidChangeConfiguration(async (e) => {
        // Handle enabled state changes
        if (e.affectsConfiguration(`${CONFIG_SECTION}.enabled`)) {
            const enabled = configManager.isEnabled();

            if (enabled) {
                // Extension was enabled
                const validation = await configManager.validateConfigFilePath();
                if (!validation.valid) {
                    vscode.window.showWarningMessage(
                        `无法启用扩展: ${validation.error}。请在设置中配置正确的.config文件路径。`,
                        '打开设置'
                    ).then(selection => {
                        if (selection === '打开设置') {
                            vscode.commands.executeCommand('workbench.action.openSettings', CONFIG_SECTION);
                        }
                    });

                    // Disable the extension
                    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
                    await config.update('enabled', false, vscode.ConfigurationTarget.Workspace);
                    return;
                }

                // Load and apply config
                const result = await configManager.loadAndApplyConfig();

                if (result.success) {
                    vscode.window.showInformationMessage(
                        `C/C++ Config Parser 已启用，应用了 ${result.appliedCount} 个宏定义`
                    );

                    // Setup file watcher if enabled
                    setupFileWatcher();
                } else {
                    vscode.window.showErrorMessage(`启用失败: ${result.error}`);

                    // Disable the extension on failure
                    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
                    await config.update('enabled', false, vscode.ConfigurationTarget.Workspace);
                }
            } else {
                // Extension was disabled
                await configManager.clearConfig();

                // Dispose file watcher
                if (fileWatcher) {
                    fileWatcher.dispose();
                    fileWatcher = undefined;
                }

                vscode.window.showInformationMessage('C/C++ Config Parser 已禁用，配置已恢复');
            }
        }

        // Handle config file path changes
        if (e.affectsConfiguration(`${CONFIG_SECTION}.configFilePath`)) {
            const config = configManager.getConfig();

            if (config.enabled && config.configFilePath) {
                // Validate new path
                const validation = await configManager.validateConfigFilePath();
                if (!validation.valid) {
                    vscode.window.showWarningMessage(`配置文件路径无效: ${validation.error}`);
                    return;
                }

                // Reload with new path
                const result = await configManager.loadAndApplyConfig();

                if (result.success) {
                    vscode.window.showInformationMessage(
                        `配置文件路径已更新，应用了 ${result.appliedCount} 个宏定义`
                    );

                    // Restart file watcher with new path
                    setupFileWatcher();
                } else {
                    vscode.window.showErrorMessage(`加载新配置失败: ${result.error}`);
                }
            }
        }

        // Handle watch file setting changes
        if (e.affectsConfiguration(`${CONFIG_SECTION}.watchFile`)) {
            const config = configManager.getConfig();
            if (config.enabled) {
                setupFileWatcher();
                if (config.watchFile) {
                    vscode.window.showInformationMessage('已启用配置文件监控');
                } else {
                    vscode.window.showInformationMessage('已禁用配置文件监控');
                }
            }
        }
    });

    context.subscriptions.push(configChangeHandler);

    // Check initial state and load config if enabled
    async function initialize(): Promise<void> {
        const config = configManager.getConfig();

        if (config.enabled) {
            configManager.log('扩展初始化：检测到已启用状态，正在加载配置...');

            const validation = await configManager.validateConfigFilePath();
            if (!validation.valid) {
                configManager.log(`初始化失败: ${validation.error}`, true);
                vscode.window.showWarningMessage(
                    `C/C++ Config Parser 配置错误: ${validation.error}。扩展将在配置修复后自动生效。`
                );
                return;
            }

            const result = await configManager.loadAndApplyConfig();

            if (result.success) {
                configManager.log(`初始化成功，应用了 ${result.appliedCount} 个宏定义`);
                setupFileWatcher();
            } else {
                configManager.log(`初始化失败: ${result.error}`, true);
            }
        }
    }

    // Run initialization
    initialize();

    // Dispose resources on deactivation
    context.subscriptions.push({
        dispose: () => {
            if (fileWatcher) {
                fileWatcher.dispose();
            }
            configManager.dispose();
        }
    });
}

export function deactivate() {
    console.log('C/C++ Config Parser extension is now deactivated');
}
