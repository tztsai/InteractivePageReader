import common from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'node_modules/turndown/lib/turndown.browser.umd.js',
  output: {
    file: 'tmp/turndown.js',
    format: 'umd',
    name: 'TurndownService'
  },
  plugins: [
    common(),
    resolve()
  ]
};