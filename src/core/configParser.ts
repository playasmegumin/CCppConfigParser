/**
 * .config file parser for Linux Kernel style configuration
 */

import { MacroDefine, ParseResult } from './types';

export class ConfigParser {
    /**
     * Parse .config file content
     * Supports formats:
     * - CONFIG_X=y
     * - CONFIG_X=m
     * - CONFIG_X=n
     * - CONFIG_X=123
     * - CONFIG_X="string value"
     * - # CONFIG_X is not set
     */
    public parse(fileContent: string): ParseResult {
        const macros: MacroDefine[] = [];
        const warnings: string[] = [];
        const lines = fileContent.split('\n');
        let linesParsed = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Skip empty lines
            if (!line) {
                continue;
            }

            // Skip pure comments (lines starting with # but not "# CONFIG_... is not set")
            if (line.startsWith('#') && !this.isNotSetPattern(line)) {
                continue;
            }

            linesParsed++;

            try {
                const macro = this.parseLine(line);
                if (macro) {
                    macros.push(macro);
                }
            } catch (error) {
                warnings.push(`Line ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        return {
            macros,
            linesParsed,
            warnings
        };
    }

    /**
     * Check if line matches "# CONFIG_XXX is not set" pattern
     */
    private isNotSetPattern(line: string): boolean {
        return /^#\s*CONFIG_\w+\s+is not set\s*$/.test(line);
    }

    /**
     * Parse a single line into MacroDefine
     */
    private parseLine(line: string): MacroDefine | null {
        // Handle "# CONFIG_XXX is not set" → treat as CONFIG_XXX=n
        const notSetMatch = line.match(/^#\s*(CONFIG_\w+)\s+is not set\s*$/);
        if (notSetMatch) {
            return {
                name: notSetMatch[1],
                value: 'n'
            };
        }

        // Handle CONFIG_XXX=value
        const configMatch = line.match(/^(CONFIG_\w+)=(.+)$/);
        if (!configMatch) {
            return null;
        }

        const name = configMatch[1];
        let value = configMatch[2].trim();

        // Remove surrounding quotes from string values
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        return { name, value };
    }

    /**
     * Convert parsed macros to VSCode C_Cpp defines format
     *
     * Mapping rules:
     * - y/m → name=1
     * - n → skipped (not included)
     * - numeric → name=value
     * - string → name=value (with escape handling)
     */
    public convertToVscodeDefines(macros: MacroDefine[]): string[] {
        const defines: string[] = [];

        for (const macro of macros) {
            const define = this.convertMacro(macro);
            if (define) {
                defines.push(define);
            }
        }

        return defines;
    }

    /**
     * Convert a single macro to VSCode define format
     */
    private convertMacro(macro: MacroDefine): string | null {
        const { name, value } = macro;

        // Handle special values
        switch (value) {
            case 'y':
            case 'm':
                return `${name}=1`;
            case 'n':
                // Skip disabled configs
                return null;
        }

        // Check if numeric
        if (/^-?\d+$/.test(value)) {
            return `${name}=${value}`;
        }

        // Check if hexadecimal
        if (/^0x[0-9a-fA-F]+$/.test(value)) {
            return `${name}=${value}`;
        }

        // String value - return as-is (VSCode handles the escaping)
        return `${name}=${value}`;
    }

    /**
     * Get statistics about the parsed macros
     */
    public getStats(macros: MacroDefine[]): {
        total: number;
        enabled: number;
        disabled: number;
        module: number;
        numeric: number;
        string: number;
    } {
        let enabled = 0;
        let disabled = 0;
        let module = 0;
        let numeric = 0;
        let string = 0;

        for (const macro of macros) {
            switch (macro.value) {
                case 'y':
                    enabled++;
                    break;
                case 'm':
                    module++;
                    break;
                case 'n':
                    disabled++;
                    break;
                default:
                    if (/^-?\d+$/.test(macro.value) || /^0x[0-9a-fA-F]+$/.test(macro.value)) {
                        numeric++;
                    } else {
                        string++;
                    }
            }
        }

        return {
            total: macros.length,
            enabled,
            disabled,
            module,
            numeric,
            string
        };
    }
}
