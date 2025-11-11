/**
 * Sentra协议处理模块
 * 包含<sentra-result>、<sentra-user-question>、<sentra-response>的构建和解析
 */

import { z } from 'zod';
import { jsonToXMLLines, extractXMLTag, extractAllXMLTags, extractFilesFromContent, valueToXMLString, USER_QUESTION_FILTER_KEYS } from './xmlUtils.js';
import { createLogger } from './logger.js';

const logger = createLogger('ProtocolUtils');

/**
 * 反转义 HTML 实体（处理模型可能输出的转义字符）
 * @param {string} text - 可能包含 HTML 实体的文本
 * @returns {string} 反转义后的文本
 */
function unescapeHTML(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// Zod schema for resource validation
const ResourceSchema = z.object({
  type: z.enum(['image', 'video', 'audio', 'file', 'link']),
  source: z.string(),
  caption: z.string().optional()
});

const SentraResponseSchema = z.object({
  textSegments: z.array(z.string()),
  resources: z.array(ResourceSchema).optional().default([])
});

/**
 * 构建<sentra-result>块（工具执行结果）
 */
export function buildSentraResultBlock(ev) {
  const xmlLines = ['<sentra-result>'];
  
  // 递归遍历整个ev对象，自动生成XML
  xmlLines.push(...jsonToXMLLines(ev, 1, 0, 8));
  
  // 提取文件路径
  const files = extractFilesFromContent(ev);
  if (files.length > 0) {
    xmlLines.push('  <extracted_files>');
    files.forEach(f => {
      xmlLines.push('    <file>');
      xmlLines.push(`      <key>${f.key}</key>`);
      xmlLines.push(`      <path>${valueToXMLString(f.path, 0)}</path>`);
      xmlLines.push('    </file>');
    });
    xmlLines.push('  </extracted_files>');
  }
  
  xmlLines.push('</sentra-result>');
  return xmlLines.join('\n');
}

/**
 * 构建<sentra-user-question>块（用户提问）
 * 自动过滤segments、images、videos、files、records等冗余字段
 */
export function buildSentraUserQuestionBlock(msg) {
  const xmlLines = ['<sentra-user-question>'];
  
  // 递归遍历msg对象，过滤指定的键
  xmlLines.push(...jsonToXMLLines(msg, 1, 0, 6, USER_QUESTION_FILTER_KEYS));
  
  xmlLines.push('</sentra-user-question>');
  return xmlLines.join('\n');
}

/**
 * 解析<sentra-response>协议
 */
export function parseSentraResponse(response) {
  const responseContent = extractXMLTag(response, 'sentra-response');
  if (!responseContent) {
    logger.warn('未找到 <sentra-response> 块，返回原文');
    return { textSegments: [response], resources: [] };
  }
  
  // 提取所有 <text1>, <text2>, <text3> ... 标签
  const textSegments = [];
  let index = 1;
  while (true) {
    const textTag = `text${index}`;
    const textContent = extractXMLTag(responseContent, textTag);
    if (!textContent) break;
    
    // 反转义 HTML 实体（处理模型可能输出的转义字符）
    const unescapedText = unescapeHTML(textContent.trim());
    textSegments.push(unescapedText);
    //logger.debug(`提取 <${textTag}>: ${unescapedText.slice(0, 80)}`);
    index++;
  }
  
  // 如果没有文本，直接跳过（保持空数组）
  if (textSegments.length === 0) {
    logger.warn('未找到任何文本段落，保持空数组');
  }
  
  logger.debug(`共提取 ${textSegments.length} 个文本段落`);
  
  // 提取 <resources> 块
  const resourcesBlock = extractXMLTag(responseContent, 'resources');
  let resources = [];
  
  if (resourcesBlock && resourcesBlock.trim()) {
    const resourceTags = extractAllXMLTags(resourcesBlock, 'resource');
    logger.debug(`找到 ${resourceTags.length} 个 <resource> 标签`);
    
    resources = resourceTags
      .map((resourceXML, idx) => {
        try {
          const type = extractXMLTag(resourceXML, 'type');
          const source = extractXMLTag(resourceXML, 'source');
          const caption = extractXMLTag(resourceXML, 'caption');
          
          if (!type || !source) {
            logger.warn(`resource[${idx}] 缺少必需字段`);
            return null;
          }
          
          const resource = { type, source };
          if (caption) resource.caption = caption;
          
          return ResourceSchema.parse(resource);
        } catch (e) {
          logger.warn(`resource[${idx}] 解析或验证失败: ${e.message}`);
          return null;
        }
      })
      .filter(Boolean);
    
    logger.success(`成功解析并验证 ${resources.length} 个 resources`);
  } else {
    logger.debug('无 <resources> 块或为空');
  }
  
  // 提取 <emoji> 标签（可选，最多一个）
  const emojiBlock = extractXMLTag(responseContent, 'emoji');
  let emoji = null;
  
  if (emojiBlock && emojiBlock.trim()) {
    try {
      const source = extractXMLTag(emojiBlock, 'source');
      const caption = extractXMLTag(emojiBlock, 'caption');
      
      if (source) {
        emoji = { source };
        if (caption) emoji.caption = caption;
        logger.debug(`找到 <emoji> 标签: ${source.slice(0, 60)}`);
      } else {
        logger.warn('<emoji> 标签缺少 <source> 字段');
      }
    } catch (e) {
      logger.warn(`<emoji> 解析失败: ${e.message}`);
    }
  }
  
  // 最终验证整体结构
  try {
    const validated = SentraResponseSchema.parse({ textSegments, resources });
    //logger.success('协议验证通过');
    //logger.debug(`textSegments: ${validated.textSegments.length} 段`);
    //logger.debug(`resources: ${validated.resources.length} 个`);
    if (emoji) {
      //logger.debug(`emoji: ${emoji.source}`);
      validated.emoji = emoji;  // 添加 emoji 到返回结果
    }
    return validated;
  } catch (e) {
    logger.error('协议验证失败', e.errors);
    const fallback = { textSegments: textSegments.length > 0 ? textSegments : [response], resources: [] };
    if (emoji) fallback.emoji = emoji;  // 即使验证失败也保留 emoji
    return fallback;
  }
}

/**
 * 转换历史对话为 MCP FC 协议格式
 * 从 user 消息中提取 <sentra-result>，转换为对应的 <sentra-tools> assistant 消息
 * 
 * @param {Array} historyConversations - 原始历史对话数组 [{ role, content }]
 * @returns {Array} 转换后的对话数组（不包含 system）
 */
export function convertHistoryToMCPFormat(historyConversations) {
  const mcpConversation = [];
  let convertedCount = 0;
  let skippedCount = 0;
  
  for (const msg of historyConversations) {
    if (msg.role === 'system') {
      // MCP 有自己的 system prompt，跳过
      skippedCount++;
      continue;
    }
    
    if (msg.role === 'user') {
      // 检查是否包含 <sentra-result>
      const resultContent = extractXMLTag(msg.content, 'sentra-result');
      
      if (resultContent) {
        // 先提取并保留 <sentra-user-question> 部分（user 消息在前）
        const userQuestion = extractXMLTag(msg.content, 'sentra-user-question');
        if (userQuestion) {
          mcpConversation.push({
            role: 'user',
            content: `<sentra-user-question>\n${userQuestion}\n</sentra-user-question>`
          });
        }
        
        // 再提取 <sentra-result> 中的工具调用信息（assistant 消息在后）
        const aiName = extractXMLTag(resultContent, 'aiName');
        const argsContent = extractXMLTag(resultContent, 'args');
        
        if (aiName && argsContent) {
          // 构建标准的 <sentra-tools> 块（不带注释）
          const toolsXML = buildSentraToolsFromArgs(aiName, argsContent);
          
          mcpConversation.push({
            role: 'assistant',
            content: toolsXML
          });
          convertedCount++;
          logger.debug(`转换工具调用: ${aiName}`);
        }
      } else {
        // 没有 <sentra-result>，直接保留原始 user 消息
        mcpConversation.push(msg);
      }
    }
    
    if (msg.role === 'assistant') {
      // 检查是否包含 <sentra-response>（旧格式）
      const hasResponse = msg.content.includes('<sentra-response>');
      
      if (hasResponse) {
        // 旧格式的 assistant 消息，跳过（因为我们已经从 user 的 sentra-result 中提取了工具调用）
        skippedCount++;
        continue;
      } else {
        // 新格式或纯文本，保留
        mcpConversation.push(msg);
      }
    }
  }
  
  logger.debug(`MCP格式转换: ${historyConversations.length}条 → ${mcpConversation.length}条 (转换${convertedCount}个工具, 跳过${skippedCount}条)`);
  return mcpConversation;
}

/**
 * 从 <args> 内容构建 <sentra-tools> 块（MCP FC 标准格式）
 * 
 * @param {string} aiName - 工具名称
 * @param {string} argsContent - <args> 标签内的内容
 * @returns {string} <sentra-tools> XML 字符串
 */
function buildSentraToolsFromArgs(aiName, argsContent) {
  const xmlLines = ['<sentra-tools>'];
  
  xmlLines.push(`  <invoke name="${aiName}">`);
  
  // 解析 <args> 中的参数
  // 假设 argsContent 是 XML 格式，如 <city>上海</city><queryType>forecast</queryType>
  const paramMatches = argsContent.matchAll(/<(\w+)>([^<]*)<\/\1>/g);
  
  for (const match of paramMatches) {
    const paramName = match[1];
    const paramValue = match[2];
    xmlLines.push(`    <parameter name="${paramName}">${paramValue}</parameter>`);
  }
  
  xmlLines.push('  </invoke>');
  xmlLines.push('</sentra-tools>');
  
  return xmlLines.join('\n');
}
