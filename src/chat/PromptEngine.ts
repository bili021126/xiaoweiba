import { ConfigManager } from '../storage/ConfigManager';

/**
 * 提示词模板
 */
interface PromptTemplate {
  explain: string;
  generate: string;
  commit: string;
  default: string;
}

/**
 * 默认提示词模板
 */
const DEFAULT_TEMPLATES: PromptTemplate = {
  explain: `你是一位资深程序员，请解释以下代码的功能、关键逻辑和潜在问题。

代码：
\`\`\`{language}
{code}
\`\`\`

用户问题：{userMessage}

请用中文回答，解释要清晰易懂。`,

  generate: `根据以下需求生成代码。

需求：{userInput}

{context_info}

要求：
1. 代码要完整可运行
2. 遵循最佳实践
3. 添加必要的注释
4. 只返回代码块，不要额外解释`,

  commit: `根据以下 Git diff 生成符合 Conventional Commits 规范的提交信息。

{diff}

格式：<type>(<scope>): <description>

type可选: feat, fix, docs, style, refactor, test, chore`,

  default: `你是一个AI编程助手，擅长解释代码、生成代码和解答技术问题。

{context}

请根据用户的问题提供帮助。`
};

/**
 * 提示词模板引擎
 * 
 * 根据用户意图选择不同的提示词模板，注入上下文信息
 */
export class PromptEngine {
  private templates: PromptTemplate;

  constructor(private configManager: ConfigManager) {
    // TODO: 未来支持从配置文件加载自定义模板
    this.templates = DEFAULT_TEMPLATES;
  }

  /**
   * 生成提示词
   * 
   * @param userMessage 用户消息
   * @param contextResult 上下文构建结果
   * @param command 可选的命令类型（/explain, /generate, /commit）
   * @returns 完整的系统提示词
   */
  generatePrompt(
    userMessage: string,
    contextResult: { messages: any[]; systemPrompt: string },
    command?: string
  ): string {
    // 检测命令类型
    const commandType = this.detectCommand(userMessage, command);

    // 获取编辑器上下文
    const editorContext = this.extractEditorContext(contextResult.systemPrompt);

    // 根据命令类型选择模板
    let template: string;
    switch (commandType) {
      case 'explain':
        template = this.templates.explain;
        break;
      case 'generate':
        template = this.templates.generate;
        break;
      case 'commit':
        template = this.templates.commit;
        break;
      default:
        template = this.templates.default;
    }

    // 填充模板变量
    return this.fillTemplate(template, {
      userMessage,
      ...editorContext,
      context: contextResult.systemPrompt,
      context_info: editorContext.filePath ? `当前文件: ${editorContext.filePath}` : ''
    });
  }

  /**
   * 检测命令类型
   */
  private detectCommand(userMessage: string, command?: string): string | null {
    // 优先使用显式命令
    if (command) {
      return command.replace('/', '').toLowerCase();
    }

    // 从消息内容检测
    const lowerMessage = userMessage.toLowerCase();
    if (lowerMessage.startsWith('/explain') || lowerMessage.includes('解释代码')) {
      return 'explain';
    }
    if (lowerMessage.startsWith('/generate') || lowerMessage.includes('生成代码')) {
      return 'generate';
    }
    if (lowerMessage.startsWith('/commit') || lowerMessage.includes('生成提交')) {
      return 'commit';
    }

    return null;
  }

  /**
   * 从系统提示中提取编辑器上下文
   */
  private extractEditorContext(systemPrompt: string): Record<string, string> {
    const context: Record<string, string> = {};

    // 提取文件路径
    const filePathMatch = systemPrompt.match(/当前文件[:：]\s*(.+?)(?=\n|$)/);
    if (filePathMatch) {
      context.filePath = filePathMatch[1].trim();
    }

    // 提取语言
    const langMatch = systemPrompt.match(/语言[:：]\s*(.+?)(?=\n|$)/);
    if (langMatch) {
      context.language = langMatch[1].trim();
    }

    // 提取选中代码
    const codeMatch = systemPrompt.match(/选中代码[:：]?\s*```(?:\w+)?\n([\s\S]*?)```/);
    if (codeMatch) {
      context.code = codeMatch[1].trim();
    }

    return context;
  }

  /**
   * 填充模板变量
   */
  private fillTemplate(template: string, variables: Record<string, string>): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      if (result.includes(placeholder)) {
        result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
      }
    }

    return result;
  }

  /**
   * 注册自定义模板
   */
  registerTemplate(name: keyof PromptTemplate, template: string): void {
    this.templates[name] = template;
  }

  /**
   * 获取所有模板
   */
  getTemplates(): PromptTemplate {
    return { ...this.templates };
  }
}
