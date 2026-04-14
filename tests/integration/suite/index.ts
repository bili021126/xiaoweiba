/**
 * 集成测试套件索引
 * 加载并运行所有集成测试
 */

import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export function run(): Promise<void> {
  // 创建 Mocha 实例
  const mocha = new Mocha({
    ui: 'bdd',
    color: true,
    timeout: 60000 // 60秒超时
  });

  // 测试文件目录
  const testsRoot = path.resolve(__dirname, '..');

  return new Promise((resolve, reject) => {
    // 查找所有 .test.js 文件
    glob('**/*.test.js', { cwd: testsRoot })
      .then((files: string[]) => {
        // 添加文件到 Mocha
        files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

        try {
          // 运行测试
          mocha.run((failures: number) => {
            if (failures > 0) {
              reject(new Error(`${failures} 个测试失败`));
            } else {
              resolve();
            }
          });
        } catch (err) {
          console.error('Mocha 运行错误:', err);
          reject(err);
        }
      })
      .catch((err: Error) => {
        reject(err);
      });
  });
}
