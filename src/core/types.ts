/**
 * Type definitions for C/C++ Config Parser
 */

/**
 * Represents a single macro definition parsed from .config file
 */
export interface MacroDefine {
    /** The macro name (e.g., CONFIG_SMP) */
    name: string;
    /** The macro value (e.g., "y", "123", "\"string\"") */
    value: string;
}

/**
 * Parse result containing macros and any errors
 */
export interface ParseResult {
    /** Successfully parsed macros */
    macros: MacroDefine[];
    /** Number of lines parsed */
    linesParsed: number;
    /** Any warnings during parsing */
    warnings: string[];
}

/**
 * Configuration state for the extension
 */
export interface ExtensionConfig {
    /** Whether the extension is enabled */
    enabled: boolean;
    /** Path to the .config file */
    configFilePath: string;
    /** Whether to watch file changes */
    watchFile: boolean;
    /** Backup of original defines for restore */
    backupDefines: string[];
}

/**
 * VSCode C_Cpp configuration target
 */
export interface CppConfiguration {
    /** Array of define strings in format "NAME=value" or "NAME" */
    defines: string[];
}

/**
 * Result of applying configuration
 */
export interface ApplyResult {
    /** Whether the operation succeeded */
    success: boolean;
    /** Number of macros applied */
    appliedCount: number;
    /** Error message if failed */
    error?: string;
}
