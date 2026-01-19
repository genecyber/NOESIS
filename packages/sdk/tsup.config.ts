import { defineConfig } from 'tsup';

export default defineConfig([
  // Main bundles (ESM + CJS)
  {
    entry: {
      index: 'src/index.ts',
      'core/index': 'src/core/index.ts',
      'web/index': 'src/web/index.ts',
      'web/hooks': 'src/web/hooks.ts',
      'cli/index': 'src/cli/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    external: ['react', 'react-dom'],
  },
  // UMD bundle for CDN usage
  {
    entry: {
      'metamorph-sdk': 'src/index.ts',
      'metamorph-sdk.web': 'src/web/index.ts',
    },
    format: ['iife'],
    globalName: 'MetamorphSDK',
    outDir: 'dist/umd',
    minify: true,
    sourcemap: true,
    external: ['react', 'react-dom'],
    esbuildOptions(options) {
      options.footer = {
        js: 'if(typeof module!=="undefined")module.exports=MetamorphSDK;',
      };
    },
  },
]);
