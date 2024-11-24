import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'node_modules/@mixmark-io/domino/lib/index.js',
  output: {
    file: 'tmp/domino.js',
    format: 'umd',
    name: 'domino',
    globals: { 'domino': 'domino' }
  },
  plugins: [
    commonjs(),
    resolve()
  ]
};