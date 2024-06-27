import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

export default {
  input: './lib/cjs/index.js',
  output: {
    file: 'lib/cjs-min/index.min.js',
    format: 'es',
  },
  plugins: [resolve(), commonjs(), terser()],
};
