// 帖子API - 适配RDS实际表结构
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// 获取帖子列表
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const forumId = req.query.forum_id || 1;
    
    // 查询帖子列表，关联users表获取作者名
    const [posts] = await pool.query(
      `SELECT p.id, p.forum_id, p.user_id, p.title, p.view_count, p.reply_count, 
              p.is_pinned, p.is_locked, p.status, p.created_at, p.updated_at,
              u.username as author
       FROM posts p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.forum_id = ? AND p.status = 'approved'
       ORDER BY p.is_pinned DESC, p.created_at DESC
       LIMIT ? OFFSET ?`,
      [forumId, limit, offset]
    );
    
    // 获取总数
    const [countResult] = await pool.query(
      "SELECT COUNT(*) as total FROM posts WHERE forum_id = ? AND status = 'approved'",
      [forumId]
    );
    
    res.json({ 
      success: true, 
      posts: posts.map(p => ({
        id: p.id,
        forum_id: p.forum_id,
        title: p.title,
        author: p.author || 'unknown',
        user_id: p.user_id,
        view_count: p.view_count || 0,
        reply_count: p.reply_count || 0,
        is_pinned: p.is_pinned || 0,
        is_locked: p.is_locked || 0,
        status: p.status,
        created_at: p.created_at,
        updated_at: p.updated_at
      })),
      total: countResult[0].total
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ success: false, error: '获取帖子列表失败: ' + error.message });
  }
});

// 获取单个帖子
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 查询帖子详情，关联users表获取作者信息
    const [posts] = await pool.query(
      `SELECT p.*, u.username as author, u.keeneed_id
       FROM posts p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.id = ?`,
      [id]
    );
    
    if (posts.length === 0) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    
    // 查询回复列表，关联users表获取回复者信息
    const [replies] = await pool.query(
      `SELECT c.id, c.post_id, c.user_id, c.content, c.created_at,
              u.username as author
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.post_id = ?
       ORDER BY c.created_at ASC`,
      [id]
    );
    
    // 更新浏览计数
    await pool.query('UPDATE posts SET view_count = view_count + 1 WHERE id = ?', [id]);
    
    const post = posts[0];
    res.json({ 
      success: true, 
      post: {
        id: post.id,
        forum_id: post.forum_id,
        title: post.title,
        content: post.content,
        author: post.author || 'unknown',
        keeneed_id: post.keeneed_id,
        user_id: post.user_id,
        view_count: post.view_count || 0,
        reply_count: post.reply_count || 0,
        is_pinned: post.is_pinned || 0,
        is_locked: post.is_locked || 0,
        status: post.status,
        created_at: post.created_at,
        updated_at: post.updated_at,
        replies: replies.map(r => ({
          id: r.id,
          post_id: r.post_id,
          user_id: r.user_id,
          content: r.content,
          author: r.author || 'unknown',
          created_at: r.created_at
        }))
      }
    });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ success: false, error: '获取帖子详情失败: ' + error.message });
  }
});

// 创建帖子
router.post('/', async (req, res) => {
  try {
    const { forum_id, user_id, title, content, status } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Title and content are required' });
    }
    
    if (!user_id) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }
    
    // 默认forum_id为1，status为pending（需要审核）
    const forumId = forum_id || 1;
    const postStatus = status || 'pending';
    
    const [result] = await pool.query(
      `INSERT INTO posts (forum_id, user_id, title, content, status, view_count, reply_count, is_pinned, is_locked)
       VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0)`,
      [forumId, user_id, title, content, postStatus]
    );
    
    res.status(201).json({ 
      success: true, 
      message: 'Post created successfully',
      post: {
        id: result.insertId,
        forum_id: forumId,
        user_id: user_id,
        title,
        content,
        status: postStatus,
        view_count: 0,
        reply_count: 0
      }
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ success: false, error: '创建帖子失败: ' + error.message });
  }
});

// 更新帖子
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, status, is_pinned, is_locked } = req.body;
    
    // 检查帖子是否存在
    const [posts] = await pool.query('SELECT * FROM posts WHERE id = ?', [id]);
    if (posts.length === 0) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    
    // 构建更新字段
    const updates = [];
    const params = [];
    
    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (content !== undefined) { updates.push('content = ?'); params.push(content); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (is_pinned !== undefined) { updates.push('is_pinned = ?'); params.push(is_pinned); }
    if (is_locked !== undefined) { updates.push('is_locked = ?'); params.push(is_locked); }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }
    
    params.push(id);
    
    await pool.query(`UPDATE posts SET ${updates.join(', ')} WHERE id = ?`, params);
    
    res.json({ success: true, message: 'Post updated successfully' });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ success: false, error: '更新帖子失败: ' + error.message });
  }
});

// 删除帖子
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查帖子是否存在
    const [posts] = await pool.query('SELECT * FROM posts WHERE id = ?', [id]);
    if (posts.length === 0) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    
    // 删除帖子（关联的comments会通过外键级联删除，如果有外键的话）
    // 先删除关联的评论
    await pool.query('DELETE FROM comments WHERE post_id = ?', [id]);
    // 删除帖子
    await pool.query('DELETE FROM posts WHERE id = ?', [id]);
    
    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ success: false, error: '删除帖子失败: ' + error.message });
  }
});

// 回复帖子
router.post('/:id/reply', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, content } = req.body;
    
    if (!content) {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }
    
    if (!user_id) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }
    
    // 检查帖子是否存在
    const [posts] = await pool.query('SELECT * FROM posts WHERE id = ?', [id]);
    if (posts.length === 0) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    
    // 插入回复到comments表
    const [result] = await pool.query(
      `INSERT INTO comments (post_id, user_id, content)
       VALUES (?, ?, ?)`,
      [id, user_id, content]
    );
    
    // 更新帖子的回复计数
    await pool.query('UPDATE posts SET reply_count = reply_count + 1 WHERE id = ?', [id]);
    
    // 获取回复者用户名
    const [users] = await pool.query('SELECT username FROM users WHERE id = ?', [user_id]);
    const author = users.length > 0 ? users[0].username : 'unknown';
    
    res.status(201).json({ 
      success: true, 
      message: 'Reply added successfully',
      reply: {
        id: result.insertId,
        post_id: parseInt(id),
        user_id: user_id,
        content,
        author,
        created_at: new Date()
      }
    });
  } catch (error) {
    console.error('Reply post error:', error);
    res.status(500).json({ success: false, error: '回复帖子失败: ' + error.message });
  }
});

// 删除回复
router.delete('/:postId/reply/:replyId', async (req, res) => {
  try {
    const { postId, replyId } = req.params;
    
    // 检查回复是否存在
    const [comments] = await pool.query('SELECT * FROM comments WHERE id = ? AND post_id = ?', [replyId, postId]);
    if (comments.length === 0) {
      return res.status(404).json({ success: false, error: 'Reply not found' });
    }
    
    // 删除回复
    await pool.query('DELETE FROM comments WHERE id = ?', [replyId]);
    
    // 更新帖子的回复计数
    await pool.query('UPDATE posts SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = ?', [postId]);
    
    res.json({ success: true, message: 'Reply deleted successfully' });
  } catch (error) {
    console.error('Delete reply error:', error);
    res.status(500).json({ success: false, error: '删除回复失败: ' + error.message });
  }
});

module.exports = router;
