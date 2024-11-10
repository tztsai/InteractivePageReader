import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'node_modules/@mozilla/readability/lib/index.js',
  output: {
    file: 'tmp/readability.js',
    format: 'umd',
    name: 'readability'
  },
  plugins: [
    commonjs(),
    resolve()
  ]
};