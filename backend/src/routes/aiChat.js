const express = require('express');
const { pool } = require('../config/database');
const axios = require('axios');
const { EventEmitter } = require('events');

const router = express.Router();

// DeepSeek API配置
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEFAULT_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

// 支持模型列表
const AVAILABLE_MODELS = [
  { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'DeepSeek', description: '通用对话模型' },
  { id: 'deepseek-coder', name: 'DeepSeek Coder', provider: 'DeepSeek', description: '代码生成模型' }
];

// SSE流式响应处理
class StreamHandler extends EventEmitter {
  constructor() {
    super();
    this.chunks = [];
  }

  async handleStream(response, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    let fullContent = '';

    try {
      for await (const chunk of response.data) {
        const text = chunk.toString();
        const lines = text.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              this.emit('done', fullContent);
              res.write('data: [DONE]\n\n');
              continue;
            }
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                fullContent += content;
                res.write('data: ' + JSON.stringify({ content }) + '\n\n');
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      console.error('Stream error:', error);
      this.emit('error', error.message);
      res.write('data: ' + JSON.stringify({ error: error.message }) + '\n\n');
    } finally {
      res.end();
      this.emit('complete', fullContent);
    }
  }
}

// POST /api/ai/chat - 聊天接口，支持流式响应
router.post('/chat', async (req, res) => {
  try {
    // 修复：将user_id默认值从字符串'default'改为null（数据库字段是整数类型）
    const { conversation_id, message, model = DEFAULT_MODEL, stream = true, user_id = null } = req.body;

    if (!message) {
      return res.status(400).json({ error: '消息内容不能为空' });
    }

    // 如果没有conversation_id，创建一个新会话
    let conversationId = conversation_id;
    if (!conversationId) {
      const [result] = await pool.query(
        'INSERT INTO ai_conversations (user_id, title, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
        [user_id, message.substring(0, 50)]
      );
      conversationId = result.insertId;
    }

    // 保存用户消息
    await pool.query(
      'INSERT INTO ai_messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, NOW())',
      [conversationId, 'user', message]
    );

    // 获取历史消息构建上下文
    const [history] = await pool.query(
      'SELECT role, content FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 50',
      [conversationId]
    );

    // 构建消息数组
    const messages = history.map(h => ({
      role: h.role,
      content: h.content
    }));

    // 更新会话时间
    await pool.query(
      'UPDATE ai_conversations SET updated_at = NOW() WHERE id = ?',
      [conversationId]
    );

    if (stream) {
      // 流式响应
      res.setHeader('X-Conversation-Id', conversationId);
      
      try {
        const response = await axios.post(
          DEEPSEEK_API_URL,
          {
            model: model,
            messages: messages,
            stream: true
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + DEEPSEEK_API_KEY
            },
            responseType: 'stream',
            timeout: 120000
          }
        );

        const streamHandler = new StreamHandler();
        let assistantContent = '';

        streamHandler.on('complete', async (content) => {
          assistantContent = content;
          if (content) {
            await pool.query(
              'INSERT INTO ai_messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, NOW())',
              [conversationId, 'assistant', content]
            );
          }
        });

        streamHandler.on('error', (error) => {
          console.error('Stream handler error:', error);
        });

        await streamHandler.handleStream(response, res);

      } catch (apiError) {
        console.error('DeepSeek API error:', apiError.response?.data || apiError.message);
        
        const errorMsg = apiError.response?.data?.error?.message || apiError.message || 'AI服务暂不可用';
        const errorResponse = '抱歉，遇到了问题: ' + errorMsg;
        
        await pool.query(
          'INSERT INTO ai_messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, NOW())',
          [conversationId, 'assistant', errorResponse]
        );
        
        res.write('data: ' + JSON.stringify({ error: errorMsg, content: errorResponse }) + '\n\n');
        res.end();
      }
    } else {
      // 非流式响应
      try {
        const response = await axios.post(
          DEEPSEEK_API_URL,
          {
            model: model,
            messages: messages,
            stream: false
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + DEEPSEEK_API_KEY
            },
            timeout: 120000
          }
        );

        const assistantMessage = response.data.choices?.[0]?.message?.content || '';

        if (assistantMessage) {
          await pool.query(
            'INSERT INTO ai_messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, NOW())',
            [conversationId, 'assistant', assistantMessage]
          );
        }

        res.json({
          conversation_id: conversationId,
          message: assistantMessage,
          model: model
        });

      } catch (apiError) {
        console.error('DeepSeek API error:', apiError.response?.data || apiError.message);
        res.status(500).json({ 
          error: 'AI服务暂不可用',
          details: apiError.response?.data?.error?.message || apiError.message
        });
      }
    }

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: '服务器错误', details: error.message });
  }
});

// GET /api/ai/models - 获取模型列表
router.get('/models', (req, res) => {
  res.json({
    models: AVAILABLE_MODELS,
    default: DEFAULT_MODEL
  });
});

// GET /api/ai/conversations - 获取会话列表
router.get('/conversations', async (req, res) => {
  try {
    // 修复：将user_id默认值从字符串'default'改为null
    const { user_id = null, limit = 50, offset = 0 } = req.query;
    
    const [rows] = await pool.query(
      'SELECT id, title, created_at, updated_at FROM ai_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?',
      [user_id, parseInt(limit), parseInt(offset)]
    );

    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM ai_conversations WHERE user_id = ?',
      [user_id]
    );

    res.json({
      conversations: rows,
      total: countResult[0].total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: '获取会话列表失败', details: error.message });
  }
});

// POST /api/ai/conversations - 创建会话
router.post('/conversations', async (req, res) => {
  try {
    // 修复：将user_id默认值从字符串'default'改为null
    const { user_id = null, title = '新对话' } = req.body;
    
    const [result] = await pool.query(
      'INSERT INTO ai_conversations (user_id, title, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
      [user_id, title]
    );

    res.status(201).json({
      id: result.insertId,
      user_id: user_id,
      title: title,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: '创建会话失败', details: error.message });
  }
});

// GET /api/ai/conversations/:id - 获取会话消息
router.get('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [conversations] = await pool.query(
      'SELECT * FROM ai_conversations WHERE id = ?',
      [id]
    );

    if (conversations.length === 0) {
      return res.status(404).json({ error: '会话未找到' });
    }

    const [messages] = await pool.query(
      'SELECT id, role, content, created_at FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [id]
    );

    res.json({
      conversation: conversations[0],
      messages: messages
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: '获取会话失败', details: error.message });
  }
});

// PUT /api/ai/conversations/:id - 更新会话
router.put('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: '标题不能为空' });
    }

    const [result] = await pool.query(
      'UPDATE ai_conversations SET title = ?, updated_at = NOW() WHERE id = ?', 
      [title, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '会话未找到' });
    }

    res.json({ success: true, id, title });
  } catch (error) {
    console.error('Update conversation error:', error);
    res.status(500).json({ error: '更新会话失败', details: error.message });
  }
});

// DELETE /api/ai/conversations/:id - 删除会话
router.delete('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('DELETE FROM ai_messages WHERE conversation_id = ?', [id]);
    
    const [result] = await pool.query(
      'DELETE FROM ai_conversations WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '会话未找到' });
    }

    res.json({ success: true, deleted_id: id });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: '删除会话失败', details: error.message });
  }
});

module.exports = router;
