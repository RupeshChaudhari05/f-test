import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

export default [
  // Main SDK - UMD (browser script tag) + ESM
  {
    input: 'src/posh-push.ts',
    output: [
      {
        file: 'dist/posh-push.js',
        format: 'umd',
        name: 'PoshPush',
        sourcemap: true,
      },
      {
        file: 'dist/posh-push.min.js',
        format: 'umd',
        name: 'PoshPush',
        sourcemap: true,
        plugins: [terser()],
      },
      {
        file: 'dist/posh-push.esm.js',
        format: 'es',
        sourcemap: true,
      },
    ],
    plugins: [typescript({ tsconfig: './tsconfig.json' })],
  },
  // AMP Variant
  {
    input: 'src/posh-push-amp.ts',
    output: [
      {
        file: 'dist/posh-push-amp.js',
        format: 'umd',
        name: 'PoshPushAMP',
        sourcemap: true,
      },
      {
        file: 'dist/posh-push-amp.min.js',
        format: 'umd',
        name: 'PoshPushAMP',
        sourcemap: true,
        plugins: [terser()],
      },
    ],
    plugins: [typescript({ tsconfig: './tsconfig.json' })],
  },
  // Blogger Variant
  {
    input: 'src/posh-push-blogger.ts',
    output: [
      {
        file: 'dist/posh-push-blogger.js',
        format: 'umd',
        name: 'PoshPushBlogger',
        sourcemap: true,
      },
      {
        file: 'dist/posh-push-blogger.min.js',
        format: 'umd',
        name: 'PoshPushBlogger',
        sourcemap: true,
        plugins: [terser()],
      },
    ],
    plugins: [typescript({ tsconfig: './tsconfig.json' })],
  },
  // Service Worker - plain copy with minified version
  {
    input: 'src/posh-push-sw.js',
    output: [
      {
        file: 'dist/posh-push-sw.js',
        format: 'iife',
      },
      {
        file: 'dist/posh-push-sw.min.js',
        format: 'iife',
        plugins: [terser()],
      },
    ],
  },
];
