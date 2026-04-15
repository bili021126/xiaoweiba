const esbuild = require('esbuild');

async function build() {
  const isProduction = process.argv.includes('--production');
  const isWatch = process.argv.includes('--watch');
  
  const config = {
    entryPoints: ['src/extension.ts'],
    bundle: true,
    minify: isProduction,        // 生产环境压缩
    sourcemap: !isProduction,    // 开发环境需要sourcemap
    platform: 'node',            // Node.js平台
    target: 'node16',            // VS Code最低要求
    outfile: 'out/extension.js',
    external: ['vscode'],        // vscode是运行时提供的
    loader: {
      '.ts': 'ts',
      '.wasm': 'file',           // 处理WASM文件
      '.json': 'json',
    },
    define: {
      'process.env.NODE_ENV': isProduction ? '"production"' : '"development"',
    },
    // 支持TypeScript装饰器
    tsconfig: './tsconfig.json',
    logLevel: 'info',
    // 忽略动态require警告
    banner: {
      js: 'import { createRequire } from "module";const require = createRequire(import.meta.url);',
    },
  };
  
  if (isWatch) {
    const ctx = await esbuild.context(config);
    await ctx.watch();
    console.log('👀 Watching for changes...');
  } else {
    try {
      await esbuild.build(config);
      console.log('✅ Build completed successfully!');
    } catch (error) {
      console.error('❌ Build failed:', error);
      process.exit(1);
    }
  }
}

build();
