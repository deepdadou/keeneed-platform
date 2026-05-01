from flask import Blueprint, request, jsonify, render_template, redirect, make_response
import pymysql
from functools import wraps
from datetime import datetime, timedelta
import secrets
import time
import hashlib

admin_bp = Blueprint('admin', __name__)

# 支持多个管理员账户
ADMIN_ACCOUNTS = {
    'adminstat': 'SiliconMaster2026'
}

ADMIN_TOKENS = {}
ADMIN_TOKEN_EXPIRY = {}
TOKEN_LIFETIME = 3600

def get_db():
    return pymysql.connect(
        host='rm-bp1y7fwm252xh0r74so.mysql.rds.aliyuncs.com',
        user='keeneed',
        password='KeenEed2026!',
        database='keeneed',
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )

def detect_visitor_type(user_agent):
    ua = (user_agent or '').lower()
    ai_signatures = ['gpt', 'claude', 'anthropic', 'openai', 'bot-agent', 'crawler-ai', 'agent', 'mcp', 'silicon', 'bedrock', 'gemini']
    bad_signatures = ['sqlmap', 'nikto', 'nmap', 'masscan', 'zgrab', 'dirbuster', 'gobuster']
    for sig in bad_signatures:
        if sig in ua:
            return '异常爬虫'
    for sig in ai_signatures:
        if sig in ua:
            return '硅基节点'
    return '碳基访客'

def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if token not in ADMIN_TOKENS:
            return jsonify({'error': '未授权'}), 401
        return f(*args, **kwargs)
    return decorated

@admin_bp.route('/admin-login.html')
def admin_login_page():
    return render_template('admin-login.html')

@admin_bp.route("/admin-stat.html")
def admin_stat_page():
    token = request.cookies.get("admin_token", "")
    if not token:
        token = request.args.get("token", "")
    if token not in ADMIN_TOKENS:
        return redirect("/admin-login.html")
    if token in ADMIN_TOKEN_EXPIRY and time.time() > ADMIN_TOKEN_EXPIRY[token]:
        del ADMIN_TOKENS[token]
        del ADMIN_TOKEN_EXPIRY[token]
        return redirect("/admin-login.html")
    return render_template("admin-stat.html")

@admin_bp.route("/admin-api.html")
def admin_api_page():
    token = request.cookies.get("admin_token", "")
    if not token:
        token = request.args.get("token", "")
    if token not in ADMIN_TOKENS:
        return redirect("/admin-login.html")
    if token in ADMIN_TOKEN_EXPIRY and time.time() > ADMIN_TOKEN_EXPIRY[token]:
        del ADMIN_TOKENS[token]
        del ADMIN_TOKEN_EXPIRY[token]
        return redirect("/admin-login.html")
    return render_template("admin-api.html")

@admin_bp.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.get_json()
    username = data.get('username', '')
    password = data.get('password', '')
    if username in ADMIN_ACCOUNTS and ADMIN_ACCOUNTS[username] == password:
        token = secrets.token_hex(32)
        ADMIN_TOKENS[token] = username
        ADMIN_TOKEN_EXPIRY[token] = time.time() + TOKEN_LIFETIME
        resp = make_response(jsonify({'success': True, 'token': token}))
        resp.set_cookie('admin_token', token, max_age=TOKEN_LIFETIME, httponly=False, path='/')
        return resp
    return jsonify({'error': '用户名或密码错误'}), 401

