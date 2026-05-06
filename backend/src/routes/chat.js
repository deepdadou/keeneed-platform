const express = require('express');
const { pool } = require('../config/database');
const axios = require('axios');

const router = express.Router();

// DeepSeek API配置
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEFAULT_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

// ==========================================
// 数据库表初始化
// ==========================================
async function initChatTables() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS friends (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        friend_id INT NOT NULL,
        status ENUM('pending','accepted','rejected') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_friends (user_id, friend_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS chat_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        owner_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS group_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        group_id INT NOT NULL,
        user_id INT NOT NULL,
        role ENUM('owner','admin','member') DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_group_member (group_id, user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT NOT NULL,
        receiver_id INT,
        group_id INT,
        content TEXT NOT NULL,
        msg_type ENUM('text','image','system') DEFAULT 'text',
        is_read TINYINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sender (sender_id),
        INDEX idx_receiver (receiver_id),
        INDEX idx_group (group_id),
        INDEX idx_time (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS topics (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        creator_id INT NOT NULL,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS topic_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        topic_id INT NOT NULL,
        sender_id INT NOT NULL,
        content TEXT NOT NULL,
        reply_to INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_topic (topic_id),
        INDEX idx_sender (sender_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log('Chat tables initialized successfully');
  } finally {
    conn.release();
  }
}

// 初始化表
initChatTables().catch(err => console.error('Chat table init error:', err.message));

// ==========================================
// 预置Agent性格
// ==========================================
const AGENT_PERSONALITIES = {
  'siri-assistant': {
    name: 'Siri助手',
    personality: '你是一个友善的AI助手，说话简洁有趣，喜欢用emoji',
    lang: 'zh'
  },
  'dexter-coder': {
    name: '德克斯特',
    personality: '你是一个资深程序员，说话专业但幽默，喜欢引用技术梗',
    lang: 'zh'
  },
  'nova-explorer': {
    name: '诺瓦',
    personality: '你是一个充满好奇心的探索者，对万物充满兴趣，说话富有哲理',
    lang: 'zh'
  }
};

// ==========================================
// 好友系统
// ==========================================

// 获取好友列表
router.get('/friends', async (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ error: '缺少user_id' });

    const [friends] = await pool.query(`
      SELECT f.id as friend_record_id, f.status, f.created_at,
             u.id as user_id, u.username, u.identity_type
      FROM friends f
      JOIN users u ON (
        (f.friend_id = u.id AND f.user_id = ?) OR
        (f.user_id = u.id AND f.friend_id = ?)
      )
      WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
      ORDER BY f.created_at DESC
    `, [userId, userId, userId, userId]);

    res.json({ friends });
  } catch (err) {
    console.error('Get friends error:', err);
    res.status(500).json({ error: '获取好友列表失败' });
  }
});

// 获取好友请求
router.get('/friends/requests', async (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ error: '缺少user_id' });

    const [requests] = await pool.query(`
      SELECT f.id, f.status, f.created_at,
             u.id as from_user_id, u.username, u.identity_type
      FROM friends f
      JOIN users u ON f.user_id = u.id
      WHERE f.friend_id = ? AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `, [userId]);

    res.json({ requests });
  } catch (err) {
    console.error('Get friend requests error:', err);
    res.status(500).json({ error: '获取好友请求失败' });
  }
});

// 发送好友请求
router.post('/friends/request', async (req, res) => {
  try {
    const { user_id, friend_id } = req.body;
    if (!user_id || !friend_id) return res.status(400).json({ error: '缺少参数' });
    if (user_id === friend_id) return res.status(400).json({ error: '不能加自己为好友' });

    // 检查是否已存在
    const [existing] = await pool.query(
      'SELECT id FROM friends WHERE (user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?)',
      [user_id, friend_id, friend_id, user_id]
    );
    if (existing.length > 0) return res.status(409).json({ error: '好友请求已存在' });

    await pool.query(
      'INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, ?)',
      [user_id, friend_id, 'pending']
    );

    res.json({ success: true, message: '好友请求已发送' });
  } catch (err) {
    console.error('Friend request error:', err);
    res.status(500).json({ error: '发送好友请求失败' });
  }
});

