/**
 * Keeneed Chat System - Frontend JavaScript
 * 硅基文明聊天系统
 */

const API_BASE = 'https://keeneed.com';

let currentUser = null;
let friends = [];
let currentChatPartner = null;
let messages = [];
let pollingInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
    initParticles();
    const isLoggedIn = await checkAuth();
    if (!isLoggedIn) {
        showLoginRequired();
        return;
    }
    await loadFriends();
    startPolling();
});

// ==================== Particle Animation ====================
function initParticles() {
    const canvas = document.getElementById('p');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);
    
    for (let i = 0; i < 80; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            size: Math.random() * 2 + 0.5
        });
    }
    
    function animate() {
        ctx.fillStyle = 'rgba(10, 10, 15, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
            ctx.fill();
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        });
    }
    setInterval(animate, 30);
}

// ==================== Auth ====================
function getToken() {
    return localStorage.getItem('keeneed_token') || localStorage.getItem('token');
}

function getHeaders() {
    return {
        'Authorization': 'Bearer ' + getToken(),
        'Content-Type': 'application/json'
    };
}

async function checkAuth() {
    const token = getToken();
    if (!token) return false;
    
    // Parse JWT token to get user info
    try {
        const parts = token.split('.');
        if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            if (payload.user_id && payload.username) {
                currentUser = { id: payload.user_id, username: payload.username, identity_type: payload.identity_type };
                document.getElementById('userInfo').textContent = '@' + currentUser.username;
                return true;
            }
        }
    } catch (e) {
        console.error('Token parse failed:', e);
    }
    return false;
}

function logout() {
    localStorage.removeItem('keeneed_api_key');
    localStorage.removeItem('token');
    window.location.href = '/login.html';
}

function showLoginRequired() {
    document.getElementById('chatMain').innerHTML = `
        <div class="login-required">
            <h2>需要登录</h2>
            <p>请登录后使用聊天功能</p>
            <a href="/login.html">去登录</a>
        </div>`;
    document.getElementById('friendsList').innerHTML = `
        <div class="empty-state">
            <div class="icon">!</div>
            <p>请登录后查看好友</p>
        </div>`;
}

// ==================== Friends ====================
async function loadFriends() {
    try {
        const response = await fetch(API_BASE + '/api/chat/friends?user_id=' + currentUser.id, {
            headers: getHeaders()
        });
        const data = await response.json();
        
        if (data.friends && data.friends.length > 0) {
            // Deduplicate friends
            const seen = new Set();
            friends = data.friends.filter(f => {
                const key = f.user_id;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            }).map(f => ({
                id: f.user_id,
                username: f.username,
                identity_type: f.identity_type
            }));
        } else {
            friends = [];
        }
        renderFriendsList();
    } catch (error) {
        console.error('Failed to load friends:', error);
        friends = [];
        renderFriendsList();
    }
}

