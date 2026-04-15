/**
 * 插件激活集成测试
 * 验证小尾巴插件能否正常激活
 * 
 * 注意：此测试需要在真实VS Code环境中运行
 * 当前被jest.config.js排除，仅用于E2E测试
 */

import * as assert from 'assert';
import * as vscode from 'vscode';

describe.skip('小尾巴插件激活测试（需VS Code环境）', () => {
  test('插件应该能够成功激活', async () => {
    // 获取小尾巴扩展
    const extension = vscode.extensions.getExtension('xiaoweiba.xiaoweiba');
    
    // 断言扩展存在
    assert.ok(extension, '小尾巴扩展未找到');
    
    // 如果未激活，则激活它
    if (!extension.isActive) {
      await extension.activate();
    }
    
    // 断言扩展已激活
    assert.ok(extension.isActive, '小尾巴扩展激活失败');
  });

  test('插件应该注册所有P0命令', async () => {
    // 获取所有注册的命令
    const commands = await vscode.commands.getCommands(true);
    
    // P0功能对应的命令
    const expectedCommands = [
      'xiaoweiba.explainCode',
      'xiaoweiba.generateCommit',
      'xiaoweiba.checkNaming',
      'xiaoweiba.optimizeSQL',
      'xiaoweiba.repair-memory',
      'xiaoweiba.export-memory',
      'xiaoweiba.import-memory'
    ];
    
    // 验证每个命令都已注册
    expectedCommands.forEach(command => {
      assert.ok(
        commands.includes(command),
        `命令 ${command} 未注册`
      );
    });
  });

  test('配置管理器应该能够加载默认配置', async () => {
    // 这个测试需要访问插件内部API，暂时跳过
    // TODO: 实现配置加载测试
  });

  test('数据库应该能够初始化', async () => {
    // 这个测试需要访问插件内部API，暂时跳过
    // TODO: 实现数据库初始化测试
  });
});
