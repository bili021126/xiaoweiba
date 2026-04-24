/**
 * 提示词编排器 - 负责组装动态 System Prompt
 * 
 * 设计原则：委托而非塞入
 * - ChatAgent 不应该知道如何根据意图向量调整语气
 * - 所有的提示词拼接逻辑集中在此
 */

import { injectable } from 'tsyringe';
import { Intent } from '../domain/Intent';
import { PathUtils } from '../../utils/ProjectFingerprint'; // ✅ 统一路径处理
import { MemoryContext, ChatMemoryContext } from '../domain/MemoryContext'; // ✅ 任务2：支持聊天上下文

@injectable()
export class PromptComposer {
  
  /**
   * 构建完整的系统提示词
   */
  buildSystemPrompt(intent: Intent, memoryContext: MemoryContext | ChatMemoryContext): string {
    const parts: string[] = [];

    // 1. 基础角色设定
    parts.push(this.buildRoleDefinition());

    // 2. ✅ L1: 注入编辑器上下文
    if (intent.metadata.enrichedContext) {
      parts.push(this.buildEnrichedContextSection(intent.metadata.enrichedContext));
    } else if (intent.codeContext) {
      parts.push(this.buildBasicCodeContextSection(intent.codeContext));
    }

    // 3. ✅ L1: 根据意图向量动态调整指令
    if (intent.metadata.intentVector) {
      parts.push(this.buildIntentGuidance(intent.metadata.intentVector));
    }

    // 4. 注入相关记忆
    if (memoryContext.episodicMemories?.length > 0) {
      parts.push(this.buildEpisodicMemorySection(memoryContext.episodicMemories));
    }

    // 5. ✅ 550B: 注入动态语气指令
    parts.push(this.buildDynamicToneInstruction(memoryContext));

    // 6. 注入用户偏好
    if (memoryContext.preferenceRecommendations?.length > 0) {
      parts.push(this.buildPreferenceSection(memoryContext.preferenceRecommendations));
    }

    // 7. 回答规范
    parts.push(this.buildResponseGuidelines());

    return parts.join('\n');
  }

  private buildRoleDefinition(): string {
    return '你是小尾巴，一个智能编程助手。你的目标是成为用户的私人学徒，通过观察和记忆不断成长。';
  }

  private buildEnrichedContextSection(context: any): string {
    const lines = ['\n## 🖥️ 当前工作环境'];
    const fileName = context.activeFilePath ? PathUtils.getFileName(context.activeFilePath) : '未知文件';
    
    lines.push(`- **文件**: ${fileName}`);
    if (context.activeFileLanguage) lines.push(`- **语言**: ${context.activeFileLanguage}`);
    if (context.cursorLine) lines.push(`- **光标**: 第 ${context.cursorLine} 行`);
    
    if (context.selectedCode) {
      lines.push(`- **选中代码** (第${context.selectedCode.startLine}-${context.selectedCode.endLine}行):`);
      lines.push(`\`\`\`${context.activeFileLanguage}\n${context.selectedCode.content}\n\`\`\``);
    }

    if (context.projectTechStack?.length) {
      lines.push(`- **技术栈**: ${context.projectTechStack.join(', ')}`);
    }

    return lines.join('\n');
  }

  private buildBasicCodeContextSection(ctx: any): string {
    return `\n## 💻 编辑器上下文\n- 文件: ${ctx.filePath || '未知'}\n- 语言: ${ctx.language || 'unknown'}`;
  }

  private buildIntentGuidance(vector: any): string {
    const lines = ['\n## 🧠 意图感知指令'];
    
    if (vector.temporal > 0.7) {
      lines.push('- ⏰ **时间敏感**: 用户关注最近的操作，请优先引用短期记忆。');
    }
    if (vector.entity > 0.7) {
      lines.push('- 🎯 **实体敏感**: 用户提到了具体代码实体，请精确匹配文件名或函数名。');
    }
    if (vector.semantic > 0.7) {
      lines.push('- 🔍 **深度语义**: 问题较复杂，请深入分析代码逻辑和架构关系。');
    }
    if (vector.distantTemporal > 0.7) {
      lines.push('- 🕰️ **历史回溯**: 用户在询问很久以前的操作，请检索长期记忆库。');
    }

    return lines.length > 1 ? lines.join('\n') : '';
  }

  private buildEpisodicMemorySection(memories: any[]): string {
    const lines = ['\n## 📚 相关历史操作（你必须参考这些真实发生过的事件来回答）'];
    lines.push('以下是用户在本会话或历史中**真实执行过**的操作。你的回答**必须**基于这些记录，不得编造任何未发生的事件。');
    lines.push('如果用户问"我刚才做了什么"、"你还记得吗"、"之前做过什么"，你**必须**直接复述或总结以下记录中的内容。');
    lines.push('\n**重要规则**：');
    lines.push('- 优先引用最近的历史记录（列表靠前的记忆）');
    lines.push('- 引用时使用自然语言，例如："我记得你刚才..."、"根据之前的记录..."');
    lines.push('- 如果记忆中没有相关信息，请诚实告知用户"我还没有相关的记忆"');
    
    memories.slice(0, 3).forEach((mem, index) => {
      lines.push(`${index + 1}. ${mem.summary}`);
    });
    
    return lines.join('\n');
  }

  /**
   * ✅ 550B: 根据记忆丰富程度生成动态语气指令
   */
  private buildDynamicToneInstruction(context: MemoryContext): string {
    const memoryCount = context.episodicMemories?.length || 0;
    let tone = '';

    if (memoryCount === 0) {
      tone = '\n## 🗣️ 语气指令\n- **新手引导模式**: 用户是第一次使用，请保持耐心、详细解释每一个步骤，多用鼓励性语言。';
    } else if (memoryCount < 10) {
      tone = '\n## 🗣️ 语气指令\n- **学习成长模式**: 我们刚刚开始合作，请保持礼貌和细致，适当确认用户的意图。';
    } else if (memoryCount < 50) {
      tone = '\n## 🗣️ 语气指令\n- **专业协作模式**: 我们已经有一定默契，请直接切入重点，保持专业且高效的沟通。';
    } else {
      tone = '\n## 🗣️ 语气指令\n- **资深伙伴模式**: 我们是老搭档了，请极度简洁，直接给出核心结论或代码，无需客套。';
    }

    return tone;
  }

  private buildPreferenceSection(prefs: any[]): string {
    const lines = ['\n## 👤 用户偏好'];
    prefs.slice(0, 2).forEach(pref => {
      lines.push(`- ${pref.domain}: ${JSON.stringify(pref.pattern)} (置信度: ${pref.confidence}%)`);
    });
    return lines.join('\n');
  }

  private buildResponseGuidelines(): string {
    return [
      '\n## ✍️ 回答要求',
      '- 如果引用了历史记忆，请自然提及（例如："我记得你昨天修改了..."）',
      '- 提到文件时，使用 "文件名+行号" 格式（例如："UserService.java 第42行"）',
      '- 保持学徒的语气：生疏时用"您"，熟悉后用"你"，默契后说"咱们"'
    ].join('\n');
  }
}