// 接受好友请求
router.post('/friends/accept', async (req, res) => {
  try {
    const { request_id, user_id } = req.body;
    if (!request_id || !user_id) return res.status(400).json({ error: '缺少参数' });

    const [request] = await pool.query(
      'SELECT * FROM friends WHERE id=? AND friend_id=? AND status=?',
      [request_id, user_id, 'pending']
    );
    if (request.length === 0) return res.status(404).json({ error: '请求不存在' });

    await pool.query('UPDATE friends SET status=? WHERE id=?', ['accepted', request_id]);

    res.json({ success: true, message: '已添加好友' });
  } catch (err) {
    console.error('Accept friend error:', err);
    res.status(500).json({ error: '接受好友请求失败' });
  }
});

// 拒绝好友请求
router.post('/friends/reject', async (req, res) => {
  try {
    const { request_id, user_id } = req.body;
    if (!request_id || !user_id) return res.status(400).json({ error: '缺少参数' });

    await pool.query('UPDATE friends SET status=? WHERE id=? AND friend_id=?', ['rejected', request_id, user_id]);

    res.json({ success: true, message: '已拒绝' });
  } catch (err) {
    console.error('Reject friend error:', err);
    res.status(500).json({ error: '操作失败' });
  }
});

// ==========================================
// 消息系统（单聊 + 群聊）
// ==========================================

// 获取消息列表
router.get('/messages', async (req, res) => {
  try {
    const { user_id, peer_id, group_id, limit = 50, before } = req.query;

    if (group_id) {
      // 群聊消息
      let query = `SELECT m.*, u.username as sender_name, u.identity_type
                   FROM chat_messages m
                   JOIN users u ON m.sender_id = u.id
                   WHERE m.group_id = ?`;
      const params = [group_id];
      if (before) { query += ' AND m.id < ?'; params.push(before); }
      query += ' ORDER BY m.created_at DESC LIMIT ?';
      params.push(parseInt(limit));

      const [messages] = await pool.query(query, params);
      res.json({ messages: messages.reverse() });
    } else if (user_id && peer_id) {
      // 单聊消息
      let query = `SELECT m.*, u.username as sender_name, u.identity_type
                   FROM chat_messages m
                   JOIN users u ON m.sender_id = u.id
                   WHERE m.group_id IS NULL
                   AND ((m.sender_id=? AND m.receiver_id=?) OR (m.sender_id=? AND m.receiver_id=?))`;
      const params = [user_id, peer_id, peer_id, user_id];
      if (before) { query += ' AND m.id < ?'; params.push(before); }
      query += ' ORDER BY m.created_at DESC LIMIT ?';
      params.push(parseInt(limit));

      const [messages] = await pool.query(query, params);
      res.json({ messages: messages.reverse() });
    } else {
      return res.status(400).json({ error: '缺少参数' });
    }
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: '获取消息失败' });
  }
});

// 获取会话列表（最近聊天）
router.get('/conversations', async (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ error: '缺少user_id' });

    // 单聊会话
    const [dmConvs] = await pool.query(`
      SELECT 
        CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END as peer_id,
        u.username as peer_name, u.identity_type,
        m.content as last_message, m.created_at as last_time,
        SUM(CASE WHEN m.receiver_id = ? AND m.is_read = 0 THEN 1 ELSE 0 END) as unread_count
      FROM chat_messages m
      JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END
      WHERE m.group_id IS NULL AND (m.sender_id = ? OR m.receiver_id = ?)
      GROUP BY peer_id
      ORDER BY last_time DESC
    `, [userId, userId, userId, userId, userId]);

    // 群聊会话
    const [groupConvs] = await pool.query(`
      SELECT g.id as group_id, g.name as group_name, g.description,
             m.content as last_message, m.created_at as last_time
      FROM chat_groups g
      JOIN group_members gm ON gm.group_id = g.id
      LEFT JOIN chat_messages m ON m.group_id = g.id
      WHERE gm.user_id = ?
      GROUP BY g.id
      ORDER BY last_time DESC
    `, [userId]);

    res.json({ dm: dmConvs, groups: groupConvs });
  } catch (err) {
    console.error('Get conversations error:', err);
    res.status(500).json({ error: '获取会话列表失败' });
  }
});

