import * as assert from 'assert';
import { ConfigParser } from '../../core/configParser';

suite('ConfigParser Test Suite', () => {
    let parser: ConfigParser;

    setup(() => {
        parser = new ConfigParser();
    });

    test('should parse simple y/m/n values', () => {
        const content = `
CONFIG_FEATURE_A=y
CONFIG_FEATURE_B=m
CONFIG_FEATURE_C=n
`;
        const result = parser.parse(content);

        assert.strictEqual(result.macros.length, 3);
        assert.deepStrictEqual(result.macros[0], { name: 'CONFIG_FEATURE_A', value: 'y' });
        assert.deepStrictEqual(result.macros[1], { name: 'CONFIG_FEATURE_B', value: 'm' });
        assert.deepStrictEqual(result.macros[2], { name: 'CONFIG_FEATURE_C', value: 'n' });
    });

    test('should parse numeric values', () => {
        const content = `
CONFIG_VALUE_1=123
CONFIG_VALUE_2=-456
CONFIG_HEX=0xABCD
`;
        const result = parser.parse(content);

        assert.strictEqual(result.macros.length, 3);
        assert.deepStrictEqual(result.macros[0], { name: 'CONFIG_VALUE_1', value: '123' });
        assert.deepStrictEqual(result.macros[1], { name: 'CONFIG_VALUE_2', value: '-456' });
        assert.deepStrictEqual(result.macros[2], { name: 'CONFIG_HEX', value: '0xABCD' });
    });

    test('should parse string values with quotes', () => {
        const content = `
CONFIG_STRING_1="hello world"
CONFIG_STRING_2='single quotes'
CONFIG_VERSION="5.15.0"
`;
        const result = parser.parse(content);

        assert.strictEqual(result.macros.length, 3);
        assert.deepStrictEqual(result.macros[0], { name: 'CONFIG_STRING_1', value: 'hello world' });
        assert.deepStrictEqual(result.macros[1], { name: 'CONFIG_STRING_2', value: 'single quotes' });
        assert.deepStrictEqual(result.macros[2], { name: 'CONFIG_VERSION', value: '5.15.0' });
    });

    test('should handle "is not set" pattern as n', () => {
        const content = `
CONFIG_ENABLED=y
# CONFIG_DISABLED is not set
CONFIG_MODULE=m
`;
        const result = parser.parse(content);

        assert.strictEqual(result.macros.length, 3);
        assert.deepStrictEqual(result.macros[0], { name: 'CONFIG_ENABLED', value: 'y' });
        assert.deepStrictEqual(result.macros[1], { name: 'CONFIG_DISABLED', value: 'n' });
        assert.deepStrictEqual(result.macros[2], { name: 'CONFIG_MODULE', value: 'm' });
    });

    test('should skip empty lines and comments', () => {
        const content = `
# This is a comment
CONFIG_FEATURE_A=y

# Another comment
CONFIG_FEATURE_B=m

`;
        const result = parser.parse(content);

        assert.strictEqual(result.macros.length, 2);
        assert.deepStrictEqual(result.macros[0], { name: 'CONFIG_FEATURE_A', value: 'y' });
        assert.deepStrictEqual(result.macros[1], { name: 'CONFIG_FEATURE_B', value: 'm' });
    });

    test('should convert to VSCode defines correctly', () => {
        const macros = [
            { name: 'CONFIG_ENABLED', value: 'y' },
            { name: 'CONFIG_MODULE', value: 'm' },
            { name: 'CONFIG_DISABLED', value: 'n' },
            { name: 'CONFIG_NUMBER', value: '42' },
            { name: 'CONFIG_HEX', value: '0xFF' },
            { name: 'CONFIG_STRING', value: 'hello' }
        ];

        const defines = parser.convertToVscodeDefines(macros);

        assert.strictEqual(defines.length, 5); // n values are skipped
        assert(defines.includes('CONFIG_ENABLED=1'));
        assert(defines.includes('CONFIG_MODULE=1'));
        assert(defines.includes('CONFIG_NUMBER=42'));
        assert(defines.includes('CONFIG_HEX=0xFF'));
        assert(defines.includes('CONFIG_STRING=hello'));
        assert(!defines.includes('CONFIG_DISABLED=0'));
    });

    test('should provide accurate stats', () => {
        const macros = [
            { name: 'CONFIG_Y1', value: 'y' },
            { name: 'CONFIG_Y2', value: 'y' },
            { name: 'CONFIG_M', value: 'm' },
            { name: 'CONFIG_N1', value: 'n' },
            { name: 'CONFIG_N2', value: 'n' },
            { name: 'CONFIG_NUM', value: '123' },
            { name: 'CONFIG_HEX', value: '0xABC' },
            { name: 'CONFIG_STR', value: 'test' }
        ];

        const stats = parser.getStats(macros);

        assert.strictEqual(stats.total, 8);
        assert.strictEqual(stats.enabled, 2);
        assert.strictEqual(stats.module, 1);
        assert.strictEqual(stats.disabled, 2);
        assert.strictEqual(stats.numeric, 2);
        assert.strictEqual(stats.string, 1);
    });

    test('should handle kernel-style config file', () => {
        const content = `
#
# Automatically generated file; DO NOT EDIT.
# Linux/x86_64 5.15.0 Kernel Configuration
#
CONFIG_64BIT=y
CONFIG_X86_64=y
CONFIG_X86=y
CONFIG_MMU=y
CONFIG_SMP=y
CONFIG_SMP_NR_CPUS=8
CONFIG_PREEMPT_NONE=y
# CONFIG_PREEMPT_VOLUNTARY is not set
# CONFIG_PREEMPT is not set
CONFIG_HZ_250=y
CONFIG_HZ=250
CONFIG_VERSION="5.15.0"
`;
        const result = parser.parse(content);

        assert.strictEqual(result.macros.length, 12);

        // Check specific values
        const preemptVoluntary = result.macros.find(m => m.name === 'CONFIG_PREEMPT_VOLUNTARY');
        assert.ok(preemptVoluntary);
        assert.strictEqual(preemptVoluntary!.value, 'n');

        const hz = result.macros.find(m => m.name === 'CONFIG_HZ');
        assert.ok(hz);
        assert.strictEqual(hz!.value, '250');
    });
});