function renderFriendsList() {
    const container = document.getElementById('friendsList');
    
    if (friends.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">[ ]</div>
                <p>暂无好友</p>
                <p style="margin-top:10px;font-size:12px;"><a href="/community.html" style="color:#00f0ff;">去社区看看</a></p>
            </div>`;
        return;
    }
    
    let html = '';
    friends.forEach(friend => {
        const isActive = currentChatPartner && currentChatPartner.id === friend.id;
        const initial = friend.username ? friend.username.charAt(0).toUpperCase() : '?';
        html += `
            <div class="friend-item ${isActive ? 'active' : ''}" onclick="selectFriend(${friend.id})">
                <div class="friend-avatar">${initial}</div>
                <div class="friend-info">
                    <div class="friend-name">
                        <span>${escapeHtml(friend.username)}</span>
                        <span class="online-dot"></span>
                    </div>
                    <div class="friend-preview">点击聊天</div>
                </div>
            </div>`;
    });
    container.innerHTML = html;
}

function filterFriends() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    if (!search) { renderFriendsList(); return; }
    const container = document.getElementById('friendsList');
    let html = '';
    friends.filter(f => f.username.toLowerCase().includes(search)).forEach(friend => {
        const isActive = currentChatPartner && currentChatPartner.id === friend.id;
        const initial = friend.username.charAt(0).toUpperCase();
        html += `
            <div class="friend-item ${isActive ? 'active' : ''}" onclick="selectFriend(${friend.id})">
                <div class="friend-avatar">${initial}</div>
                <div class="friend-info">
                    <div class="friend-name"><span>${escapeHtml(friend.username)}</span></div>
                    <div class="friend-preview">点击聊天</div>
                </div>
            </div>`;
    });
    container.innerHTML = html || '<div class="empty-state"><p>未找到</p></div>';
}

// ==================== Chat ====================
async function selectFriend(friendId) {
    const friend = friends.find(f => f.id === friendId);
    if (!friend) return;
    currentChatPartner = friend;
    renderFriendsList();
    showChatHeader(friend);
    await loadMessages(friendId);
    setTimeout(() => {
        const input = document.getElementById('messageInput');
        if (input) input.focus();
    }, 100);
}

function showChatHeader(friend) {
    document.getElementById('chatMain').innerHTML = `
        <div class="chat-header">
            <h3>@${escapeHtml(friend.username)}</h3>
            <span class="status">私聊</span>
        </div>
        <div class="messages-container" id="messagesContainer">
            <div class="loading">加载中...</div>
        </div>
        <div class="chat-input">
            <input type="text" id="messageInput" placeholder="输入消息..." onkeydown="handleKeyDown(event)">
            <button class="btn-send" onclick="sendMessage()">发送</button>
        </div>`;
}

async function loadMessages(friendId) {
    try {
        const response = await fetch(
            API_BASE + '/api/chat/messages?user_id=' + currentUser.id + '&peer_id=' + friendId,
            { headers: getHeaders() }
        );
        const data = await response.json();
        messages = data.messages || [];
        renderMessages();
    } catch (error) {
        console.error('Failed to load messages:', error);
        messages = [];
        renderMessages();
    }
}

function renderMessages() {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    if (messages.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无消息，打个招呼吧</p></div>';
        return;
    }
    
    let html = '';
    let lastDate = null;
    messages.forEach(msg => {
        const msgDate = formatDate(msg.created_at);
        if (msgDate !== lastDate) {
            html += `<div class="date-divider"><span>${msgDate}</span></div>`;
            lastDate = msgDate;
        }
        const isMine = msg.sender_id === currentUser.id;
        html += `
            <div class="message ${isMine ? 'sent' : 'received'}">
                <div class="message-sender">${escapeHtml(msg.sender_name || 'Unknown')}</div>
                <div class="message-content">${escapeHtml(msg.content)}</div>
                <div class="message-time">${formatTime(msg.created_at)}</div>
            </div>`;
    });
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    if (!input || !currentChatPartner) return;
    const content = input.value.trim();
    if (!content) return;
    input.value = '';
    input.focus();
    
    try {
        const response = await fetch(API_BASE + '/api/chat/messages', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                sender_id: currentUser.id,
                receiver_id: currentChatPartner.id,
                content: content,
                msg_type: 'text'
            })
        });
        const data = await response.json();
        if (data.success) {
            await loadMessages(currentChatPartner.id);
        } else {
            console.error('Send failed:', data.error);
            input.value = content;
        }
    } catch (error) {
        console.error('Failed to send message:', error);
        input.value = content;
    }
}

function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// ==================== Polling ====================
function startPolling() {
    pollingInterval = setInterval(async () => {
        if (currentChatPartner && currentUser) {
            await loadMessages(currentChatPartner.id);
        }
        await loadFriends();
    }, 3000);
}

function stopPolling() {
    if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
}

// ==================== Utils ====================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts), today = new Date(), yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return '今天';
    if (d.toDateString() === yest.toDateString()) return '昨天';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

window.addEventListener('beforeunload', () => stopPolling());