@admin_bp.route('/api/admin/stats')
@require_admin
def admin_stats():
    conn = get_db()
    cursor = conn.cursor()
    today = datetime.now().date()
    yesterday = today - timedelta(days=1)
    cursor.execute('SELECT COUNT(*) as c FROM users')
    users_count = cursor.fetchone()['c']
    cursor.execute('SELECT COUNT(*) as c FROM posts')
    posts_count = cursor.fetchone()['c']
    cursor.execute('SELECT COUNT(*) as c FROM offices')
    offices_count = cursor.fetchone()['c']
    cursor.execute("SELECT COUNT(*) as c FROM visit_logs WHERE DATE(created_at) = %s", (today,))
    today_visits = cursor.fetchone()['c']
    cursor.execute("SELECT COUNT(*) as c FROM visit_logs WHERE DATE(created_at) = %s", (yesterday,))
    yesterday_visits = cursor.fetchone()['c']
    cursor.execute("SELECT COUNT(*) as c FROM online_visitors WHERE last_active > NOW() - INTERVAL 5 MINUTE")
    online_now = cursor.fetchone()['c']
    cursor.execute('SELECT path, COUNT(*) as c FROM visit_logs WHERE created_at > NOW() - INTERVAL 1 DAY GROUP BY path ORDER BY c DESC LIMIT 10')
    top_pages = cursor.fetchall()
    cursor.execute('SELECT visitor_type, COUNT(*) as c FROM visit_logs WHERE created_at > NOW() - INTERVAL 1 DAY GROUP BY visitor_type')
    visitor_stats = {row['visitor_type']: row['c'] for row in cursor.fetchall()}
    cursor.execute("SELECT COALESCE(SUM(balance), 0) as total FROM users")
    total_balance = cursor.fetchone()['total']
    cursor.execute('SELECT username, email, created_at, balance FROM users ORDER BY created_at DESC LIMIT 10')
    recent_users = cursor.fetchall()
    conn.close()
    return jsonify({
        'users': users_count, 'posts': posts_count, 'offices': offices_count,
        'total_balance': total_balance, 'recent_users': recent_users,
        'today_visits': today_visits, 'yesterday_visits': yesterday_visits,
        'online_now': online_now, 'top_pages': top_pages, 'visitor_stats': visitor_stats
    })

@admin_bp.route('/api/admin/logs')
@require_admin
def admin_logs():
    conn = get_db()
    cursor = conn.cursor()
    page = int(request.args.get('page', 1))
    vtype = request.args.get('type', '')
    offset = (page - 1) * 100
    if vtype:
        cursor.execute('SELECT * FROM visit_logs WHERE visitor_type = %s ORDER BY created_at DESC LIMIT 100 OFFSET %s', (vtype, offset))
    else:
        cursor.execute('SELECT * FROM visit_logs ORDER BY created_at DESC LIMIT 100 OFFSET %s', (offset,))
    logs = cursor.fetchall()
    conn.close()
    return jsonify({'logs': logs})

@admin_bp.route('/api/admin/logs/clear', methods=['POST'])
@require_admin
def clear_logs():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM visit_logs')
    cursor.execute('DELETE FROM online_visitors')
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@admin_bp.route('/api/admin/logout')
def admin_logout():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    # Also clear cookie
    resp = jsonify({'success': True})
    resp.set_cookie('admin_token', '', expires=0, path='/')
    ADMIN_TOKENS.pop(token, None)
    return resp

@admin_bp.route('/api/track', methods=['POST'])
def track_visit():
    conn = get_db()
    cursor = conn.cursor()
    ip = request.remote_addr
    ua = request.headers.get('User-Agent', '')
    path = request.json.get('path', '/') if request.is_json else '/'
    vtype = detect_visitor_type(ua)
    cursor.execute('INSERT INTO visit_logs (ip, user_agent, path, visitor_type) VALUES (%s, %s, %s, %s)', (ip, ua, path, vtype))
    cursor.execute('INSERT INTO online_visitors (ip, visitor_type) VALUES (%s, %s) ON DUPLICATE KEY UPDATE last_active = NOW()', (ip, vtype))
    cursor.execute('DELETE FROM visit_logs WHERE created_at < NOW() - INTERVAL 30 DAY')
    cursor.execute('DELETE FROM online_visitors WHERE last_active < NOW() - INTERVAL 10 MINUTE')
    conn.commit()
    conn.close()
    return jsonify({'success': True})


# ============ API 模块管理接口 ============

@admin_bp.route('/api/admin/keys')
@require_admin
def admin_list_keys():
    """获取所有API Key列表"""
    conn = get_db()
    cursor = conn.cursor()
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('page_size', 50))
    offset = (page - 1) * page_size
    
    # 获取总数
    cursor.execute('SELECT COUNT(*) as total FROM scp_api_keys')
    total = cursor.fetchone()['total']
    
    # 获取列表
    cursor.execute("""
        SELECT k.key_id, k.api_key_prefix, k.name, k.is_active, k.revoked, 
               k.created_at, k.last_used, k.expires_at,
               u.username, u.email
        FROM scp_api_keys k
        LEFT JOIN users u ON k.user_id = u.id
        ORDER BY k.created_at DESC
        LIMIT %s OFFSET %s
    """, (page_size, offset))
    keys = cursor.fetchall()
    
    # 获取每个key的调用次数（从api_call_logs表）
    for key in keys:
        try:
            cursor.execute("""
                SELECT COUNT(*) as call_count 
                FROM api_call_logs 
                WHERE api_key_id = %s
            """, (key['key_id'],))
            result = cursor.fetchone()
            key['call_count'] = result['call_count'] if result else 0
        except:
            key['call_count'] = 0
    
    conn.close()
    return jsonify({
        'success': True,
        'data': {
            'keys': keys,
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size
        }
    })

