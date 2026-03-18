/**
 * VSCode C/C++ Configuration Manager
 * Handles backup, restore, and application of macro defines
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { MacroDefine, ExtensionConfig, ApplyResult } from './types';
import { ConfigParser } from './configParser';

const CONFIG_SECTION = 'ccppConfigParser';
const CPP_CONFIG_SECTION = 'C_Cpp';
const DEFINES_KEY = 'default.defines';

export class ConfigManager {
    private parser: ConfigParser;
    private outputChannel: vscode.OutputChannel;

    constructor() {
        this.parser = new ConfigParser();
        this.outputChannel = vscode.window.createOutputChannel('C/C++ Config Parser');
    }

    /**
     * Get extension configuration
     */
    public getConfig(): ExtensionConfig {
        const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
        return {
            enabled: config.get<boolean>('enabled', false),
            configFilePath: config.get<string>('configFilePath', ''),
            watchFile: config.get<boolean>('watchFile', true),
            backupDefines: config.get<string[]>('backupDefines', [])
        };
    }

    /**
     * Check if extension is enabled
     */
    public isEnabled(): boolean {
        return this.getConfig().enabled;
    }

    /**
     * Get configured .config file path
     */
    public getConfigFilePath(): string {
        return this.getConfig().configFilePath;
    }

    /**
     * Check if .config file path is valid and file exists
     */
    public async validateConfigFilePath(filePath?: string): Promise<{ valid: boolean; error?: string }> {
        const pathToCheck = filePath || this.getConfigFilePath();

        if (!pathToCheck) {
            return { valid: false, error: '配置文件路径未设置' };
        }

        // Check if path is absolute
        if (!path.isAbsolute(pathToCheck)) {
            return { valid: false, error: '配置文件路径必须是绝对路径' };
        }

        // Check if file exists
        try {
            const stats = await fs.promises.stat(pathToCheck);
            if (!stats.isFile()) {
                return { valid: false, error: '指定的路径不是文件' };
            }
        } catch (error) {
            return { valid: false, error: '配置文件不存在或无法访问' };
        }

        return { valid: true };
    }

    /**
     * Backup original C_Cpp defines before modification
     */
    public async backupOriginalDefines(): Promise<void> {
        const cppConfig = vscode.workspace.getConfiguration(CPP_CONFIG_SECTION);
        const currentDefines = cppConfig.get<string[]>(DEFINES_KEY, []);

        // Only backup if not already backed up (to prevent overwriting with our own defines)
        const extConfig = vscode.workspace.getConfiguration(CONFIG_SECTION);
        const existingBackup = extConfig.get<string[]>('backupDefines', []);

        if (existingBackup.length === 0) {
            await extConfig.update('backupDefines', currentDefines, vscode.ConfigurationTarget.Workspace);
            this.log(`已备份原始宏定义配置 (${currentDefines.length} 项)`);
        }
    }

    /**
     * Restore original C_Cpp defines
     */
    public async restoreOriginalDefines(): Promise<void> {
        const extConfig = vscode.workspace.getConfiguration(CONFIG_SECTION);
        const backupDefines = extConfig.get<string[]>('backupDefines', []);

        const cppConfig = vscode.workspace.getConfiguration(CPP_CONFIG_SECTION);
        await cppConfig.update(DEFINES_KEY, backupDefines.length > 0 ? backupDefines : undefined, vscode.ConfigurationTarget.Workspace);

        // Clear backup after restore
        await extConfig.update('backupDefines', [], vscode.ConfigurationTarget.Workspace);

        this.log(`已恢复原始宏定义配置 (${backupDefines.length} 项)`);
    }

    /**
     * Read and parse .config file
     */
    public async readConfigFile(filePath: string): Promise<{ content: string; error?: string }> {
        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            return { content };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return { content: '', error: `读取配置文件失败: ${errorMessage}` };
        }
    }

    /**
     * Apply macro defines to VSCode C_Cpp configuration
     */
    public async applyMacroDefines(macros: MacroDefine[]): Promise<ApplyResult> {
        try {
            const defines = this.parser.convertToVscodeDefines(macros);
            const cppConfig = vscode.workspace.getConfiguration(CPP_CONFIG_SECTION);

            // Get stats for logging
            const stats = this.parser.getStats(macros);
            this.log(`解析结果: 总共 ${stats.total} 个宏定义`);
            this.log(`  - 启用 (y): ${stats.enabled}`);
            this.log(`  - 模块 (m): ${stats.module}`);
            this.log(`  - 禁用 (n): ${stats.disabled}`);
            this.log(`  - 数值: ${stats.numeric}`);
            this.log(`  - 字符串: ${stats.string}`);
            this.log(`应用 ${defines.length} 个宏定义到 C_Cpp.default.defines`);

            await cppConfig.update(DEFINES_KEY, defines.length > 0 ? defines : undefined, vscode.ConfigurationTarget.Workspace);

            return {
                success: true,
                appliedCount: defines.length
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.log(`应用配置失败: ${errorMessage}`, true);
            return {
                success: false,
                appliedCount: 0,
                error: errorMessage
            };
        }
    }

    /**
     * Load and apply .config file
     * Main entry point for enabling the extension
     */
    public async loadAndApplyConfig(filePath?: string): Promise<ApplyResult> {
        const pathToLoad = filePath || this.getConfigFilePath();

        // Validate path
        const validation = await this.validateConfigFilePath(pathToLoad);
        if (!validation.valid) {
            return {
                success: false,
                appliedCount: 0,
                error: validation.error
            };
        }

        // Read file
        const { content, error: readError } = await this.readConfigFile(pathToLoad);
        if (readError) {
            return {
                success: false,
                appliedCount: 0,
                error: readError
            };
        }

        // Parse content
        const parseResult = this.parser.parse(content);
        if (parseResult.warnings.length > 0) {
            parseResult.warnings.forEach(warning => this.log(`警告: ${warning}`));
        }

        // Backup original defines before applying
        await this.backupOriginalDefines();

        // Apply defines
        return await this.applyMacroDefines(parseResult.macros);
    }

    /**
     * Clear all defines and restore original
     * Main entry point for disabling the extension
     */
    public async clearConfig(): Promise<void> {
        await this.restoreOriginalDefines();
    }

    /**
     * Reload config file (useful for manual refresh)
     */
    public async reloadConfig(): Promise<ApplyResult> {
        const config = this.getConfig();

        if (!config.enabled) {
            return {
                success: false,
                appliedCount: 0,
                error: '扩展未启用'
            };
        }

        if (!config.configFilePath) {
            return {
                success: false,
                appliedCount: 0,
                error: '配置文件路径未设置'
            };
        }

        this.log('重新加载配置文件...');
        return await this.loadAndApplyConfig();
    }

    /**
     * Log message to output channel
     */
    public log(message: string, show: boolean = false): void {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
        if (show) {
            this.outputChannel.show();
        }
    }

    /**
     * Show output channel
     */
    public showOutput(): void {
        this.outputChannel.show();
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this.outputChannel.dispose();
    }
}