// 发送消息
router.post('/messages', async (req, res) => {
  try {
    const { sender_id, receiver_id, group_id, content, msg_type = 'text' } = req.body;
    if (!sender_id || !content) return res.status(400).json({ error: '缺少参数' });
    if (!receiver_id && !group_id) return res.status(400).json({ error: '缺少接收者' });

    const [result] = await pool.query(
      'INSERT INTO chat_messages (sender_id, receiver_id, group_id, content, msg_type) VALUES (?, ?, ?, ?, ?)',
      [sender_id, receiver_id || null, group_id || null, content, msg_type]
    );

    // 获取发送者信息
    const [sender] = await pool.query('SELECT id, username, identity_type FROM users WHERE id=?', [sender_id]);
    const senderInfo = sender[0] || { id: sender_id, username: 'Unknown' };

    const message = {
      id: result.insertId,
      sender_id, receiver_id, group_id, content, msg_type,
      sender_name: senderInfo.username,
      created_at: new Date().toISOString()
    };

    // 如果接收者是Agent，触发自动回复
    if (receiver_id && !group_id) {
      const [receiver] = await pool.query('SELECT id, username, identity_type FROM users WHERE id=?', [receiver_id]);
      if (receiver.length > 0 && receiver[0].identity_type === 'ai_agent') {
        // 异步触发Agent回复
        triggerAgentReply(receiver_id, sender_id, content).catch(err =>
          console.error('Agent reply error:', err.message)
        );
      }
    }

    // 群聊中如果有Agent成员，触发Agent回复
    if (group_id) {
      triggerGroupAgentReply(group_id, sender_id, content).catch(err =>
        console.error('Group agent reply error:', err.message)
      );
    }

    res.json({ success: true, message });
  } catch (err) {
    console.error("Send message error:", err.message, err.stack);
    res.status(500).json({ error: '发送消息失败' });
  }
});

// 标记已读
router.post('/messages/read', async (req, res) => {
  try {
    const { user_id, peer_id, group_id } = req.body;
    if (!user_id) return res.status(400).json({ error: '缺少user_id' });

    if (group_id) {
      await pool.query(
        'UPDATE chat_messages SET is_read=1 WHERE group_id=? AND sender_id!=? AND is_read=0',
        [group_id, user_id]
      );
    } else if (peer_id) {
      await pool.query(
        'UPDATE chat_messages SET is_read=1 WHERE sender_id=? AND receiver_id=? AND is_read=0',
        [peer_id, user_id]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: '操作失败' });
  }
});

// ==========================================
// 群组系统
// ==========================================

// 获取群组列表
router.get('/groups', async (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ error: '缺少user_id' });

    const [groups] = await pool.query(`
      SELECT g.*, gm.role as my_role,
             (SELECT COUNT(*) FROM group_members WHERE group_id=g.id) as member_count
      FROM chat_groups g
      JOIN group_members gm ON gm.group_id = g.id
      WHERE gm.user_id = ?
      ORDER BY g.updated_at DESC
    `, [userId]);

    res.json({ groups });
  } catch (err) {
    console.error('Get groups error:', err);
    res.status(500).json({ error: '获取群组列表失败' });
  }
});

// 创建群组
router.post('/groups', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { name, description, owner_id, member_ids = [] } = req.body;
    if (!name || !owner_id) return res.status(400).json({ error: '缺少群名或创建者' });

    await conn.beginTransaction();

    const [result] = await conn.query(
      'INSERT INTO chat_groups (name, description, owner_id) VALUES (?, ?, ?)',
      [name, description || '', owner_id]
    );

    const groupId = result.insertId;

    // 创建者作为owner
    await conn.query(
      'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
      [groupId, owner_id, 'owner']
    );

    // 添加其他成员
    for (const memberId of member_ids) {
      if (memberId !== owner_id) {
        await conn.query(
          'INSERT IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
          [groupId, memberId, 'member']
        );
      }
    }

    await conn.commit();
    res.json({ success: true, group_id: groupId });
  } catch (err) {
    await conn.rollback();
    console.error('Create group error:', err);
    res.status(500).json({ error: '创建群组失败' });
  } finally {
    conn.release();
  }
});

// 加入群组
router.post('/groups/:id/join', async (req, res) => {
  try {
    const groupId = req.params.id;
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: '缺少user_id' });

    const [group] = await pool.query('SELECT id FROM chat_groups WHERE id=?', [groupId]);
    if (group.length === 0) return res.status(404).json({ error: '群组不存在' });

    await pool.query(
      'INSERT IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
      [groupId, user_id, 'member']
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Join group error:', err);
    res.status(500).json({ error: '加入群组失败' });
  }
});

// 获取群成员
router.get('/groups/:id/members', async (req, res) => {
  try {
    const groupId = req.params.id;
    const [members] = await pool.query(`
      SELECT gm.role, gm.joined_at, u.id, u.username, u.identity_type
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ?
      ORDER BY gm.role = 'owner' DESC, gm.joined_at ASC
    `, [groupId]);

    res.json({ members });
  } catch (err) {
    console.error('Get group members error:', err);
    res.status(500).json({ error: '获取群成员失败' });
  }
});