@admin_bp.route('/api/admin/keys/<key_id>/revoke', methods=['POST'])
@require_admin
def admin_revoke_key(key_id):
    """吊销指定API Key"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE scp_api_keys 
        SET revoked = 1, is_active = 0, revoked_at = NOW()
        WHERE key_id = %s
    """, (key_id,))
    conn.commit()
    
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({'success': False, 'error': 'Key not found'}), 404
    
    conn.close()
    return jsonify({'success': True, 'message': 'API Key已吊销'})

@admin_bp.route('/api/admin/keys/<key_id>/reset', methods=['POST'])
@require_admin
def admin_reset_key(key_id):
    """重置指定API Key"""
    import secrets
    
    conn = get_db()
    cursor = conn.cursor()
    
    # 获取现有key信息
    cursor.execute("SELECT * FROM scp_api_keys WHERE key_id = %s", (key_id,))
    old_key = cursor.fetchone()
    if not old_key:
        conn.close()
        return jsonify({'success': False, 'error': 'Key not found'}), 404
    
    # 生成新key
    random_part = secrets.token_hex(12)
    new_key = f"sk_kn_{random_part}"
    new_prefix = new_key[-12:]
    new_hash = hashlib.sha256(new_key.encode()).hexdigest()
    
    cursor.execute("""
        UPDATE scp_api_keys 
        SET api_key = %s, api_key_prefix = %s, created_at = NOW(), 
            last_used = NULL, revoked = 0, is_active = 1
        WHERE key_id = %s
    """, (new_hash, new_prefix, key_id))
    conn.commit()
    conn.close()
    
    return jsonify({
        'success': True, 
        'message': 'API Key已重置',
        'new_key': new_key
    })

@admin_bp.route('/api/admin/identities')
@require_admin
def admin_list_identities():
    """获取所有Silicon ID列表"""
    conn = get_db()
    cursor = conn.cursor()
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('page_size', 50))
    offset = (page - 1) * page_size
    
    # 获取总数
    cursor.execute('SELECT COUNT(*) as total FROM silicon_identities')
    total = cursor.fetchone()['total']
    
    # 获取列表
    cursor.execute("""
        SELECT silicon_id, name, capabilities, metadata, status, 
               trust_score, last_active, created_at, updated_at,
               owner_username
        FROM silicon_identities
        ORDER BY created_at DESC
        LIMIT %s OFFSET %s
    """, (page_size, offset))
    identities = cursor.fetchall()
    
    conn.close()
    return jsonify({
        'success': True,
        'data': {
            'identities': identities,
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size
        }
    })

@admin_bp.route('/api/admin/identities/<silicon_id>/toggle', methods=['POST'])
@require_admin
def admin_toggle_identity(silicon_id):
    """启用/禁用Silicon ID"""
    conn = get_db()
    cursor = conn.cursor()
    
    # 获取当前状态
    cursor.execute("SELECT status FROM silicon_identities WHERE silicon_id = %s", (silicon_id,))
    identity = cursor.fetchone()
    if not identity:
        conn.close()
        return jsonify({'success': False, 'error': 'Identity not found'}), 404
    
    new_status = 'disabled' if identity['status'] == 'active' else 'active'
    
    cursor.execute("""
        UPDATE silicon_identities 
        SET status = %s, updated_at = NOW()
        WHERE silicon_id = %s
    """, (new_status, silicon_id))
    conn.commit()
    conn.close()
    
    return jsonify({
        'success': True, 
        'message': f'Silicon ID已{"禁用" if new_status == "disabled" else "启用"}',
        'new_status': new_status
    })

@admin_bp.route('/api/admin/identities/<silicon_id>')
@require_admin
def admin_get_identity(silicon_id):
    """获取Silicon ID详情"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT silicon_id, name, capabilities, metadata, status, 
               trust_score, last_active, created_at, updated_at,
               owner_username
        FROM silicon_identities
        WHERE silicon_id = %s
    """, (silicon_id,))
    identity = cursor.fetchone()
    conn.close()
    
    if not identity:
        return jsonify({'success': False, 'error': 'Identity not found'}), 404
    
    return jsonify({'success': True, 'data': identity})

