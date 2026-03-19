import * as assert from 'assert';
import * as vscode from 'vscode';
import { ConfigManager } from '../../core/configManager';

// Note: These tests require a VSCode workspace to be open
// and will interact with actual VSCode configuration

suite('ConfigManager Test Suite', () => {
    let configManager: ConfigManager;
    const CONFIG_SECTION = 'ccppConfigParser';
    const CPP_CONFIG_SECTION = 'C_Cpp';

    // Check if we have a workspace
    const hasWorkspace = () => {
        return vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0;
    };

    suiteSetup(() => {
        // Create a single ConfigManager instance for all tests
        configManager = new ConfigManager();
    });

    setup(async () => {
        // Skip workspace-related setup if no workspace
        if (!hasWorkspace()) {
            return;
        }

        // Clean up any existing configuration
        const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
        await config.update('enabled', false, vscode.ConfigurationTarget.Workspace);
        await config.update('configFilePath', '', vscode.ConfigurationTarget.Workspace);
        await config.update('backupDefines', [], vscode.ConfigurationTarget.Workspace);

        const cppConfig = vscode.workspace.getConfiguration(CPP_CONFIG_SECTION);
        await cppConfig.update('default.defines', [], vscode.ConfigurationTarget.Workspace);
    });

    teardown(async () => {
        // Skip workspace-related cleanup if no workspace
        if (!hasWorkspace()) {
            return;
        }

        // Cleanup after tests
        const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
        await config.update('enabled', false, vscode.ConfigurationTarget.Workspace);
        await config.update('configFilePath', '', vscode.ConfigurationTarget.Workspace);
        await config.update('backupDefines', [], vscode.ConfigurationTarget.Workspace);

        const cppConfig = vscode.workspace.getConfiguration(CPP_CONFIG_SECTION);
        await cppConfig.update('default.defines', [], vscode.ConfigurationTarget.Workspace);
    });

    suiteTeardown(() => {
        // Dispose the ConfigManager after all tests
        if (configManager) {
            configManager.dispose();
        }
    });

    test('should get configuration defaults', () => {
        const config = configManager.getConfig();

        assert.strictEqual(config.enabled, false);
        assert.strictEqual(config.configFilePath, '');
        assert.strictEqual(config.watchFile, true);
        assert.deepStrictEqual(config.backupDefines, []);
    });

    test('should validate empty config file path', async () => {
        const result = await configManager.validateConfigFilePath();

        assert.strictEqual(result.valid, false);
        assert.ok(result.error?.includes('路径未设置'));
    });

    test('should validate non-existent file path', async () => {
        const result = await configManager.validateConfigFilePath('/non/existent/path/.config');

        assert.strictEqual(result.valid, false);
        assert.ok(result.error?.includes('不存在'));
    });

    test('should validate relative path as invalid', async () => {
        const result = await configManager.validateConfigFilePath('relative/path/.config');

        assert.strictEqual(result.valid, false);
        assert.ok(result.error?.includes('绝对路径'));
    });

    test('should backup and restore original defines', async function() {
        if (!hasWorkspace()) {
            this.skip();
            return;
        }

        // Set some original defines
        const cppConfig = vscode.workspace.getConfiguration(CPP_CONFIG_SECTION);
        const originalDefines = ['ORIGINAL_1=1', 'ORIGINAL_2=2'];
        await cppConfig.update('default.defines', originalDefines, vscode.ConfigurationTarget.Workspace);

        // Backup
        await configManager.backupOriginalDefines();

        // Verify backup
        const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
        const backup = config.get<string[]>('backupDefines', []);
        assert.deepStrictEqual(backup, originalDefines);

        // Modify defines
        await cppConfig.update('default.defines', ['NEW_DEFINE'], vscode.ConfigurationTarget.Workspace);

        // Restore
        await configManager.restoreOriginalDefines();

        // Verify restored
        const restoredDefines = cppConfig.get<string[]>('default.defines', []);
        assert.deepStrictEqual(restoredDefines, originalDefines);

        // Verify backup cleared
        const clearedBackup = config.get<string[]>('backupDefines', []);
        assert.deepStrictEqual(clearedBackup, []);
    });

    test('should apply macro defines to C_Cpp configuration', async function() {
        if (!hasWorkspace()) {
            this.skip();
            return;
        }

        const macros = [
            { name: 'CONFIG_FEATURE_A', value: 'y' },
            { name: 'CONFIG_FEATURE_B', value: 'n' },
            { name: 'CONFIG_VALUE', value: '123' }
        ];

        const result = await configManager.applyMacroDefines(macros);

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.appliedCount, 2); // n values are skipped

        // Verify C_Cpp configuration
        const cppConfig = vscode.workspace.getConfiguration(CPP_CONFIG_SECTION);
        const defines = cppConfig.get<string[]>('default.defines', []);

        assert.ok(defines.includes('CONFIG_FEATURE_A=1'));
        assert.ok(defines.includes('CONFIG_VALUE=123'));
        assert.ok(!defines.includes('CONFIG_FEATURE_B=0'));
    });

    test('should handle empty macros array', async () => {
        const result = await configManager.applyMacroDefines([]);

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.appliedCount, 0);
    });

    test('should only backup once (prevent overwriting backup with our own defines)', async function() {
        if (!hasWorkspace()) {
            this.skip();
            return;
        }

        const cppConfig = vscode.workspace.getConfiguration(CPP_CONFIG_SECTION);
        const originalDefines = ['ORIGINAL=1'];
        await cppConfig.update('default.defines', originalDefines, vscode.ConfigurationTarget.Workspace);

        // First backup
        await configManager.backupOriginalDefines();

        // Modify defines
        await cppConfig.update('default.defines', ['MODIFIED=1'], vscode.ConfigurationTarget.Workspace);

        // Second backup should not overwrite
        await configManager.backupOriginalDefines();

        // Verify backup still contains original
        const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
        const backup = config.get<string[]>('backupDefines', []);
        assert.deepStrictEqual(backup, originalDefines);
    });
});