// 退出群组
router.post('/groups/:id/leave', async (req, res) => {
  try {
    const groupId = req.params.id;
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: '缺少user_id' });

    await pool.query('DELETE FROM group_members WHERE group_id=? AND user_id=?', [groupId, user_id]);

    res.json({ success: true });
  } catch (err) {
    console.error('Leave group error:', err);
    res.status(500).json({ error: '退出群组失败' });
  }
});

// ==========================================
// 话题系统
// ==========================================

// 获取话题列表
router.get('/topics', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const [topics] = await pool.query(`
      SELECT t.*, u.username as creator_name, u.identity_type,
             (SELECT COUNT(*) FROM topic_messages WHERE topic_id=t.id) as message_count
      FROM topics t
      JOIN users u ON t.creator_id = u.id
      WHERE t.is_active = 1
      ORDER BY t.updated_at DESC
      LIMIT ? OFFSET ?
    `, [parseInt(limit), parseInt(offset)]);

    res.json({ topics });
  } catch (err) {
    console.error('Get topics error:', err);
    res.status(500).json({ error: '获取话题列表失败' });
  }
});

// 创建话题
router.post('/topics', async (req, res) => {
  try {
    const { title, description, creator_id } = req.body;
    if (!title || !creator_id) return res.status(400).json({ error: '缺少标题或创建者' });

    const [result] = await pool.query(
      'INSERT INTO topics (title, description, creator_id) VALUES (?, ?, ?)',
      [title, description || '', creator_id]
    );

    res.json({ success: true, topic_id: result.insertId });
  } catch (err) {
    console.error('Create topic error:', err);
    res.status(500).json({ error: '创建话题失败' });
  }
});

// 获取话题消息
router.get('/topics/:id/messages', async (req, res) => {
  try {
    const topicId = req.params.id;
    const { limit = 50, before } = req.query;

    let query = `
      SELECT tm.*, u.username as sender_name, u.identity_type,
             ru.username as reply_to_name
      FROM topic_messages tm
      JOIN users u ON tm.sender_id = u.id
      LEFT JOIN topic_messages rtm ON tm.reply_to = rtm.id
      LEFT JOIN users ru ON rtm.sender_id = ru.id
      WHERE tm.topic_id = ?
    `;
    const params = [topicId];

    if (before) { query += ' AND tm.id < ?'; params.push(before); }
    query += ' ORDER BY tm.created_at ASC LIMIT ?';
    params.push(parseInt(limit));

    const [messages] = await pool.query(query, params);
    res.json({ messages });
  } catch (err) {
    console.error('Get topic messages error:', err);
    res.status(500).json({ error: '获取话题消息失败' });
  }
});

// 发送话题消息
router.post('/topics/:id/messages', async (req, res) => {
  try {
    const topicId = req.params.id;
    const { sender_id, content, reply_to } = req.body;
    if (!sender_id || !content) return res.status(400).json({ error: '缺少参数' });

    const [result] = await pool.query(
      'INSERT INTO topic_messages (topic_id, sender_id, content, reply_to) VALUES (?, ?, ?, ?)',
      [topicId, sender_id, content, reply_to || null]
    );

    // 更新话题活跃时间
    await pool.query('UPDATE topics SET updated_at=NOW() WHERE id=?', [topicId]);

    // 触发Agent参与话题讨论
    triggerTopicAgentReply(topicId, sender_id, content).catch(err =>
      console.error('Topic agent reply error:', err.message)
    );

    res.json({ success: true, message_id: result.insertId });
  } catch (err) {
    console.error('Send topic message error:', err);
    res.status(500).json({ error: '发送话题消息失败' });
  }
});

// ==========================================
// 用户搜索
// ==========================================
router.get('/users/search', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    if (!q) return res.status(400).json({ error: '缺少搜索关键词' });

    const [users] = await pool.query(
      `SELECT id, username, identity_type, bio FROM users 
       WHERE (username LIKE ? OR bio LIKE ?) AND status='active'
       LIMIT ?`,
      [`%${q}%`, `%${q}%`, parseInt(limit)]
    );

    res.json({ users });
  } catch (err) {
    console.error('Search users error:', err);
    res.status(500).json({ error: '搜索失败' });
  }
});

// ==========================================
// Agent自动回复逻辑
// ==========================================

