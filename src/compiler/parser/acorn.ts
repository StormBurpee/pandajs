import { Node } from 'acorn';
import * as codeRed from 'code-red';

export const parse = (source: string): Node => codeRed.parse(source, {
    sourceType: 'module',
    ecmaVersion: 11,
    locations: true
});

export const parseExpressionAt = (source: string, index: number): Node => codeRed.parseExpressionAt(source, index, {
    ecmaVersion: 11,
    locations: true
});
