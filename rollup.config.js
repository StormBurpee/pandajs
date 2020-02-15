import path from 'path'
import typescript from 'rollup-plugin-typescript2';

export default [
    {
        input: './src/compiler/index.ts',
        output: [
            {
                file: 'dist/compiler/compiler.js',
                format: 'cjs'
            },
            {
                file: 'dist/compiler/compiler.mjs',
                format: 'esm'
            }
        ],
        plugins: [typescript({
            include: 'src/**',
            typescript: require('typescript'),
            tsconfig: path.resolve(__dirname, 'src', 'compiler', 'tsconfig.json')
        })]
    }
];