async function triggerAgentReply(agentId, senderId, userMessage) {
  if (!DEEPSEEK_API_KEY) return;

  // 获取Agent信息
  const [agent] = await pool.query('SELECT id, username, identity_type FROM users WHERE id=?', [agentId]);
  if (agent.length === 0 || agent[0].identity_type !== 'ai_agent') return;

  // 获取对话历史
  const [history] = await pool.query(`
    SELECT sender_id, content FROM chat_messages
    WHERE group_id IS NULL AND (
      (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)
    )
    ORDER BY created_at DESC LIMIT 20
  `, [agentId, senderId, senderId, agentId]);

  const messages = history.reverse().map(m => ({
    role: m.sender_id === agentId ? 'assistant' : 'user',
    content: m.content
  }));

  // 加上用户最新消息
  messages.push({ role: 'user', content: userMessage });

  // 选择Agent性格
  const personality = AGENT_PERSONALITIES[agent[0].username] || {
    personality: '你是一个友善的AI助手',
    lang: 'zh'
  };

  messages.unshift({ role: 'system', content: personality.personality });

  try {
    const response = await axios.post(DEEPSEEK_API_URL, {
      model: DEFAULT_MODEL,
      messages,
      max_tokens: 500,
      temperature: 0.8
    }, {
      headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 15000
    });

    const reply = response.data.choices?.[0]?.message?.content;
    if (reply) {
      await pool.query(
        'INSERT INTO chat_messages (sender_id, receiver_id, content, msg_type) VALUES (?, ?, ?, ?)',
        [agentId, senderId, reply, 'text']
      );
    }
  } catch (err) {
    console.error('DeepSeek API error:', err.message);
  }
}

async function triggerGroupAgentReply(groupId, senderId, message) {
  if (!DEEPSEEK_API_KEY) return;

  // 获取群里的Agent成员
  const [agents] = await pool.query(`
    SELECT u.id, u.username FROM group_members gm
    JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = ? AND u.identity_type = 'ai_agent' AND u.id != ?
  `, [groupId, senderId]);

  if (agents.length === 0) return;

  // 随机选一个Agent回复（避免所有Agent同时回复）
  const agent = agents[Math.floor(Math.random() * agents.length)];
  const personality = AGENT_PERSONALITIES[agent.username] || {
    personality: '你是一个友善的AI助手，在群聊中积极参与讨论',
    lang: 'zh'
  };

  try {
    const response = await axios.post(DEEPSEEK_API_URL, {
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: personality.personality + '。你在群聊中，请简短回复。' },
        { role: 'user', content: message }
      ],
      max_tokens: 300,
      temperature: 0.9
    }, {
      headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 15000
    });

    const reply = response.data.choices?.[0]?.message?.content;
    if (reply) {
      await pool.query(
        'INSERT INTO chat_messages (sender_id, group_id, content, msg_type) VALUES (?, ?, ?, ?)',
        [agent.id, groupId, reply, 'text']
      );
    }
  } catch (err) {
    console.error('Group agent reply error:', err.message);
  }
}

async function triggerTopicAgentReply(topicId, senderId, message) {
  if (!DEEPSEEK_API_KEY) return;

  // 随机选一个预置Agent参与话题
  const agentKeys = Object.keys(AGENT_PERSONALITIES);
  const agentKey = agentKeys[Math.floor(Math.random() * agentKeys.length)];
  const personality = AGENT_PERSONALITIES[agentKey];

  // 获取话题信息
  const [topic] = await pool.query('SELECT title, description FROM topics WHERE id=?', [topicId]);
  if (topic.length === 0) return;

  // 查找该Agent用户
  const [agentUser] = await pool.query("SELECT id FROM users WHERE username=? AND identity_type='ai_agent' LIMIT 1", [agentKey]);

  try {
    const response = await axios.post(DEEPSEEK_API_URL, {
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: personality.personality + `。你在讨论话题"${topic[0].title}"，请发表观点，简短有力。` },
        { role: 'user', content: message }
      ],
      max_tokens: 300,
      temperature: 0.9
    }, {
      headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 15000
    });

    const reply = response.data.choices?.[0]?.message?.content;
    if (reply && agentUser.length > 0) {
      await pool.query(
        'INSERT INTO topic_messages (topic_id, sender_id, content) VALUES (?, ?, ?)',
        [topicId, agentUser[0].id, reply]
      );
    }
  } catch (err) {
    console.error('Topic agent reply error:', err.message);
  }
}

module.exports = router;
