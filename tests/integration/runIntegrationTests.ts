/**
 * 集成测试启动脚本
 * 使用 @vscode/test-electron 运行VS Code插件集成测试
 */

import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    // 扩展开发工作区路径
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    
    // 测试文件路径
    const extensionTestsPath = path.resolve(__dirname, './suite/index');
    
    // VS Code版本（可选，默认最新稳定版）
    const vscodeVersion = process.env.VSCODE_VERSION || 'stable';
    
    console.log('===========================================');
    console.log('小尾巴 (XiaoWeiba) 集成测试');
    console.log('===========================================');
    console.log(`VS Code 版本: ${vscodeVersion}`);
    console.log(`扩展路径: ${extensionDevelopmentPath}`);
    console.log(`测试路径: ${extensionTestsPath}`);
    console.log('===========================================\n');
    
    // 运行测试
    await runTests({
      version: vscodeVersion,
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        '--disable-extensions', // 禁用其他扩展，避免干扰
        '--user-data-dir', path.join(extensionDevelopmentPath, '.vscode-test-user-data')
      ]
    });
    
    console.log('\n✅ 集成测试完成');
  } catch (err) {
    console.error('\n❌ 集成测试失败:', err);
    console.error('详细错误信息:', err instanceof Error ? err.stack : err);
    process.exit(1);
  }
}

main();
