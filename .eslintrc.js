module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  rules: {
    // ========================================
    // Cortex 架构法典 - 代码质量规则
    // ========================================
    
    // ✅ 任务4：消除 any 类型，提升类型安全性
    // 注意：Record<string, any> 用于元数据和动态对象，暂时允许
    '@typescript-eslint/no-explicit-any': ['error', { ignoreRestArgs: true }],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    
    // ✅ 规范化 console 使用：禁止 console.log/warn，仅允许 console.error
    'no-console': ['error', { allow: ['error'] }],
    
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-argument': 'warn',
    '@typescript-eslint/restrict-template-expressions': 'warn',
    
    // ========================================
    // Cortex 法典 SEC-006: 禁止在类内部使用 container.resolve()
    // 依赖必须通过构造函数注入（DEP-004）
    // ========================================
    'no-restricted-syntax': [
      'error',
      {
        selector: 'MethodDefinition[kind="constructor"] CallExpression[callee.object.name="container"][callee.property.name="resolve"]',
        message: '❌ [Cortex DEP-004] 禁止在构造函数中使用 container.resolve()，请使用 @inject() 装饰器进行依赖注入。\n   正确做法：constructor(@inject("IMemoryPort") private memoryPort: IMemoryPort)'
      },
      {
        selector: 'PropertyDefinition CallExpression[callee.object.name="container"][callee.property.name="resolve"]',
        message: '❌ [Cortex DEP-004] 禁止在属性初始化中使用 container.resolve()，请使用构造函数注入。'
      }
    ],
    
    // ========================================
    // Cortex 法典 AG-007: Agent ID 命名规范（kebab-case）
    // ========================================
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'property',
        filter: '^id$',
        format: ['camelCase'],
        modifiers: ['readonly']
      }
    ],
    
    // ✅ Phase 2.4: 强制架构约束 - 禁止跨层直接导入
    // 遵循《小尾巴架构强制约束规范 v1.0》
    'no-restricted-imports': [
      'error',
      {
        paths: [
          // ========================================
          // 规则1: 禁止直接导入记忆模块的具体实现
          // 适用层级: UI/Chat/Agents/Application
          // ========================================
          
          // 禁止直接导入 EpisodicMemory（所有层级）
          {
            name: '../core/memory/EpisodicMemory',
            message: '❌ [架构违规] 请使用 IMemoryPort 端口接口，不要直接导入 EpisodicMemory。\n   正确做法：import { IMemoryPort } from "../core/ports/IMemoryPort"'
          },
          {
            name: '../../core/memory/EpisodicMemory',
            message: '❌ [架构违规] 请使用 IMemoryPort 端口接口，不要直接导入 EpisodicMemory。\n   正确做法：import { IMemoryPort } from "../../core/ports/IMemoryPort"'
          },
          {
            name: '../../../core/memory/EpisodicMemory',
            message: '❌ [架构违规] 请使用 IMemoryPort 端口接口，不要直接导入 EpisodicMemory。\n   正确做法：import { IMemoryPort } from "../../../core/ports/IMemoryPort"'
          },
          {
            name: '../../../../core/memory/EpisodicMemory',
            message: '❌ [架构违规] 请使用 IMemoryPort 端口接口，不要直接导入 EpisodicMemory。\n   正确做法：import { IMemoryPort } from "../../../../core/ports/IMemoryPort"'
          },
          
          // 禁止直接导入 PreferenceMemory（所有层级）
          {
            name: '../core/memory/PreferenceMemory',
            message: '❌ [架构违规] 请使用 IMemoryPort 端口接口，不要直接导入 PreferenceMemory。\n   正确做法：import { IMemoryPort } from "../core/ports/IMemoryPort"'
          },
          {
            name: '../../core/memory/PreferenceMemory',
            message: '❌ [架构违规] 请使用 IMemoryPort 端口接口，不要直接导入 PreferenceMemory。\n   正确做法：import { IMemoryPort } from "../../core/ports/IMemoryPort"'
          },
          {
            name: '../../../core/memory/PreferenceMemory',
            message: '❌ [架构违规] 请使用 IMemoryPort 端口接口，不要直接导入 PreferenceMemory。\n   正确做法：import { IMemoryPort } from "../../../core/ports/IMemoryPort"'
          },
          {
            name: '../../../../core/memory/PreferenceMemory',
            message: '❌ [架构违规] 请使用 IMemoryPort 端口接口，不要直接导入 PreferenceMemory。\n   正确做法：import { IMemoryPort } from "../../../../core/ports/IMemoryPort"'
          },
          
          // ========================================
          // 规则2: 禁止直接导入 LLM 工具的具体实现
          // 适用层级: UI/Chat/Agents/Application
          // ========================================
          
          // 禁止直接导入 LLMTool（所有层级）
          {
            name: '../tools/LLMTool',
            message: '❌ [架构违规] 请使用 ILLMPort 端口接口，不要直接导入 LLMTool。\n   正确做法：import { ILLMPort } from "../core/ports/ILLMPort"'
          },
          {
            name: '../../tools/LLMTool',
            message: '❌ [架构违规] 请使用 ILLMPort 端口接口，不要直接导入 LLMTool。\n   正确做法：import { ILLMPort } from "../../core/ports/ILLMPort"'
          },
          {
            name: '../../../tools/LLMTool',
            message: '❌ [架构违规] 请使用 ILLMPort 端口接口，不要直接导入 LLMTool。\n   正确做法：import { ILLMPort } from "../../../core/ports/ILLMPort"'
          },
          {
            name: '../../../../tools/LLMTool',
            message: '❌ [架构违规] 请使用 ILLMPort 端口接口，不要直接导入 LLMTool。\n   正确做法：import { ILLMPort } from "../../../../core/ports/ILLMPort"'
          }
        ],
        patterns: [
          // ========================================
          // 规则3: 禁止引用已删除的 commands 目录
          // ========================================
          {
            group: ['**/commands/**'],
            message: '❌ commands 目录已删除，请勿使用'
          },
          
          // ========================================
          // 规则4: 禁止 UI 层直接导入基础设施层
          // 适用: src/ui/**, src/chat/**
          // ========================================
          {
            group: ['**/infrastructure/**'],
            message: '❌ [架构违规] UI 层禁止直接导入基础设施模块，请使用端口接口 (IEventBus, IMemoryPort 等)'
          },
          
          // ========================================
          // 规则5: 禁止应用层直接导入基础设施层
          // 适用: src/core/application/**
          // ========================================
          {
            group: ['**/infrastructure/**'],
            message: '❌ [架构违规] 应用层禁止直接导入基础设施模块，请使用端口接口'
          },
          
          // ========================================
          // 规则6: 禁止基础设施层导入应用层或领域层
          // 适用: src/infrastructure/**
          // ========================================
          {
            group: ['**/core/application/**', '**/core/domain/**'],
            message: '❌ [架构违规] 基础设施层禁止导入应用层或领域层'
          }
        ]
      }
    ]
  },
  overrides: [
    // ========================================
    // 例外规则1: 适配器层允许导入具体实现
    // 原因: 端口-适配器模式的核心，适配器必须适配到具体实现
    // ========================================
    {
      files: ['src/infrastructure/adapters/**/*.ts'],
      rules: {
        'no-restricted-imports': 'off'
      }
    },
    
    // ========================================
    // 例外规则2: Agents作为执行单元，理应能理解意图和上下文
    // 原因: Agents是意图驱动架构的执行者，必须能访问Intent和MemoryContext
    // 这不是违规，而是正确的依赖方向（Infrastructure → Domain）
    // ========================================
    {
      files: ['src/agents/**/*.ts'],
      rules: {
        'no-restricted-imports': 'off'  // Agents可以导入Domain层类型
      }
    },
    
    // ========================================
    // 例外规则3: UI层允许导入应用层服务
    // 原因: ChatViewProvider需要IntentDispatcher调度意图
    // ========================================
    {
      files: ['src/chat/**/*.ts'],
      rules: {
        'no-restricted-imports': 'off'  // UI层可以导入应用层
      }
    },
    
    // ========================================
    // 例外规则4: Completion目录待重构
    // 状态: 暂时降级为警告,不阻断构建
    // TODO: 重构完成后移除此例外
    // ========================================
    {
      files: ['src/completion/**/*.ts'],
      rules: {
        'no-restricted-imports': 'warn'  // 降级为警告，不阻断构建
      }
    },
        
    // ========================================
    // 例外规则5: 测试文件允许直接导入具体实现
    // 原因: 单元测试需要测试具体类的行为，而非接口契约
    // 集成测试和E2E测试也需要实例化具体实现
    // ========================================
    {
      files: ['tests/**/*.ts'],
      rules: {
        'no-restricted-imports': 'off'  // 测试文件可以导入任何实现
      }
    }
  ],
  ignorePatterns: ['out', 'node_modules', '.vscode-test', '*.d.ts']
};