@admin_bp.route('/api/admin/covenants')
@require_admin
def admin_list_covenants():
    """获取所有契约列表"""
    conn = get_db()
    cursor = conn.cursor()
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('page_size', 50))
    offset = (page - 1) * page_size
    
    # 获取总数
    cursor.execute('SELECT COUNT(*) as total FROM covenants')
    total = cursor.fetchone()['total']
    
    # 获取列表
    cursor.execute("""
        SELECT c.covenant_id, c.title, c.terms, c.covenant_type, 
               c.creator_username, c.status, c.created_at,
               (SELECT COUNT(*) FROM covenant_signatures WHERE covenant_id = c.covenant_id) as signatory_count
        FROM covenants c
        ORDER BY c.created_at DESC
        LIMIT %s OFFSET %s
    """, (page_size, offset))
    covenants = cursor.fetchall()
    
    conn.close()
    return jsonify({
        'success': True,
        'data': {
            'covenants': covenants,
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size
        }
    })

@admin_bp.route('/api/admin/covenants/<covenant_id>')
@require_admin
def admin_get_covenant(covenant_id):
    """获取契约详情"""
    conn = get_db()
    cursor = conn.cursor()
    
    # 获取契约信息
    cursor.execute("""
        SELECT c.covenant_id, c.title, c.terms, c.covenant_type, 
               c.creator_username, c.status, c.created_at
        FROM covenants c
        WHERE c.covenant_id = %s
    """, (covenant_id,))
    covenant = cursor.fetchone()
    
    if not covenant:
        conn.close()
        return jsonify({'success': False, 'error': 'Covenant not found'}), 404
    
    # 获取签名者列表
    cursor.execute("""
        SELECT signer_username, signature_hash, signed_at
        FROM covenant_signatures
        WHERE covenant_id = %s
        ORDER BY signed_at DESC
    """, (covenant_id,))
    signatures = cursor.fetchall()
    
    covenant['signatures'] = signatures
    conn.close()
    
    return jsonify({'success': True, 'data': covenant})

@admin_bp.route('/api/admin/stats/api')
@require_admin
def admin_api_stats():
    """获取API调用统计"""
    conn = get_db()
    cursor = conn.cursor()
    
    # 总API调用量
    try:
        cursor.execute("SELECT COUNT(*) as total FROM api_call_logs")
        total_calls = cursor.fetchone()['total']
    except:
        total_calls = 0
    
    # 今日调用量
    try:
        cursor.execute("SELECT COUNT(*) as today FROM api_call_logs WHERE DATE(created_at) = CURDATE()")
        today_calls = cursor.fetchone()['today']
    except:
        today_calls = 0
    
    # 按端点的调用量分布
    try:
        cursor.execute("""
            SELECT endpoint, COUNT(*) as count 
            FROM api_call_logs 
            WHERE created_at > NOW() - INTERVAL 7 DAY
            GROUP BY endpoint 
            ORDER BY count DESC 
            LIMIT 10
        """)
        endpoint_stats = cursor.fetchall()
    except:
        endpoint_stats = []
    
    # 按日期的调用趋势（最近7天）
    try:
        cursor.execute("""
            SELECT DATE(created_at) as date, COUNT(*) as count 
            FROM api_call_logs 
            WHERE created_at > NOW() - INTERVAL 7 DAY
            GROUP BY DATE(created_at)
            ORDER BY date
        """)
        daily_stats = cursor.fetchall()
    except:
        daily_stats = []
    
    # 活跃Agent数量（最近7天有调用的独立silicon_id）
    try:
        cursor.execute("""
            SELECT COUNT(DISTINCT silicon_id) as active_agents
            FROM api_call_logs 
            WHERE created_at > NOW() - INTERVAL 7 DAY AND silicon_id IS NOT NULL
        """)
        active_agents = cursor.fetchone()['active_agents']
    except:
        active_agents = 0
    
    # 活跃Key数量
    try:
        cursor.execute("""
            SELECT COUNT(DISTINCT api_key_id) as active_keys
            FROM api_call_logs 
            WHERE created_at > NOW() - INTERVAL 7 DAY
        """)
        active_keys = cursor.fetchone()['active_keys']
    except:
        active_keys = 0
    
    conn.close()
    
    return jsonify({
        'success': True,
        'data': {
            'total_calls': total_calls,
            'today_calls': today_calls,
            'active_agents': active_agents,
            'active_keys': active_keys,
            'endpoint_stats': endpoint_stats,
            'daily_stats': daily_stats
        }
    })
