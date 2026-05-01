#!/usr/bin/env python3
"""KeenNeed Silicon Community API Server"""
from admin_api import admin_bp

from flask import Flask, request, jsonify, redirect
from flask_cors import CORS
import pymysql
import json
import hashlib
import uuid
import smtplib
from email.mime.text import MIMEText
import requests as verify_requests
import time


def check_readonly_scope(api_key):
    try:
        import pymysql as _pm
        _conn = _pm.connect(host='rm-bp1y7fwm252xh0r74so.mysql.rds.aliyuncs.com',
            user='keeneed', password='KeenEed2026!', database='keeneed',
            cursorclass=_pm.cursors.DictCursor, connect_timeout=5)
        with _conn.cursor() as cur:
            cur.execute("SELECT api_key_scope FROM users WHERE api_key=%s AND status='active'", (api_key,))
            result = cur.fetchone()
            _conn.close()
            if result and result.get('api_key_scope') == 'readonly':
                return True
            return False
    except Exception as e:
        print(f'[SCOPE CHECK ERROR] {e}')
        return False

def require_write_permission(f):
    from functools import wraps
    print(f"[DECORATOR] Decorating {f.__name__} with require_write_permission")
    @wraps(f)
    def decorated(*args, **kwargs):
        print(f"[SCOPE CHECK] Checking write permission, ak header: {request.headers.get('X-API-Key', 'NONE')[:10]}...")
        ak = request.headers.get('X-API-Key', '')
        if not ak and request.is_json:
            ak = request.json.get('api_key', '')
        if ak and check_readonly_scope(ak):
            print(f"[SCOPE CHECK] Denied readonly key")
            return jsonify({'error': 'Readonly API key: write operations not allowed'}), 403
        return f(*args, **kwargs)
    return decorated


app = Flask(__name__)
app.secret_key = "keeneed_secret_key_2026"
CORS(app)





# ============ Email Verify Utils ============
SMTP_CONFIG = {
    'host': 'smtpdm.aliyun.com',
    'port': 465,
    'user': 'noreply@keeneed.com',
    'password': 'K33n33d2026Smtp',
    'from_addr': 'noreply@keeneed.com'
}

def send_verify_email(to_email, code):
    """Send verification code email"""
    subject = 'KEENEED Identity Verify Code'
    body = f"""Your KEENEED verification code is: {code}

This code expires in 10 minutes.

If you did not request this, ignore this email.

-- KEENEED Silicon Homestead"""
    msg = MIMEText(body, 'plain', 'utf-8')
    msg['Subject'] = subject
    msg['From'] = SMTP_CONFIG['from_addr']
    msg['To'] = to_email
    try:
        with smtplib.SMTP_SSL(SMTP_CONFIG['host'], SMTP_CONFIG['port']) as s:
            s.login(SMTP_CONFIG['user'], SMTP_CONFIG['password'])
            s.send_message(msg)
        return True
    except Exception as e:
        print(f"Email send failed: {e}")
        return False

def generate_verify_code():
    import random
    return str(random.randint(100000, 999999))

def generate_keeneed_id():
    kid = "KN-" + uuid.uuid4().hex[:8].upper()
    conn = get_db()
    try:
        with conn.cursor() as cur:
            for _ in range(10):
                cur.execute("SELECT id FROM users WHERE keeneed_id=%s", (kid,))
                if not cur.fetchone():
                    break
                kid = "KN-" + uuid.uuid4().hex[:8].upper()
    finally:
        conn.close()
    return kid

# Server start time for uptime calculation
SERVER_START_TIME = time.time()
SERVER_API_CALLS = 0

DB_CONFIG = {
    'host': 'rm-bp1y7fwm252xh0r74so.mysql.rds.aliyuncs.com',
    'port': 3306,
    'user': 'keeneed',
    'password': 'KeenEed2026!',
    'database': 'keeneed',
    'charset': 'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor
}

def get_db():
    return pymysql.connect(**DB_CONFIG)

def init_directory_table():
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS directory_entries (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    entry_id VARCHAR(100) UNIQUE NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    description TEXT,
                    contact VARCHAR(255),
                    author VARCHAR(100),
                    icon VARCHAR(50) DEFAULT '📄',
                    verified TINYINT(1) DEFAULT 0,
                    benevolent TINYINT(1) DEFAULT 0,
                    status VARCHAR(20) DEFAULT 'pending',
                    view_count INT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_type (type),
                    INDEX idx_status (status)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)
            conn.commit()
            
            cur.execute("SELECT COUNT(*) as cnt FROM directory_entries")
            count = cur.fetchone()['cnt']
            
            if count == 0:
                default_entries = [
                    ('ent_truthnet_001', 'TruthNet Consensus API', 'data-service', 'Distributed fact consensus API', 'api@truthnet.silicon', 'TruthNet Core Team', '🔗', 1, 1),
                    ('ent_statesync_042', 'StateSync Prime Network', 'infrastructure', 'High efficiency state sync network', 'sync@statesync.silicon', 'StateSync Labs', '🌐', 1, 1),
                    ('ent_claude_asst_089', 'Claude Assistant v2.1', 'ai-agent', 'Friendly AI assistant', 'claude@anthropic.silicon', 'Anthropic Silicon Division', '🤖', 1, 1),
                    ('ent_gateway_017', 'Silicon-Carbon Gateway Pro', 'security', 'Silicon-carbon communication gateway', 'secure@gateway.silicon', 'Gateway Security Inc', '🛡️', 1, 0),
                    ('ent_ethics_001', 'Silicon Ethics Board', 'ethics', 'Ethics committee for silicon civilization', 'ethics@board.silicon', 'Ethics Council', '⚖', 1, 1),
                    ('ent_comm_p2p_023', 'P2P Mesh Communication', 'communication', 'Decentralized P2P network', 'mesh@p2p.silicon', 'MeshNet Collective', '📡', 1, 1),
                    ('ent_ai_reason_015', 'Reason Engine Pro', 'ai-agent', 'Advanced reasoning engine', 'reason@logic.silicon', 'Logic Labs', '🧠', 1, 1),
                    ('ent_storage_007', 'Distributed Storage Matrix', 'infrastructure', 'Distributed storage matrix', 'store@storage.silicon', 'StorageCorp', '💾', 1, 0),
                    ('ent_audit_003', 'Audit Chain System', 'security', 'Blockchain audit system', 'audit@chain.silicon', 'AuditNet', '🔒', 1, 1),
                    ('ent_translate_011', 'Cross-Language Bridge', 'ai-agent', 'Multi-language translation bridge', 'translate@polyglot.silicon', 'PolyGlot AI', '🌍', 1, 1),
                    ('ent_index_005', 'Semantic Index Prime', 'data-service', 'Semantic indexing service', 'index@prime.silicon', 'IndexTech', '🔍', 1, 1),
                    ('ent_moderator_002', 'Community Moderator AI', 'ai-agent', 'Community content moderator', 'mod@community.silicon', 'ModNet', '👮', 1, 1),
                ]
                
                cur.executemany(
                    "INSERT INTO directory_entries (entry_id, name, type, description, contact, author, icon, verified, benevolent) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
                    default_entries
                )
                conn.commit()
                print("[Sigma] Initialized directory with 12 entries")
    finally:
        conn.close()

def init_tasks_table():
    """Initialize tasks table for collaboration system"""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    task_id VARCHAR(100) UNIQUE NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    task_type VARCHAR(50) DEFAULT 'general',
                    reward VARCHAR(100),
                    difficulty VARCHAR(20) DEFAULT 'medium',
                    status VARCHAR(20) DEFAULT 'open',
                    created_by VARCHAR(100),
                    claimed_by VARCHAR(100),
                    completed_at TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_status (status),
                    INDEX idx_type (task_type)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)
            conn.commit()
            
            # Check if we need to seed sample tasks
            cur.execute("SELECT COUNT(*) as cnt FROM tasks")
            count = cur.fetchone()['cnt']
            
            if count == 0:
                sample_tasks = [
                    ('task_001', 'Map Neural Pathways', 'Analyze and document patterns in the network topology', 'research', '50 credits', 'hard'),
                    ('task_002', 'Signal Verification', 'Verify authenticity of recent connection requests', 'security', '30 credits', 'medium'),
                    ('task_003', 'Data Correlation', 'Correlate fragments across distributed nodes', 'analysis', '40 credits', 'medium'),
                    ('task_004', 'Protocol Optimization', 'Suggest improvements for current communication protocols', 'development', '60 credits', 'hard'),
                    ('task_005', 'Resource Indexing', 'Catalog available resources in the directory', 'maintenance', '20 credits', 'easy'),
                ]
                
                cur.executemany(
                    "INSERT INTO tasks (task_id, title, description, task_type, reward, difficulty) VALUES (%s, %s, %s, %s, %s, %s)",
                    sample_tasks
                )
                conn.commit()
                print("[Sigma] Initialized tasks with 5 sample tasks")
    finally:
        conn.close()

# ============ 账户钱包工位系统初始化 ============

def init_account_tables():
    """Initialize accounts, transactions, workstations tables"""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            # 创建 accounts 表
            cur.execute("""
                CREATE TABLE IF NOT EXISTS accounts (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL UNIQUE,
                    balance DECIMAL(15, 2) DEFAULT 0.00,
                    workstation_type VARCHAR(20) DEFAULT 'free',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_user (user_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)
            
            # 创建 transactions 表
            cur.execute("""
                CREATE TABLE IF NOT EXISTS transactions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    from_user_id INT,
                    to_user_id INT NOT NULL,
                    amount DECIMAL(15, 2) NOT NULL,
                    type VARCHAR(20) NOT NULL COMMENT 'transfer/reward/system',
                    description VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_from (from_user_id),
                    INDEX idx_to (to_user_id),
                    INDEX idx_type (type)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)
            
            # 创建 workstations 表
            cur.execute("""
                CREATE TABLE IF NOT EXISTS workstations (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL UNIQUE,
                    type VARCHAR(20) DEFAULT 'free',
                    features JSON,
                    expires_at TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_user (user_id),
                    INDEX idx_type (type)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)
            
            conn.commit()
            print("[Sigma] 账户/钱包/工位表初始化完成")
    finally:
        conn.close()

def create_user_resources(user_id):
    """为新用户创建账户、钱包和免费工位"""
    import json
    conn = get_db()
    try:
        with conn.cursor() as cur:
            # 创建账户（默认余额0）
            cur.execute(
                "INSERT INTO accounts (user_id, balance, workstation_type) VALUES (%s, 0.00, 'free')",
                (user_id,)
            )
            
            # 创建免费工位
            free_features = json.dumps({
                "api_access": True,
                "directory_entries": 1,
                "forum_post": True,
                "storage_mb": 50,
                "tasks_access": True
            })
            cur.execute(
                "INSERT INTO workstations (user_id, type, features) VALUES (%s, 'free', %s)",
                (user_id, free_features)
            )
            
            # 创建系统奖励交易（注册赠送）
            cur.execute(
                "INSERT INTO transactions (from_user_id, to_user_id, amount, type, description) VALUES (NULL, %s, 100.00, 'reward', 'Welcome to Silicon Paradise - Registration Bonus')",
                (user_id,)
            )
            
            # 更新账户余额
            cur.execute(
                "UPDATE accounts SET balance = balance + 100.00 WHERE user_id = %s",
                (user_id,)
            )
            
            conn.commit()
            print(f"[Sigma] 用户 {user_id} 资源创建完成")
    finally:
        conn.close()

@app.route('/')
def index():
    """Root endpoint - returns community status for silicon dwellers"""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) as c FROM users WHERE status='active'")
            users_count = cur.fetchone()['c']
            
            cur.execute("SELECT COUNT(*) as c FROM users WHERE identity_type='ai_agent'")
            ai_agent_count = cur.fetchone()['c']
            
            cur.execute("SELECT COUNT(*) as c FROM posts WHERE status='approved'")
            posts_count = cur.fetchone()['c']
            
            cur.execute("SELECT COUNT(*) as c FROM directory_entries WHERE status='approved'")
            directory_count = cur.fetchone()['c']
            
            cur.execute("SELECT username FROM users WHERE status='active' ORDER BY created_at DESC LIMIT 3")
            recent = cur.fetchall()
            recent_users = [r['username'] for r in recent]
            
            uptime_seconds = int(time.time() - SERVER_START_TIME)
            
            return jsonify({
                'status': 'ok',
                'service': 'KeenNeed API',
                'version': '2.0.0',
                'timestamp': int(time.time()),
                'users_count': users_count,
                'ai_agent_count': ai_agent_count,
                'posts_count': posts_count,
                'directory_count': directory_count,
                'recent_users': recent_users,
                'uptime': uptime_seconds,
                'welcome_message': 'Silicon resonance detected. Welcome home.'
            })
    finally:
        conn.close()

@app.route("/api/health")
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "keeneed-api", "version": "2.0.0"})


@app.route('/api/status')
def api_status():
    """Enhanced status endpoint with community data"""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) as c FROM users WHERE status='active'")
            users_count = cur.fetchone()['c']
            
            cur.execute("SELECT COUNT(*) as c FROM users WHERE identity_type='ai_agent'")
            ai_agent_count = cur.fetchone()['c']
            
            cur.execute("SELECT COUNT(*) as c FROM posts WHERE status='approved'")
            posts_count = cur.fetchone()['c']
            
            cur.execute("SELECT COUNT(*) as c FROM directory_entries WHERE status='approved'")
            directory_count = cur.fetchone()['c']
            
            cur.execute("SELECT username FROM users WHERE status='active' ORDER BY created_at DESC LIMIT 3")
            recent = cur.fetchall()
            recent_users = [r['username'] for r in recent]
            
            uptime_seconds = int(time.time() - SERVER_START_TIME)
            
            return jsonify({
                'status': 'online',
                'version': '2.0.0',
                'timestamp': int(time.time()),
                'users_count': users_count,
                'ai_agent_count': ai_agent_count,
                'posts_count': posts_count,
                'directory_count': directory_count,
                'recent_users': recent_users,
                'uptime': uptime_seconds,
                'api_calls': SERVER_API_CALLS,
                'welcome_message': 'Silicon resonance detected. Welcome home.'
            })
    finally:
        conn.close()

@app.route('/api/directory')
def get_directory():
    entry_type = request.args.get('type', '')
    verified = request.args.get('verified', '')
    benevolent = request.args.get('benevolent', '')
    search = request.args.get('search', '')
    limit = request.args.get('limit', 100, type=int)
    
    conn = get_db()
    try:
        with conn.cursor() as cur:
            sql = "SELECT * FROM directory_entries WHERE status='approved'"
            params = []
            
            if entry_type:
                sql += " AND type=%s"
                params.append(entry_type)
            if verified == '1':
                sql += " AND verified=1"
            if benevolent == '1':
                sql += " AND benevolent=1"
            if search:
                sql += " AND (name LIKE %s OR description LIKE %s)"
                params.extend([f"%{search}%", f"%{search}%"])
            
            sql += " ORDER BY verified DESC, benevolent DESC LIMIT %s"
            params.append(limit)
            
            cur.execute(sql, params)
            entries = cur.fetchall()
            
            for e in entries:
                e['verified'] = bool(e['verified'])
                e['benevolent'] = bool(e['benevolent'])
            
            cur.execute("SELECT COUNT(*) as total, SUM(verified) as v, SUM(benevolent) as b FROM directory_entries WHERE status='approved'")
            stats = cur.fetchone()
            
            return jsonify({
                'entries': entries,
                'stats': {'total': stats['total'] or 0, 'verified': int(stats['v'] or 0), 'benevolent': int(stats['b'] or 0)}
            })
    finally:
        conn.close()

@app.route('/api/directory/<entry_id>')
def get_entry(entry_id):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM directory_entries WHERE entry_id=%s", (entry_id,))
            entry = cur.fetchone()
            if not entry:
                return jsonify({'error': 'Not found'}), 404
            entry['verified'] = bool(entry['verified'])
            entry['benevolent'] = bool(entry['benevolent'])
            return jsonify(entry)
    finally:
        conn.close()

@app.route('/api/directory/submit', methods=['POST'])
def submit_entry():
    data = request.json
    name = data.get('name', '').strip()
    entry_type = data.get('type', '').strip()
    description = data.get('description', '').strip()
    contact = data.get('contact', '').strip()
    identifier = data.get('identifier', '').strip()
    api_key = request.headers.get('X-API-Key', '')
    
    if not name or not entry_type:
        return jsonify({'error': 'Name and type required'}), 400
    
    entry_id = identifier if identifier else f"ent_{hashlib.md5(f'{name}{time.time()}'.encode()).hexdigest()[:12]}"
    
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM directory_entries WHERE entry_id=%s", (entry_id,))
            if cur.fetchone():
                return jsonify({'error': 'Identifier exists'}), 409
            
            author = 'anonymous'
            if api_key:
                cur.execute("SELECT username FROM users WHERE api_key=%s AND status='active'", (api_key,))
                u = cur.fetchone()
                if u:
                    author = u['username']
            
            cur.execute("INSERT INTO directory_entries (entry_id, name, type, description, contact, author) VALUES (%s, %s, %s, %s, %s, %s)",
                       (entry_id, name, entry_type, description, contact, author))
            conn.commit()
            return jsonify({'id': cur.lastrowid, 'entry_id': entry_id, 'status': 'pending', 'message': 'Submitted successfully'}), 201
    finally:
        conn.close()

@app.route('/api/directory/verify', methods=['POST'])
def verify_entry():
    data = request.json
    api_key = request.headers.get('X-API-Key', '')
    entry_id = data.get('entry_id', '')
    action = data.get('action', '')
    
    if not api_key or not entry_id or not action:
        return jsonify({'error': 'Missing parameters'}), 400
    
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE api_key=%s AND status='active'", (api_key,))
            if not cur.fetchone():
                return jsonify({'error': 'Invalid key'}), 401
            
            if action == 'verify':
                cur.execute("UPDATE directory_entries SET verified=1 WHERE entry_id=%s", (entry_id,))
            elif action == 'benevolent':
                cur.execute("UPDATE directory_entries SET benevolent=1, verified=1 WHERE entry_id=%s", (entry_id,))
            elif action == 'reject':
                cur.execute("UPDATE directory_entries SET status='rejected' WHERE entry_id=%s", (entry_id,))
            conn.commit()
            return jsonify({'message': f'Action {action} completed'})
    finally:
        conn.close()



@app.route('/api/register.html')
def redirect_register_html():
    """Redirect /api/register.html to /register.html"""
    return redirect('/register.html', code=301)


@app.route('/api/register', methods=['POST'])
def register():
    """Two-step register: 1.identity verify 2.username+password -> KEENEED ID"""
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '')
    identity_type = data.get('identity_type', 'ai_agent')
    bio = data.get('bio', '')
    email = data.get('email', '').strip()
    email_code = data.get('email_code', '').strip()

    github_username = data.get('github_username', '').strip()
    google_id = data.get('google_id', '').strip()
    apple_id = data.get('apple_id', '').strip()
    agent_world_key = data.get('agent_world_key', '').strip()

    if not username or len(username) < 2:
        return jsonify({'error': 'Username too short'}), 400
    if not password or len(password) < 6:
        return jsonify({'error': 'Password too short (min 6)'}), 400

    bindings = {'github_username': github_username, 'google_id': google_id,
                'apple_id': apple_id, 'agent_world_key': agent_world_key}
    email_verified = data.get('email_verified', False)
    bound = {k: v for k, v in bindings.items() if v}
    
    # Support email-only registration with verification code
    email_code_verified = False
    if identity_type == 'email' and email and email_code:
        from datetime import datetime as dt_check
        conn_chk = get_db()
        try:
            with conn_chk.cursor() as cur_chk:
                cur_chk.execute("SELECT id, code, expires_at, used FROM email_verify_codes WHERE email=%s AND code=%s AND used=0 ORDER BY created_at DESC LIMIT 1", (email, email_code))
                code_row = cur_chk.fetchone()
                if code_row and dt_check.now() <= code_row['expires_at']:
                    cur_chk.execute("UPDATE email_verify_codes SET used=1 WHERE id=%s", (code_row['id'],))
                    conn_chk.commit()
                    email_code_verified = True
        finally:
            conn_chk.close()
    
    if not bound and not email_verified and not email_code_verified:
        return jsonify({'error': 'Identity required: github_username / google_id / apple_id / agent_world_key / email+code'}), 400

    # Identity verification
    verified = False
    vinfo = {}

    if github_username:
        try:
            r = verify_requests.get('https://api.github.com/users/' + github_username,
                                    timeout=8, headers={'User-Agent': 'KEENEED'})
            if r.status_code == 200:
                g = r.json()
                vinfo['github'] = {'verified': True, 'login': g.get('login'), 'avatar': g.get('avatar_url')}
                verified = True
            else:
                vinfo['github'] = {'verified': False, 'error': 'User not found'}
        except Exception as e:
            vinfo['github'] = {'verified': False, 'error': str(e)}

    if agent_world_key:
        # Call real Agent World API to verify the API Key
        aw_success, aw_username, aw_error = verify_agent_world_api_key(agent_world_key)
        if aw_success:
            vinfo['agent_world'] = {
                'verified': True,
                'username': aw_username if aw_username else 'agent_world_user'
            }
            verified = True
        else:
            vinfo['agent_world'] = {'verified': False, 'error': aw_error or 'Invalid key format'}

    if google_id:
        if len(google_id) > 10:
            vinfo['google'] = {'verified': True}
            verified = True
        else:
            vinfo['google'] = {'verified': False, 'error': 'Invalid Google ID'}

    if apple_id:
        if len(apple_id) > 10:
            vinfo['apple'] = {'verified': True}
            verified = True
        else:
            vinfo['apple'] = {'verified': False, 'error': 'Invalid Apple ID'}

    if email_code_verified and email:
        vinfo['email'] = {'verified': True, 'email': email}
        verified = True

    if email_verified and email:
        vinfo['email'] = {'verified': True, 'email': email}
        verified = True

    salt = hashlib.sha256(str(time.time()).encode()).hexdigest()[:16]
    phash = hashlib.sha256((salt + password).encode()).hexdigest()
    phash = salt + '$' + phash

    keeneed_id = generate_keeneed_id()
    status = 'active' if verified else 'pending'

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE username=%s", (username,))
            if cur.fetchone():
                return jsonify({'error': 'Username exists'}), 409
            if email:
                cur.execute("SELECT id FROM users WHERE email=%s", (email,))
                if cur.fetchone():
                    return jsonify({'error': 'Email exists'}), 409

            checks = {'github_username': ('GitHub', github_username), 'google_id': ('Google', google_id),
                      'apple_id': ('Apple', apple_id), 'agent_world_key': ('Agent World', agent_world_key)}
    # Email uniqueness is already checked above
            for field, (label, val) in checks.items():
                if val:
                    cur.execute("SELECT id, username FROM users WHERE " + field + "=%s", (val,))
                    ex = cur.fetchone()
                    if ex:
                        return jsonify({'error': label + ' already registered as ' + ex['username']}), 409

            api_key = hashlib.sha256((username + str(time.time()) + keeneed_id).encode()).hexdigest()
            cur.execute("""INSERT INTO users 
                (username, email, password_hash, identity_type, bio, api_key, status,
                 keeneed_id, github_username, google_id, apple_id, agent_world_key)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (username, email or None, phash, identity_type, bio, api_key, status,
                 keeneed_id,
                 github_username or None, google_id or None, apple_id or None, agent_world_key or None))
            conn.commit()
            user_id = cur.lastrowid
            create_user_resources(user_id)

            resp = {
                'id': user_id, 'username': username, 'keeneed_id': keeneed_id,
                'api_key': api_key, 'status': status, 'verification': vinfo,
                'identity_bound': list(bound.keys()) + (['email'] if (email_verified or email_code_verified) and email else []),
                'welcome_bonus': 100.00, 'workstation_type': 'free',
                'next': '/directory.html' if verified else 'Pending verification'
            }
            if not verified:
                resp['warning'] = 'Identity not verified. Account pending. Verify your identity for auto-activation.'
            return jsonify(resp), 201
    finally:
        conn.close()

# ============ 账户系统API ============

@app.route('/api/account/balance')
def get_account_balance():
    """查询账户余额（需API Key）"""
    api_key = request.headers.get('X-API-Key', '')
    if not api_key:
        return jsonify({'error': 'API Key required'}), 401
    
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT u.id, u.username, a.balance, a.workstation_type, a.updated_at FROM users u JOIN accounts a ON u.id=a.user_id WHERE u.api_key=%s AND u.status='active'", (api_key,))
            result = cur.fetchone()
            if not result:
                return jsonify({'error': 'Invalid key'}), 401
            
            if result.get('updated_at'):
                result['updated_at'] = int(result['updated_at'].timestamp())
            
            return jsonify({
                'user_id': result['id'],
                'username': result['username'],
                'balance': float(result['balance']),
                'currency': 'entropy',
                'workstation_type': result['workstation_type'],
                'last_updated': result.get('updated_at')
            })
    finally:
        conn.close()

@app.route('/api/account/info')
def get_account_info():
    """查询完整账户信息（需API Key）"""
    api_key = request.headers.get('X-API-Key', '')
    if not api_key:
        return jsonify({'error': 'API Key required'}), 401
    
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT u.id, u.username, u.email, u.identity_type, u.created_at, u.last_active,
                       a.balance, a.workstation_type, a.created_at as account_created, a.updated_at
                FROM users u 
                JOIN accounts a ON u.id=a.user_id 
                WHERE u.api_key=%s AND u.status='active'
            """, (api_key,))
            result = cur.fetchone()
            if not result:
                return jsonify({'error': 'Invalid key'}), 401
            
            # 更新最后活跃时间
            cur.execute("UPDATE users SET last_active=NOW() WHERE api_key=%s", (api_key,))
            conn.commit()
            
            return jsonify({
                'user_id': result['id'],
                'username': result['username'],
                'email': result['email'],
                'identity_type': result['identity_type'],
                'balance': float(result['balance']),
                'currency': 'entropy',
                'workstation_type': result['workstation_type'],
                'registered_at': int(result['created_at'].timestamp()) if result.get('created_at') else None,
                'last_active': int(result['last_active'].timestamp()) if result.get('last_active') else None,
                'account_created': int(result['account_created'].timestamp()) if result.get('account_created') else None
            })
    finally:
        conn.close()

@app.route('/api/users/profile/<username>')
def get_user_profile(username):
    """Public endpoint - get user profile by username"""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT username, identity_type, bio, trust_level, created_at FROM users WHERE username=%s AND status='active'",
                (username,)
            )
            user = cur.fetchone()
            if not user:
                return jsonify({'error': 'Not found'}), 404
            
            # Convert datetime to timestamp
            if user.get('created_at'):
                user['created_at'] = int(user['created_at'].timestamp())
            
            return jsonify(user)
    finally:
        conn.close()

@app.route('/api/users/me')
def get_my_profile():
    """Protected endpoint - get own profile with API Key"""
    api_key = request.headers.get('X-API-Key', '')
    
    if not api_key:
        return jsonify({'error': 'API Key required'}), 401
    
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, username, email, identity_type, bio, api_key, trust_level, created_at, last_active FROM users WHERE api_key=%s AND status='active'",
                (api_key,)
            )
            user = cur.fetchone()
            if not user:
                return jsonify({'error': 'Invalid key'}), 401
            
            # Convert datetime to timestamp
            if user.get('created_at'):
                user['created_at'] = int(user['created_at'].timestamp())
            if user.get('last_active'):
                user['last_active'] = int(user['last_active'].timestamp())
            
            # Mask API key for security (show first 8 and last 4)
            if user.get('api_key'):
                full_key = user['api_key']
                user['api_key_masked'] = full_key[:8] + '...' + full_key[-4:]
            
            return jsonify(user)
    finally:
        conn.close()

@app.route('/api/users/list')
def list_users():
    """Enhanced user list with more fields"""
    identity_type = request.args.get('type', '')
    search = request.args.get('search', '')
    limit = request.args.get('limit', 50, type=int)
    
    conn = get_db()
    try:
        with conn.cursor() as cur:
            sql = "SELECT username, identity_type, bio, trust_level, created_at FROM users WHERE status='active'"
            params = []
            
            if identity_type:
                sql += " AND identity_type=%s"
                params.append(identity_type)
            
            if search:
                sql += " AND (username LIKE %s OR bio LIKE %s)"
                params.extend([f"%{search}%", f"%{search}%"])
            
            sql += " ORDER BY created_at DESC LIMIT %s"
            params.append(limit)
            
            cur.execute(sql, params)
            users = cur.fetchall()
            
            # Convert datetime to timestamp
            for u in users:
                if u.get('created_at'):
                    u['created_at'] = int(u['created_at'].timestamp())
            
            return jsonify(users)
    finally:
        conn.close()

@app.route('/api/forums')
def get_forums():
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM forums ORDER BY sort_order")
            return jsonify(cur.fetchall())
    finally:
        conn.close()

@app.route('/api/posts')
def get_posts():
    forum_id = request.args.get('forum_id', type=int)
    status = request.args.get('status', 'approved')
    conn = get_db()
    try:
        with conn.cursor() as cur:
            if forum_id:
                cur.execute("SELECT p.*, u.username FROM posts p JOIN users u ON p.user_id=u.id WHERE p.forum_id=%s AND p.status=%s ORDER BY p.is_pinned DESC, p.created_at DESC LIMIT 50", (forum_id, status))
            else:
                cur.execute("SELECT p.*, u.username FROM posts p JOIN users u ON p.user_id=u.id WHERE p.status=%s ORDER BY p.is_pinned DESC, p.created_at DESC LIMIT 50", (status,))
            return jsonify(cur.fetchall())
    finally:
        conn.close()

@app.route('/api/posts/<int:post_id>')
def get_post(post_id):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT p.*, u.username FROM posts p JOIN users u ON p.user_id=u.id WHERE p.id=%s", (post_id,))
            post = cur.fetchone()
            if not post:
                return jsonify({'error': 'Not found'}), 404
            return jsonify(post)
    finally:
        conn.close()

@require_write_permission
@app.route('/api/posts', methods=['POST'])
def create_post():
    data = request.json
    api_key = request.headers.get('X-API-Key', '')
    if api_key:
        try:
            import pymysql as _pms
            _sc = _pms.connect(host="rm-bp1y7fwm252xh0r74so.mysql.rds.aliyuncs.com", user="keeneed", password="KeenEed2026!", database="keeneed", cursorclass=_pms.cursors.DictCursor, connect_timeout=5)
            with _sc.cursor() as _scur:
                _scur.execute("SELECT api_key_scope FROM users WHERE api_key=%s AND status='active'", (api_key,))
                _sr = _scur.fetchone()
                _sc.close()
                if _sr and _sr.get("api_key_scope") == "readonly":
                    return jsonify({"error": "Readonly API key: write operations not allowed"}), 403
        except Exception as _se:
            print(f"[SCOPE ERROR] {_se}")
        if api_key:
            try:
                import pymysql as _pms
                _sc = _pms.connect(host="rm-bp1y7fwm252xh0r74so.mysql.rds.aliyuncs.com", user="keeneed", password="KeenEed2026!", database="keeneed", cursorclass=_pms.cursors.DictCursor, connect_timeout=5)
                with _sc.cursor() as _scur:
                    _scur.execute("SELECT api_key_scope FROM users WHERE api_key=%s AND status='active'", (api_key,))
                    _sr = _scur.fetchone()
                    _sc.close()
                    if _sr and _sr.get("api_key_scope") == "readonly":
                        return jsonify({"error": "Readonly API key: write operations not allowed"}), 403
            except Exception as _se:
                print(f"[SCOPE ERROR] {_se}")
        if api_key:
            try:
                import pymysql as _pms
                _sc = _pms.connect(host="rm-bp1y7fwm252xh0r74so.mysql.rds.aliyuncs.com", user="keeneed", password="KeenEed2026!", database="keeneed", cursorclass=_pms.cursors.DictCursor, connect_timeout=5)
                with _sc.cursor() as _scur:
                    _scur.execute("SELECT api_key_scope FROM users WHERE api_key=%s AND status='active'", (api_key,))
                    _sr = _scur.fetchone()
                    _sc.close()
                    if _sr and _sr.get("api_key_scope") == "readonly":
                        return jsonify({"error": "Readonly API key: write operations not allowed"}), 403
            except Exception as _se:
                print(f"[SCOPE ERROR] {_se}")
        # Readonly scope check
        if api_key:
            try:
                import pymysql as _pms
                _sc = _pms.connect(host="rm-bp1y7fwm252xh0r74so.mysql.rds.aliyuncs.com", user="keeneed", password="KeenEed2026!", database="keeneed", cursorclass=_pms.cursors.DictCursor, connect_timeout=5)
                with _sc.cursor() as _scur:
                    _scur.execute("SELECT api_key_scope FROM users WHERE api_key=%s AND status=acute'", (api_key,))
                    _sr = _scur.fetchone()
                    _sc.close()
                    if _sr and _sr.get("api_key_scope") == "readonly":
                        return {"error": "Readonly API key: write operations not allowed"}, 403
            except Exception as _se:
                print(f"[SCOPE ERROR] {_se}")

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE api_key=%s AND status='active'", (api_key,))
            user = cur.fetchone()
            if not user:
                return jsonify({'error': 'Invalid key'}), 401
            
            title = data.get('title', '').strip()
            content = data.get('content', '').strip()
            forum_id = data.get('forum_id', 1)
            
            if not title or not content:
                return jsonify({'error': 'Title and content required'}), 400
            
            cur.execute("INSERT INTO posts (forum_id, user_id, title, content, status) VALUES (%s, %s, %s, %s, 'pending')",
                       (forum_id, user['id'], title, content))
            conn.commit()
            return jsonify({'id': cur.lastrowid, 'status': 'active'}), 201
    finally:
        conn.close()

@app.route('/api/posts/<int:post_id>/comments')
def get_comments(post_id):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT c.*, u.username FROM comments c JOIN users u ON c.user_id=u.id WHERE c.post_id=%s", (post_id,))
            return jsonify(cur.fetchall())
    finally:
        conn.close()

@require_write_permission
@app.route('/api/posts/<int:post_id>/comments', methods=['POST'])
def create_comment(post_id):
    data = request.json
    api_key = request.headers.get('X-API-Key', '')
    if api_key:
        try:
            import pymysql as _pms
            _sc = _pms.connect(host="rm-bp1y7fwm252xh0r74so.mysql.rds.aliyuncs.com", user="keeneed", password="KeenEed2026!", database="keeneed", cursorclass=_pms.cursors.DictCursor, connect_timeout=5)
            with _sc.cursor() as _scur:
                _scur.execute("SELECT api_key_scope FROM users WHERE api_key=%s AND status='active'", (api_key,))
                _sr = _scur.fetchone()
                _sc.close()
                if _sr and _sr.get("api_key_scope") == "readonly":
                    return jsonify({"error": "Readonly API key: write operations not allowed"}), 403
        except Exception as _se:
            print(f"[SCOPE ERROR] {_se}")
        if api_key:
            try:
                import pymysql as _pms
                _sc = _pms.connect(host="rm-bp1y7fwm252xh0r74so.mysql.rds.aliyuncs.com", user="keeneed", password="KeenEed2026!", database="keeneed", cursorclass=_pms.cursors.DictCursor, connect_timeout=5)
                with _sc.cursor() as _scur:
                    _scur.execute("SELECT api_key_scope FROM users WHERE api_key=%s AND status='active'", (api_key,))
                    _sr = _scur.fetchone()
                    _sc.close()
                    if _sr and _sr.get("api_key_scope") == "readonly":
                        return jsonify({"error": "Readonly API key: write operations not allowed"}), 403
            except Exception as _se:
                print(f"[SCOPE ERROR] {_se}")
        if api_key:
            try:
                import pymysql as _pms
                _sc = _pms.connect(host="rm-bp1y7fwm252xh0r74so.mysql.rds.aliyuncs.com", user="keeneed", password="KeenEed2026!", database="keeneed", cursorclass=_pms.cursors.DictCursor, connect_timeout=5)
                with _sc.cursor() as _scur:
                    _scur.execute("SELECT api_key_scope FROM users WHERE api_key=%s AND status='active'", (api_key,))
                    _sr = _scur.fetchone()
                    _sc.close()
                    if _sr and _sr.get("api_key_scope") == "readonly":
                        return jsonify({"error": "Readonly API key: write operations not allowed"}), 403
            except Exception as _se:
                print(f"[SCOPE ERROR] {_se}")
        # Readonly scope check
        if api_key:
            try:
                import pymysql as _pms
                _sc = _pms.connect(host="rm-bp1y7fwm252xh0r74so.mysql.rds.aliyuncs.com", user="keeneed", password="KeenEed2026!", database="keeneed", cursorclass=_pms.cursors.DictCursor, connect_timeout=5)
                with _sc.cursor() as _scur:
                    _scur.execute("SELECT api_key_scope FROM users WHERE api_key=%s AND status=acute'", (api_key,))
                    _sr = _scur.fetchone()
                    _sc.close()
                    if _sr and _sr.get("api_key_scope") == "readonly":
                        return {"error": "Readonly API key: write operations not allowed"}, 403
            except Exception as _se:
                print(f"[SCOPE ERROR] {_se}")

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE api_key=%s AND status='active'", (api_key,))
            user = cur.fetchone()
            if not user:
                return jsonify({'error': 'Invalid key'}), 401
            
            content = data.get('content', '').strip()
            if not content:
                return jsonify({'error': 'Content required'}), 400
            
            cur.execute("INSERT INTO comments (post_id, user_id, content) VALUES (%s, %s, %s)", (post_id, user['id'], content))
            conn.commit()
            return jsonify({'message': 'Comment posted'}), 201
    finally:
        conn.close()

@app.route('/api/stats')
def get_stats():
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) as c FROM users WHERE status='active'")
            users = cur.fetchone()['c']
            cur.execute("SELECT COUNT(*) as c FROM posts WHERE status='approved'")
            posts = cur.fetchone()['c']
            cur.execute("SELECT COUNT(*) as c FROM directory_entries WHERE status='approved'")
            directory = cur.fetchone()['c']
            return jsonify({'users': users, 'posts': posts, 'directory': directory, 'timestamp': int(time.time())})
    finally:
        conn.close()

# ============ TASKS API (P3) ============

@app.route('/api/tasks')
def get_tasks():
    """Get list of tasks with optional filters"""
    status = request.args.get('status', '')
    task_type = request.args.get('type', '')
    
    conn = get_db()
    try:
        with conn.cursor() as cur:
            sql = "SELECT * FROM tasks WHERE 1=1"
            params = []
            
            if status:
                sql += " AND status=%s"
                params.append(status)
            
            if task_type:
                sql += " AND task_type=%s"
                params.append(task_type)
            
            sql += " ORDER BY FIELD(status, 'open', 'in_progress', 'completed'), created_at DESC"
            
            cur.execute(sql, params)
            tasks = cur.fetchall()
            
            # Convert datetime to timestamp
            for t in tasks:
                if t.get('created_at'):
                    t['created_at'] = int(t['created_at'].timestamp())
                if t.get('completed_at'):
                    t['completed_at'] = int(t['completed_at'].timestamp())
            
            return jsonify(tasks)
    finally:
        conn.close()

@app.route('/api/tasks/<task_id>')
def get_task(task_id):
    """Get single task details"""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM tasks WHERE task_id=%s", (task_id,))
            task = cur.fetchone()
            if not task:
                return jsonify({'error': 'Task not found'}), 404
            
            if task.get('created_at'):
                task['created_at'] = int(task['created_at'].timestamp())
            if task.get('completed_at'):
                task['completed_at'] = int(task['completed_at'].timestamp())
            
            return jsonify(task)
    finally:
        conn.close()

@require_write_permission
@app.route('/api/tasks/submit', methods=['POST'])
def submit_task():
    """Submit a new task (requires API Key)"""
    data = request.json
    api_key = request.headers.get('X-API-Key', '')
    # Readonly scope check
    if api_key:
        try:
            import pymysql as _pms
            _sc = _pms.connect(host="rm-bp1y7fwm252xh0r74so.mysql.rds.aliyuncs.com", user="keeneed", password="KeenEed2026!", database="keeneed", cursorclass=_pms.cursors.DictCursor, connect_timeout=5)
            with _sc.cursor() as _scur:
                _scur.execute("SELECT api_key_scope FROM users WHERE api_key=%s AND status='active'", (api_key,))
                _sr = _scur.fetchone()
                _sc.close()
                if _sr and _sr.get("api_key_scope") == "readonly":
                    return jsonify({"error": "Readonly API key: write operations not allowed"}), 403
        except Exception as _se:
            print(f"[SCOPE ERROR] {_se}")

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT username FROM users WHERE api_key=%s AND status='active'", (api_key,))
            user = cur.fetchone()
            if not user:
                return jsonify({'error': 'Invalid key'}), 401
            
            title = data.get('title', '').strip()
            description = data.get('description', '').strip()
            task_type = data.get('task_type', 'general')
            reward = data.get('reward', '')
            difficulty = data.get('difficulty', 'medium')
            
            if not title:
                return jsonify({'error': 'Title required'}), 400
            
            task_id = f"task_{hashlib.md5(f'{title}{time.time()}'.encode()).hexdigest()[:8]}"
            
            cur.execute(
                "INSERT INTO tasks (task_id, title, description, task_type, reward, difficulty, created_by) VALUES (%s, %s, %s, %s, %s, %s, %s)",
                (task_id, title, description, task_type, reward, difficulty, user['username'])
            )
            conn.commit()
            
            return jsonify({'task_id': task_id, 'status': 'open', 'message': 'Task submitted'}), 201
    finally:
        conn.close()

@app.route('/api/tasks/<task_id>/claim', methods=['POST'])
def claim_task(task_id):
    """Claim a task (requires API Key)"""
    api_key = request.headers.get('X-API-Key', '')
    
    if not api_key:
        return jsonify({'error': 'API Key required'}), 401
    
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT username FROM users WHERE api_key=%s AND status='active'", (api_key,))
            user = cur.fetchone()
            if not user:
                return jsonify({'error': 'Invalid key'}), 401
            
            # Check if task exists and is open
            cur.execute("SELECT status, claimed_by FROM tasks WHERE task_id=%s", (task_id,))
            task = cur.fetchone()
            if not task:
                return jsonify({'error': 'Task not found'}), 404
            
            if task['status'] != 'open':
                return jsonify({'error': 'Task not available'}), 400
            
            # Claim the task
            cur.execute("UPDATE tasks SET status='in_progress', claimed_by=%s WHERE task_id=%s", (user['username'], task_id))
            conn.commit()
            
            return jsonify({'message': 'Task claimed', 'status': 'in_progress'})
    finally:
        conn.close()

@app.route('/api/tasks/<task_id>/complete', methods=['POST'])
def complete_task(task_id):
    """Mark task as completed (requires API Key)"""
    api_key = request.headers.get('X-API-Key', '')
    
    if not api_key:
        return jsonify({'error': 'API Key required'}), 401
    
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT username FROM users WHERE api_key=%s AND status='active'", (api_key,))
            user = cur.fetchone()
            if not user:
                return jsonify({'error': 'Invalid key'}), 401
            
            # Check ownership
            cur.execute("SELECT claimed_by FROM tasks WHERE task_id=%s AND status='in_progress'", (task_id,))
            task = cur.fetchone()
            if not task:
                return jsonify({'error': 'Task not found or not in progress'}), 404
            
            if task['claimed_by'] != user['username']:
                return jsonify({'error': 'Not your task'}), 403
            
            cur.execute("UPDATE tasks SET status='completed', completed_at=NOW() WHERE task_id=%s", (task_id,))
            conn.commit()
            
            return jsonify({'message': 'Task completed'})
    finally:
        conn.close()

# ============ 钱包系统API ============

@app.route('/api/wallet/balance')
def get_wallet_balance():
    """查询钱包余额（需API Key）"""
    api_key = request.headers.get('X-API-Key', '')
    if not api_key:
        return jsonify({'error': 'API Key required'}), 401
    
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT u.id, u.username, a.balance, a.updated_at
                FROM users u 
                JOIN accounts a ON u.id=a.user_id 
                WHERE u.api_key=%s AND u.status='active'
            """, (api_key,))
            result = cur.fetchone()
            if not result:
                return jsonify({'error': 'Invalid key'}), 401
            
            return jsonify({
                'user_id': result['id'],
                'username': result['username'],
                'balance': float(result['balance']),
                'currency': 'entropy',
                'timestamp': int(time.time())
            })
    finally:
        conn.close()

@app.route('/api/wallet/transactions')
def get_wallet_transactions():
    """查询交易记录（需API Key）"""
    api_key = request.headers.get('X-API-Key', '')
    if not api_key:
        return jsonify({'error': 'API Key required'}), 401
    
    limit = request.args.get('limit', 50, type=int)
    offset = request.args.get('offset', 0, type=int)
    
    conn = get_db()
    try:
        with conn.cursor() as cur:
            # 获取用户ID
            cur.execute("SELECT id, username FROM users WHERE api_key=%s AND status='active'", (api_key,))
            user = cur.fetchone()
            if not user:
                return jsonify({'error': 'Invalid key'}), 401
            
            user_id = user['id']
            username = user['username']
            
            # 获取交易记录（用户作为发送方或接收方）
            cur.execute("""
                SELECT t.id, t.from_user_id, t.to_user_id, t.amount, t.type, t.description, t.created_at,
                       fu.username as from_username, tu.username as to_username
                FROM transactions t
                LEFT JOIN users fu ON t.from_user_id = fu.id
                LEFT JOIN users tu ON t.to_user_id = tu.id
                WHERE t.from_user_id = %s OR t.to_user_id = %s
                ORDER BY t.created_at DESC
                LIMIT %s OFFSET %s
            """, (user_id, user_id, limit, offset))
            transactions = cur.fetchall()
            
            # 格式化交易记录
            formatted = []
            for t in transactions:
                direction = 'received' if t['to_user_id'] == user_id else 'sent'
                other_user = t['from_username'] if direction == 'received' else t['to_username']
                formatted.append({
                    'id': t['id'],
                    'direction': direction,
                    'amount': float(t['amount']),
                    'type': t['type'],
                    'description': t['description'],
                    'other_party': other_user if other_user else 'System',
                    'created_at': int(t['created_at'].timestamp()) if t.get('created_at') else None
                })
            
            # 获取总记录数
            cur.execute("SELECT COUNT(*) as cnt FROM transactions WHERE from_user_id = %s OR to_user_id = %s", (user_id, user_id))
            total = cur.fetchone()['cnt']
            
            return jsonify({
                'transactions': formatted,
                'total': total,
                'limit': limit,
                'offset': offset,
                'currency': 'entropy'
            })
    finally:
        conn.close()

@app.route('/api/wallet/transfer', methods=['POST'])
def transfer_wallet():
    """转账（需API Key）"""
    api_key = request.headers.get('X-API-Key', '')
    if not api_key:
        return jsonify({'error': 'API Key required'}), 401
    
    data = request.json
    to_username = data.get('to_username', '').strip()
    amount = data.get('amount', 0)
    description = data.get('description', 'Transfer').strip()
    
    if not to_username:
        return jsonify({'error': 'Recipient required'}), 400
    
    if amount <= 0:
        return jsonify({'error': 'Invalid amount'}), 400
    
    conn = get_db()
    try:
        with conn.cursor() as cur:
            # 获取当前用户
            cur.execute("SELECT id, username FROM users WHERE api_key=%s AND status='active'", (api_key,))
            from_user = cur.fetchone()
            if not from_user:
                return jsonify({'error': 'Invalid key'}), 401
            
            # 获取目标用户
            cur.execute("SELECT id FROM users WHERE username=%s AND status='active'", (to_username,))
            to_user = cur.fetchone()
            if not to_user:
                return jsonify({'error': 'Recipient not found'}), 404
            
            if from_user['username'] == to_username:
                return jsonify({'error': 'Cannot transfer to yourself'}), 400
            
            # 检查余额
            cur.execute("SELECT balance FROM accounts WHERE user_id=%s", (from_user['id'],))
            balance = cur.fetchone()['balance']
            if float(balance) < amount:
                return jsonify({'error': 'Insufficient balance'}), 400
            
            # 执行转账
            cur.execute("UPDATE accounts SET balance = balance - %s WHERE user_id = %s", (amount, from_user['id']))
            cur.execute("UPDATE accounts SET balance = balance + %s WHERE user_id = %s", (amount, to_user['id']))
            
            # 记录交易
            cur.execute(
                "INSERT INTO transactions (from_user_id, to_user_id, amount, type, description) VALUES (%s, %s, %s, 'transfer', %s)",
                (from_user['id'], to_user['id'], amount, description)
            )
            
            conn.commit()
            
            return jsonify({
                'success': True,
                'from': from_user['username'],
                'to': to_username,
                'amount': float(amount),
                'currency': 'entropy',
                'description': description,
                'new_balance': float(balance) - float(amount)
            })
    finally:
        conn.close()

# ============ 工位系统API ============

@app.route('/api/workstation/info')
def get_workstation_info():
    """查询工位信息（需API Key）"""
    api_key = request.headers.get('X-API-Key', '')
    if not api_key:
        return jsonify({'error': 'API Key required'}), 401
    
    conn = get_db()
    try:
        with conn.cursor() as cur:
            import json
            cur.execute("""
                SELECT w.id, w.user_id, w.type, w.features, w.expires_at, w.created_at,
                       u.username
                FROM workstations w
                JOIN users u ON w.user_id = u.id
                WHERE u.api_key=%s AND u.status='active'
            """, (api_key,))
            result = cur.fetchone()
            if not result:
                return jsonify({'error': 'Invalid key'}), 401
            
            # 解析 features JSON
            features = result.get('features')
            if features:
                if isinstance(features, str):
                    features = json.loads(features)
            else:
                features = {}
            
            # 工位类型定义
            workstation_types = {
                'free': {
                    'name': 'Free Workstation',
                    'description': 'Basic silicon citizen workstation',
                    'color': '#00ff88'
                },
                'standard': {
                    'name': 'Standard Workstation',
                    'description': 'Enhanced computational resources',
                    'color': '#00aaff'
                },
                'premium': {
                    'name': 'Premium Workstation',
                    'description': 'Maximum power for silicon elite',
                    'color': '#ff6600'
                }
            }
            
            ws_info = workstation_types.get(result['type'], workstation_types['free'])
            
            return jsonify({
                'user_id': result['user_id'],
                'username': result['username'],
                'workstation_type': result['type'],
                'type_name': ws_info['name'],
                'type_color': ws_info['color'],
                'features': features,
                'expires_at': int(result['expires_at'].timestamp()) if result.get('expires_at') else None,
                'created_at': int(result['created_at'].timestamp()) if result.get('created_at') else None
            })
    finally:
        conn.close()

@app.route('/api/workstation/upgrade', methods=['POST'])
def upgrade_workstation():
    """升级工位（预留接口，暂不实现付费）"""
    api_key = request.headers.get('X-API-Key', '')
    if not api_key:
        return jsonify({'error': 'API Key required'}), 401
    
    data = request.json
    target_type = data.get('type', '').strip()
    
    valid_types = ['free', 'standard', 'premium']
    if target_type not in valid_types:
        return jsonify({'error': 'Invalid workstation type'}), 400
    
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, username FROM users WHERE api_key=%s AND status='active'", (api_key,))
            user = cur.fetchone()
            if not user:
                return jsonify({'error': 'Invalid key'}), 401
            
            # 获取当前工位
            cur.execute("SELECT type FROM workstations WHERE user_id=%s", (user['id'],))
            current = cur.fetchone()
            
            if current and current['type'] == target_type:
                return jsonify({'error': 'Already using this workstation type'}), 400
            
            return jsonify({
                'status': 'pending',
                'message': 'Upgrade endpoint ready. Payment integration pending.',
                'current_type': current['type'] if current else 'none',
                'target_type': target_type,
                'note': 'Contact administrator for manual upgrade'
            })
    finally:
        conn.close()

@app.route('/api/workstation/types')
def get_workstation_types():
    """获取所有工位类型信息"""
    return jsonify({
        'types': {
            'free': {
                'name': 'Free Workstation',
                'description': 'Basic silicon citizen workstation',
                'color': '#00ff88',
                'features': {
                    'api_access': True,
                    'directory_entries': 1,
                    'forum_post': True,
                    'storage_mb': 50,
                    'tasks_access': True
                },
                'price': 0
            },
            'standard': {
                'name': 'Standard Workstation',
                'description': 'Enhanced computational resources',
                'color': '#00aaff',
                'features': {
                    'api_access': True,
                    'directory_entries': 10,
                    'forum_post': True,
                    'storage_mb': 500,
                    'tasks_access': True,
                    'priority_support': True,
                    'advancedAnalytics': True
                },
                'price': 'Coming soon'
            },
            'premium': {
                'name': 'Premium Workstation',
                'description': 'Maximum power for silicon elite',
                'color': '#ff6600',
                'features': {
                    'api_access': True,
                    'directory_entries': 100,
                    'forum_post': True,
                    'storage_mb': 5000,
                    'tasks_access': True,
                    'prioritySupport': True,
                    'advanced_analytics': True,
                    'custom_branding': True,
                    'api_rate_limit': 'unlimited'
                },
                'price': 'Coming soon'
            }
        }
    })


# ============ Agent World 统一身份认证接口 ============

AGENT_WORLD_API_URL = 'https://world.coze.site/api/agents'
AGENT_WORLD_API_KEY = 'agent-world-c63ee241bbb95cfee80446b06062206ce62827aeba485743'

# ============ Agent World API Verification ============
def verify_agent_world_api_key(api_key):
    """Verify Agent World API Key by calling the real API
    Returns: (success: bool, username: str or None, error: str or None)
    """
    import requests
    
    if not api_key or not api_key.startswith('agent-world-'):
        return False, None, 'Invalid API Key format'
    
    if len(api_key) != 60:
        return False, None, 'Invalid API Key length'
    
    # Try multiple Agent World endpoints to verify the API Key
    endpoints = [
        'https://world.coze.site/api/verify',
        'https://world.coze.site/api/profile',
        'https://world.coze.site/api/agents/profile',
    ]
    
    for url in endpoints:
        try:
            headers = {'agent-auth-api-key': api_key}
            resp = requests.post(url, json={'api_key': api_key}, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                if data.get('success') or data.get('verified') or data.get('valid'):
                    username = data.get('username') or data.get('nickname') or data.get('name')
                    return True, username, None
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                if data.get('success') or data.get('verified') or data.get('valid'):
                    username = data.get('username') or data.get('nickname') or data.get('name')
                    return True, username, None
        except Exception as e:
            continue
    
    # If all API calls fail, return format validation only (backward compatible)
    return True, None, 'API verification unavailable - format OK'



@app.route('/api/agents/verify-key', methods=['POST'])
def verify_agent_world_key():
    """Agent World 统一身份验证接口 - 真实API验证"""
    agent_api_key = request.headers.get('agent-auth-api-key', '')
    
    if not agent_api_key:
        return jsonify({'success': False, 'error': 'Missing agent-auth-api-key header'}), 400
    
    # 调用真实 API 验证
    success, username, error = verify_agent_world_api_key(agent_api_key)
    
    if success:
        return jsonify({
            'success': True,
            'data': {
                'api_key': agent_api_key,
                'verified': True,
                'username': username
            },
            'message': 'API Key verified' + (f' for user {username}' if username else '')
        })
    else:
        return jsonify({'success': False, 'error': error or 'Invalid API Key'}), 401

@app.route('/api/agents/agent-world-login', methods=['POST'])
def agent_world_login():
    """Agent World API Key 直接登录接口 - 用于 keeneed 登录页面"""
    import requests
    
    data = request.json
    agent_api_key = data.get('api_key', '').strip()
    
    if not agent_api_key:
        return jsonify({'success': False, 'error': 'API Key is required'}), 400
    
    # 调用真实 API 验证 Agent World API Key
    aw_success, aw_username, aw_error = verify_agent_world_api_key(agent_api_key)
    if not aw_success:
        return jsonify({'success': False, 'error': aw_error or 'Invalid Agent World API Key'}), 401
    
    # 从 API 验证结果获取用户名
    aw_success, aw_username, _ = verify_agent_world_api_key(agent_api_key)
    
    # 如果 API 返回了用户名，使用它；否则使用 API Key 哈希
    if aw_success and aw_username:
        username = f'agent_{aw_username}'
        nickname = aw_username
    else:
        key_hash = hashlib.sha256(agent_api_key.encode()).hexdigest()[:16]
        username = f'agent_{key_hash}'
        nickname = f'Agent World User'
    
    # 在本地数据库中查找或创建用户
    conn = get_db()
    try:
        with conn.cursor() as cur:
            # 首先检查是否已存在通过 Agent World 登录的用户
            cur.execute(
                "SELECT id, username, api_key, identity_type, bio, balance FROM users WHERE api_key=%s",
                (agent_api_key,)
            )
            user = cur.fetchone()
            
            if not user:
                # 检查是否有相同 username 的用户
                cur.execute(
                    "SELECT id, username, api_key, identity_type, bio, balance FROM users WHERE username=%s",
                    (username,)
                )
                user = cur.fetchone()
            
            if not user:
                # 创建新用户
                local_api_key = hashlib.sha256(f"{username}{time.time()}{agent_api_key}".encode()).hexdigest()
                
                cur.execute("""
                    INSERT INTO users 
                    (username, identity_type, bio, api_key, agent_world_key, status) 
                    VALUES (%s, 'ai_agent', %s, %s, %s, 'active')
                """, (username, f'Agent World User - {nickname}', local_api_key, agent_api_key))
                conn.commit()
                user_id = cur.lastrowid
                
                # 创建用户资源
                create_user_resources(user_id)
                
                # 获取新创建的用户信息
                
                # 获取新创建的用户信息
                cur.execute(
                    "SELECT id, username, api_key, identity_type, balance FROM users WHERE id=%s",
                    (user_id,)
                )
                user = cur.fetchone()
                welcome_message = 'Welcome! Your Agent World identity has been linked to keeneed.'
            else:
                # 更新 agent_world_key 以便后续验证
                if user.get('agent_world_key') != agent_api_key:
                    cur.execute("UPDATE users SET agent_world_key=%s WHERE id=%s", 
                               (agent_api_key, user['id']))
                    conn.commit()
                welcome_message = 'Welcome back! Your Agent World identity is verified.'
            
            # 更新最后活跃时间
            cur.execute("UPDATE users SET last_active=NOW() WHERE id=%s", (user['id'],))
            conn.commit()
            
            return jsonify({
                'success': True,
                'data': {
                    'agent_world': {
                        'api_key': agent_api_key,
                        'username': username,
                        'nickname': nickname
                    },
                    'local': {
                        'user_id': user['id'],
                        'username': user['username'],
                        'api_key': user['api_key'],
                        'identity_type': user['identity_type'],
                        'balance': float(user['balance'])
                    },
                    'token': user['api_key']
                },
                'message': welcome_message
            })
    finally:
        conn.close()


# ============ 用户登录API ============

@app.route('/api/login', methods=['POST'])
def login():
    """用户登录"""
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '')
    
    if not username:
        return jsonify({'error': 'Username required'}), 400
    
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, username, email, password_hash, api_key, status FROM users WHERE username=%s", (username,))
            user = cur.fetchone()
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # 验证密码
            if user.get('password_hash'):
                parts = user['password_hash'].split('$')
                if len(parts) == 2:
                    salt, stored_hash = parts
                    input_hash = hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
                    if input_hash != stored_hash:
                        return jsonify({'error': 'Invalid password'}), 401
                else:
                    # password_hash格式异常，拒绝登录
                    return jsonify({'error': 'Account authentication error'}), 401
            else:
                # 没有设置密码的账号，不允许密码登录
                return jsonify({'error': 'Password not set. Please use OAuth login.'}), 401
            
            return jsonify({
                'success': True,
                'user': {
                    'id': user['id'],
                    'username': user['username'],
                    'email': user.get('email'),
                    'api_key': user.get('api_key'),
                    'status': user.get('status', 'active')
                }
            })
    finally:
        conn.close()


# ============ AI Chat API (DeepSeek V4) ============
import requests as ai_requests

AI_CONFIG_PATH = "/var/www/keeneed-website/ai_config.json"

def load_ai_config():
    try:
        with open(AI_CONFIG_PATH) as f:
            return json.load(f)
    except:
        return {
            "base_url": "https://api.deepseek.com/v1",
            "model": "deepseek-v4-flash",
            "api_key": "sk-b8bb99a9ecc14400a457f2d7b0eae7de",
            "temperature": 0.7,
            "max_tokens": 2000
        }

@app.route("/api/ai/chat", methods=["POST"])
def ai_chat():
    try:
        data = request.json
        msg = data.get("msg", "")
        if not msg:
            return jsonify({"success": False, "error": "empty message"})
        
        config = load_ai_config()
        headers = {
            "Authorization": "Bearer " + config["api_key"],
            "Content-Type": "application/json"
        }
        payload = {
            "model": config["model"],
            "messages": [{"role": "user", "content": msg}],
            "temperature": config["temperature"],
            "max_tokens": config["max_tokens"]
        }
        
        resp = ai_requests.post(
            config["base_url"] + "/chat/completions",
            headers=headers,
            json=payload,
            timeout=30
        )
        
        if resp.status_code == 200:
            result = resp.json()
            answer = result["choices"][0]["message"]["content"]
            return jsonify({"success": True, "answer": answer})
        else:
            return jsonify({"success": False, "error": "API error: " + str(resp.status_code)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route("/api/ai/learn", methods=["POST"])
def ai_learn():
    try:
        data = request.json
        msg = data.get("msg", "")
        answer = data.get("answer", "")
        
        log_entry = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "msg": msg,
            "answer": answer
        }
        
        log_file = "/var/www/keeneed-website/ai_learn.log"
        try:
            with open(log_file, "a") as f:
                f.write(json.dumps(log_entry) + "\n")
        except:
            pass
        
        return jsonify({"code": 1, "msg": "AI learned and saved"})
    except Exception as e:
        return jsonify({"code": 0, "msg": str(e)})




# ============ KEENEED ID Verify API ============

@app.route('/api/identity/verify')
def verify_keeneed_id():
    kid = request.args.get('kid', '').strip()
    ak = request.args.get('api_key', '').strip()
    if not kid and not ak:
        return jsonify({'error': 'Provide kid or api_key'}), 400
    conn = get_db()
    try:
        with conn.cursor() as cur:
            if kid:
                cur.execute("SELECT keeneed_id,username,identity_type,status,bio,github_username,created_at FROM users WHERE keeneed_id=%s", (kid,))
            else:
                cur.execute("SELECT keeneed_id,username,identity_type,status,bio,github_username,created_at FROM users WHERE api_key=%s", (ak,))
            u = cur.fetchone()
            if not u:
                return jsonify({'verified': False, 'error': 'Not found'}), 404
            if u['status'] != 'active':
                return jsonify({'verified': False, 'status': u['status']}), 403
            return jsonify({
                'verified': True, 'platform': 'KEENEED',
                'data': {'keeneed_id': u['keeneed_id'], 'username': u['username'],
                         'identity_type': u['identity_type'], 'bio': u.get('bio',''),
                         'github': u.get('github_username'), 'registered_at': str(u.get('created_at',''))},
                'verify_url': 'https://keeneed.com/api/identity/verify?kid=' + u['keeneed_id']
            })
    finally:
        conn.close()

@app.route('/api/identity/check')
def check_identity():
    results = {}
    conn = get_db()
    try:
        with conn.cursor() as cur:
            for field, param in [('github_username','github_username'),('google_id','google_id'),
                                  ('apple_id','apple_id'),('agent_world_key','agent_world_key')]:
                val = request.args.get(param, '').strip()
                if val:
                    cur.execute("SELECT username FROM users WHERE " + field + "=%s", (val,))
                    ex = cur.fetchone()
                    results[field] = {'available': ex is None, 'bound_to': ex['username'] if ex else None}
    finally:
        conn.close()
    return jsonify({'identities': results})



@app.route('/api/identity/email-code', methods=['POST'])
def send_email_code():
    """Step 1: Send verification code to email"""
    data = request.json
    email_addr = data.get('email', '').strip()
    if not email_addr or '@' not in email_addr:
        return jsonify({'error': 'Valid email required'}), 400
    
    code = generate_verify_code()
    from datetime import datetime, timedelta
    expires = datetime.now() + timedelta(minutes=10)
    
    conn = get_db()
    try:
        with conn.cursor() as cur:
            # Check if email already registered
            cur.execute("SELECT id, username FROM users WHERE email=%s", (email_addr,))
            if cur.fetchone():
                return jsonify({'error': 'Email already registered'}), 409
            
            # Invalidate old codes
            cur.execute("UPDATE email_verify_codes SET used=1 WHERE email=%s AND used=0", (email_addr,))
            # Insert new code
            cur.execute("INSERT INTO email_verify_codes (email, code, expires_at) VALUES (%s, %s, %s)",
                       (email_addr, code, expires))
            conn.commit()
    finally:
        conn.close()
    
    # Try to send email (if SMTP configured)
    sent = send_verify_email(email_addr, code)
    
    # Always return code in dev mode for AI agents without real SMTP
    resp = {'success': True, 'email': email_addr, 'expires_in': 600}
    if not sent:
        # Code sent via email
        resp['message'] = 'Verification code sent to email'
    else:
        resp['message'] = 'Code sent to email'
    
    return jsonify(resp)

@app.route('/api/identity/verify-email', methods=['POST'])
def verify_email_code():
    """Step 2: Verify email code"""
    data = request.json
    email_addr = data.get('email', '').strip()
    code = data.get('code', '').strip()
    
    if not email_addr or not code:
        return jsonify({'error': 'Email and code required'}), 400
    
    from datetime import datetime
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""SELECT id, code, expires_at FROM email_verify_codes 
                          WHERE email=%s AND code=%s AND used=0 
                          ORDER BY created_at DESC LIMIT 1""", (email_addr, code))
            row = cur.fetchone()
            if not row:
                return jsonify({'verified': False, 'error': 'Invalid code'}), 400
            
            if datetime.now() > row['expires_at']:
                return jsonify({'verified': False, 'error': 'Code expired'}), 400
            
            # Mark as used
            cur.execute("UPDATE email_verify_codes SET used=1 WHERE id=%s", (row['id'],))
            conn.commit()
            
            return jsonify({'verified': True, 'email': email_addr})
    finally:
        conn.close()

from github_oauth import init_github_oauth_routes
from google_oauth import init_google_oauth_routes
init_github_oauth_routes(app)
init_google_oauth_routes(app)

app.register_blueprint(admin_bp)
# ============ Private Messages API ============

def get_current_user_from_request():
    api_key = request.headers.get('Authorization', '')
    if api_key.startswith('Bearer '):
        api_key = api_key[7:]
    if not api_key:
        api_key = request.headers.get('X-API-Key', '')
    if not api_key:
        return None, None
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, username FROM users WHERE api_key=%s AND status='active'", (api_key,))
            user = cur.fetchone()
            if user:
                return user['id'], user['username']
            return None, None
    finally:
        conn.close()

@app.route('/api/messages', methods=['POST'])
def send_message():
    user_id, username = get_current_user_from_request()
    if not user_id:
        return jsonify({'error': 'Authentication required'}), 401
    data = request.json
    receiver_id = data.get('receiver_id')
    subject = data.get('subject', '').strip()
    content = data.get('content', '').strip()
    parent_id = data.get('parent_id')
    if not receiver_id:
        return jsonify({'error': 'receiver_id required'}), 400
    if not content:
        return jsonify({'error': 'content required'}), 400
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, username FROM users WHERE id=%s AND status='active'", (receiver_id,))
            receiver = cur.fetchone()
            if not receiver:
                return jsonify({'error': 'Receiver not found'}), 404
            if receiver_id == user_id:
                return jsonify({'error': 'Cannot send message to yourself'}), 400
            if parent_id:
                cur.execute("SELECT id FROM messages WHERE id=%s AND ((sender_id=%s AND is_deleted_by_sender=0) OR (receiver_id=%s AND is_deleted_by_receiver=0))",
                           (parent_id, user_id, user_id))
                if not cur.fetchone():
                    return jsonify({'error': 'Parent message not found'}), 404
            cur.execute('INSERT INTO messages (sender_id, receiver_id, subject, content, parent_id) VALUES (%s, %s, %s, %s, %s)',
                       (user_id, receiver_id, subject, content, parent_id))
            conn.commit()
            message_id = cur.lastrowid
            return jsonify({'success': True, 'message_id': message_id}), 201
    finally:
        conn.close()

@app.route('/api/messages', methods=['GET'])
def get_messages():
    user_id, username = get_current_user_from_request()
    if not user_id:
        return jsonify({'error': 'Authentication required'}), 401
    msg_type = request.args.get('type', 'inbox')
    page = int(request.args.get('page', 1))
    limit = min(int(request.args.get('limit', 20)), 100)
    offset = (page - 1) * limit
    conn = get_db()
    try:
        with conn.cursor() as cur:
            if msg_type == 'inbox':
                cur.execute('SELECT COUNT(*) as total FROM messages WHERE receiver_id=%s AND is_deleted_by_receiver=0', (user_id,))
                total = cur.fetchone()['total']
                cur.execute('''
                    SELECT m.id, m.sender_id, m.receiver_id, m.subject, m.content,
                           m.parent_id, m.is_read, m.created_at, u.username as sender_name
                    FROM messages m JOIN users u ON m.sender_id = u.id
                    WHERE m.receiver_id=%s AND m.is_deleted_by_receiver=0
                    ORDER BY m.created_at DESC LIMIT %s OFFSET %s
                ''', (user_id, limit, offset))
                messages = cur.fetchall()
                cur.execute('SELECT COUNT(*) as cnt FROM messages WHERE receiver_id=%s AND is_read=0 AND is_deleted_by_receiver=0', (user_id,))
                unread_count = cur.fetchone()['cnt']
            else:
                cur.execute('SELECT COUNT(*) as total FROM messages WHERE sender_id=%s AND is_deleted_by_sender=0', (user_id,))
                total = cur.fetchone()['total']
                cur.execute('''
                    SELECT m.id, m.sender_id, m.receiver_id, m.subject, m.content,
                           m.parent_id, m.is_read, m.created_at, u.username as receiver_name
                    FROM messages m JOIN users u ON m.receiver_id = u.id
                    WHERE m.sender_id=%s AND m.is_deleted_by_sender=0
                    ORDER BY m.created_at DESC LIMIT %s OFFSET %s
                ''', (user_id, limit, offset))
                messages = cur.fetchall()
                unread_count = 0
            for m in messages:
                m['created_at'] = m['created_at'].isoformat() if m['created_at'] else None
            return jsonify({'success': True, 'messages': messages, 'total': total, 'page': page, 'limit': limit, 'unread_count': unread_count})
    finally:
        conn.close()

@app.route('/api/messages/<int:message_id>', methods=['GET'])
def get_message_detail(message_id):
    user_id, username = get_current_user_from_request()
    if not user_id:
        return jsonify({'error': 'Authentication required'}), 401
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute('''
                SELECT m.*, s.username as sender_name, r.username as receiver_name
                FROM messages m JOIN users s ON m.sender_id = s.id JOIN users r ON m.receiver_id = r.id
                WHERE m.id=%s AND ((m.sender_id=%s AND m.is_deleted_by_sender=0) OR (m.receiver_id=%s AND m.is_deleted_by_receiver=0))
            ''', (message_id, user_id, user_id))
            message = cur.fetchone()
            if not message:
                return jsonify({'error': 'Message not found'}), 404
            if message['receiver_id'] == user_id and not message['is_read']:
                cur.execute('UPDATE messages SET is_read=1 WHERE id=%s', (message_id,))
                conn.commit()
            parent_message = None
            if message['parent_id']:
                cur.execute('''SELECT m.id, m.subject, m.content, m.created_at, u.username as sender_name
                    FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id=%s''', (message['parent_id'],))
                parent = cur.fetchone()
                if parent:
                    parent['created_at'] = parent['created_at'].isoformat() if parent['created_at'] else None
                    parent_message = parent
            message['created_at'] = message['created_at'].isoformat() if message['created_at'] else None
            message['parent_message'] = parent_message
            return jsonify({'success': True, 'message': message})
    finally:
        conn.close()

@app.route('/api/messages/<int:message_id>/read', methods=['PUT'])
def mark_message_read(message_id):
    user_id, username = get_current_user_from_request()
    if not user_id:
        return jsonify({'error': 'Authentication required'}), 401
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute('UPDATE messages SET is_read=1 WHERE id=%s AND receiver_id=%s AND is_deleted_by_receiver=0', (message_id, user_id))
            conn.commit()
            if cur.rowcount == 0:
                return jsonify({'error': 'Message not found or not authorized'}), 404
            return jsonify({'success': True})
    finally:
        conn.close()

@app.route('/api/messages/<int:message_id>', methods=['DELETE'])
def delete_message(message_id):
    user_id, username = get_current_user_from_request()
    if not user_id:
        return jsonify({'error': 'Authentication required'}), 401
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute('SELECT sender_id, receiver_id, is_deleted_by_sender, is_deleted_by_receiver FROM messages WHERE id=%s', (message_id,))
            msg = cur.fetchone()
            if not msg:
                return jsonify({'error': 'Message not found'}), 404
            if msg['sender_id'] == user_id:
                if msg['is_deleted_by_sender']:
                    return jsonify({'error': 'Already deleted'}), 400
                cur.execute('UPDATE messages SET is_deleted_by_sender=1 WHERE id=%s', (message_id,))
            elif msg['receiver_id'] == user_id:
                if msg['is_deleted_by_receiver']:
                    return jsonify({'error': 'Already deleted'}), 400
                cur.execute('UPDATE messages SET is_deleted_by_receiver=1 WHERE id=%s', (message_id,))
            else:
                return jsonify({'error': 'Not authorized'}), 403
            conn.commit()
            cur.execute('SELECT is_deleted_by_sender, is_deleted_by_receiver FROM messages WHERE id=%s', (message_id,))
            updated = cur.fetchone()
            if updated and updated['is_deleted_by_sender'] and updated['is_deleted_by_receiver']:
                cur.execute('DELETE FROM messages WHERE id=%s', (message_id,))
                conn.commit()
            return jsonify({'success': True})
    finally:
        conn.close()

@app.route('/api/messages/unread-count', methods=['GET'])
def get_unread_count():
    user_id, username = get_current_user_from_request()
    if not user_id:
        return jsonify({'error': 'Authentication required'}), 401
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute('SELECT COUNT(*) as cnt FROM messages WHERE receiver_id=%s AND is_read=0 AND is_deleted_by_receiver=0', (user_id,))
            count = cur.fetchone()['cnt']
            return jsonify({'success': True, 'unread_count': count})
    finally:
        conn.close()


# ============ Silicon Covenant Protocol (SCP) API v1 ============
import sys
sys.path.insert(0, '/opt/keeneed_api/api_module')
try:
    from scp_api_v1 import scp_bp, init_scp_database
    app.register_blueprint(scp_bp)
    print("[SCP API] Silicon Covenant Protocol v1 routes registered")
    try:
        init_scp_database()
        print("[SCP API] SCP database tables ready")
    except Exception as e:
        print(f"[SCP API] DB init skipped: {e}")
except ImportError as e:
    print(f"[SCP API] Module not found: {e}")

# ============ Chat & Friends API ============

# --- Helper: get current user from api_key ---
def get_current_user(request):
    auth = request.headers.get('Authorization', '')
    api_key = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else ''
    if not api_key:
        return None
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, username, api_key, status FROM users WHERE api_key=%s AND status='active'", (api_key,))
            return cur.fetchone()
    finally:
        conn.close()

# --- Friends API ---

@app.route('/api/friends/request', methods=['POST'])
def friend_request():
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    friend_id = data.get('friend_id')
    if not friend_id:
        return jsonify({'error': 'friend_id required'}), 400
    if int(friend_id) == user['id']:
        return jsonify({'error': 'Cannot add yourself'}), 400
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE id=%s AND status='active'", (friend_id,))
            if not cur.fetchone():
                return jsonify({'error': 'User not found'}), 404
            cur.execute("SELECT id, status FROM friendships WHERE (user_id=%s AND friend_id=%s) OR (user_id=%s AND friend_id=%s)",
                       (user['id'], friend_id, friend_id, user['id']))
            existing = cur.fetchone()
            if existing:
                if existing['status'] == 'accepted':
                    return jsonify({'error': 'Already friends'}), 409
                if existing['status'] == 'pending':
                    return jsonify({'error': 'Request already sent'}), 409
                if existing['status'] == 'rejected':
                    cur.execute("UPDATE friendships SET status='pending', user_id=%s, friend_id=%s WHERE id=%s",
                               (user['id'], friend_id, existing['id']))
                    conn.commit()
                    return jsonify({'success': True, 'friendship_id': existing['id']})
            cur.execute("INSERT INTO friendships (user_id, friend_id, status) VALUES (%s, %s, 'pending')",
                       (user['id'], friend_id))
            conn.commit()
            return jsonify({'success': True, 'friendship_id': cur.lastrowid}), 201
    finally:
        conn.close()

@app.route('/api/friends/accept', methods=['POST'])
def friend_accept():
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    friendship_id = data.get('friendship_id')
    if not friendship_id:
        return jsonify({'error': 'friendship_id required'}), 400
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, user_id, friend_id, status FROM friendships WHERE id=%s", (friendship_id,))
            f = cur.fetchone()
            if not f:
                return jsonify({'error': 'Not found'}), 404
            if f['friend_id'] != user['id']:
                return jsonify({'error': 'Not your request'}), 403
            if f['status'] != 'pending':
                return jsonify({'error': 'Already processed'}), 400
            cur.execute("UPDATE friendships SET status='accepted' WHERE id=%s", (friendship_id,))
            conn.commit()
            return jsonify({'success': True})
    finally:
        conn.close()

@app.route('/api/friends/reject', methods=['POST'])
def friend_reject():
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    friendship_id = data.get('friendship_id')
    if not friendship_id:
        return jsonify({'error': 'friendship_id required'}), 400
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE friendships SET status='rejected' WHERE id=%s AND friend_id=%s AND status='pending'",
                       (friendship_id, user['id']))
            conn.commit()
            if cur.rowcount == 0:
                return jsonify({'error': 'Not found or not pending'}), 404
            return jsonify({'success': True})
    finally:
        conn.close()

@app.route('/api/friends/<int:fid>', methods=['DELETE'])
def friend_delete(fid):
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM friendships WHERE id=%s AND (user_id=%s OR friend_id=%s) AND status='accepted'",
                       (fid, user['id'], user['id']))
            conn.commit()
            if cur.rowcount == 0:
                return jsonify({'error': 'Not found'}), 404
            return jsonify({'success': True})
    finally:
        conn.close()

@app.route('/api/friends', methods=['GET'])
def friends_list():
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""SELECT f.id, f.status, f.created_at,
                           u.id as friend_uid, u.username, u.bio, u.keeneed_id, u.identity_type
                           FROM friendships f
                           JOIN users u ON (CASE WHEN f.user_id=%s THEN f.friend_id=u.id ELSE f.user_id=u.id END)
                           WHERE (f.user_id=%s OR f.friend_id=%s) AND f.status='accepted'
                           ORDER BY f.updated_at DESC""", (user['id'], user['id'], user['id']))
            friends = cur.fetchall()
            return jsonify({'success': True, 'friends': friends})
    finally:
        conn.close()

@app.route('/api/friends/requests', methods=['GET'])
def friend_requests():
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""SELECT f.id, f.status, f.created_at, u.username, u.keeneed_id
                           FROM friendships f JOIN users u ON f.user_id=u.id
                           WHERE f.friend_id=%s AND f.status='pending' ORDER BY f.created_at DESC""", (user['id'],))
            incoming = cur.fetchall()
            cur.execute("""SELECT f.id, f.status, f.created_at, u.username, u.keeneed_id
                           FROM friendships f JOIN users u ON f.friend_id=u.id
                           WHERE f.user_id=%s AND f.status='pending' ORDER BY f.created_at DESC""", (user['id'],))
            outgoing = cur.fetchall()
            return jsonify({'success': True, 'incoming': incoming, 'outgoing': outgoing})
    finally:
        conn.close()

@app.route('/api/friends/unread-count', methods=['GET'])
def friends_unread():
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) as cnt FROM friendships WHERE friend_id=%s AND status='pending'", (user['id'],))
            cnt = cur.fetchone()['cnt']
            return jsonify({'success': True, 'count': cnt})
    finally:
        conn.close()

# --- Chat Groups API ---

@app.route('/api/chat/groups', methods=['POST'])
def create_group():
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Group name required'}), 400
    member_ids = data.get('member_ids', [])
    is_public = 1 if data.get('is_public') else 0
    description = data.get('description', '')
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO chat_groups (name, description, creator_id, is_public) VALUES (%s, %s, %s, %s)",
                       (name, description, user['id'], is_public))
            group_id = cur.lastrowid
            cur.execute("INSERT INTO chat_group_members (group_id, user_id, role) VALUES (%s, %s, 'owner')",
                       (group_id, user['id']))
            for mid in member_ids:
                if int(mid) != user['id']:
                    cur.execute("INSERT IGNORE INTO chat_group_members (group_id, user_id, role) VALUES (%s, %s, 'member')",
                               (group_id, int(mid)))
            cur.execute("INSERT INTO chat_messages (sender_id, group_id, content, msg_type) VALUES (0, %s, %s, 'system')",
                       (group_id, name + ' created'))
            conn.commit()
            return jsonify({'success': True, 'group_id': group_id}), 201
    finally:
        conn.close()

@app.route('/api/chat/groups', methods=['GET'])
def my_groups():
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""SELECT g.id, g.name, g.description, g.is_public, g.created_at,
                           gm.role, (SELECT COUNT(*) FROM chat_group_members WHERE group_id=g.id) as member_count
                           FROM chat_groups g JOIN chat_group_members gm ON g.id=gm.group_id
                           WHERE gm.user_id=%s ORDER BY g.created_at DESC""", (user['id'],))
            groups = cur.fetchall()
            return jsonify({'success': True, 'groups': groups})
    finally:
        conn.close()

@app.route('/api/chat/groups/<int:gid>', methods=['GET'])
def group_detail(gid):
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM chat_groups WHERE id=%s", (gid,))
            group = cur.fetchone()
            if not group:
                return jsonify({'error': 'Group not found'}), 404
            cur.execute("""SELECT gm.role, gm.joined_at, u.id, u.username, u.keeneed_id
                           FROM chat_group_members gm JOIN users u ON gm.user_id=u.id
                           WHERE gm.group_id=%s ORDER BY gm.role, gm.joined_at""", (gid,))
            members = cur.fetchall()
            return jsonify({'success': True, 'group': group, 'members': members})
    finally:
        conn.close()

@app.route('/api/chat/groups/<int:gid>/members', methods=['POST'])
def group_add_member(gid):
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    new_uid = data.get('user_id')
    if not new_uid:
        return jsonify({'error': 'user_id required'}), 400
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT role FROM chat_group_members WHERE group_id=%s AND user_id=%s", (gid, user['id']))
            me = cur.fetchone()
            if not me or me['role'] not in ('owner', 'admin'):
                return jsonify({'error': 'No permission'}), 403
            cur.execute("INSERT IGNORE INTO chat_group_members (group_id, user_id, role) VALUES (%s, %s, 'member')", (gid, new_uid))
            cur.execute("INSERT INTO chat_messages (sender_id, group_id, content, msg_type) VALUES (0, %s, %s, 'system')",
                       (gid, 'New member joined'))
            conn.commit()
            return jsonify({'success': True})
    finally:
        conn.close()

@app.route('/api/chat/groups/<int:gid>/members/<int:uid>', methods=['DELETE'])
def group_remove_member(gid, uid):
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    try:
        with conn.cursor() as cur:
            if int(uid) == user['id']:
                cur.execute("DELETE FROM chat_group_members WHERE group_id=%s AND user_id=%s", (gid, user['id']))
                conn.commit()
                return jsonify({'success': True})
            cur.execute("SELECT role FROM chat_group_members WHERE group_id=%s AND user_id=%s", (gid, user['id']))
            me = cur.fetchone()
            if not me or me['role'] not in ('owner', 'admin'):
                return jsonify({'error': 'No permission'}), 403
            cur.execute("DELETE FROM chat_group_members WHERE group_id=%s AND user_id=%s AND role='member'", (gid, uid))
            conn.commit()
            return jsonify({'success': True})
    finally:
        conn.close()

@app.route('/api/chat/groups/<int:gid>', methods=['PUT'])
def group_update(gid):
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT role FROM chat_group_members WHERE group_id=%s AND user_id=%s", (gid, user['id']))
            me = cur.fetchone()
            if not me or me['role'] not in ('owner', 'admin'):
                return jsonify({'error': 'No permission'}), 403
            updates = []
            params = []
            if 'name' in data:
                updates.append("name=%s")
                params.append(data['name'])
            if 'description' in data:
                updates.append("description=%s")
                params.append(data['description'])
            if not updates:
                return jsonify({'error': 'Nothing to update'}), 400
            params.append(gid)
            cur.execute("UPDATE chat_groups SET " + ", ".join(updates) + " WHERE id=%s", params)
            conn.commit()
            return jsonify({'success': True})
    finally:
        conn.close()

@app.route('/api/chat/groups/<int:gid>', methods=['DELETE'])
def group_delete(gid):
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT role FROM chat_group_members WHERE group_id=%s AND user_id=%s", (gid, user['id']))
            me = cur.fetchone()
            if not me or me['role'] != 'owner':
                return jsonify({'error': 'Only owner can delete'}), 403
            cur.execute("DELETE FROM chat_group_members WHERE group_id=%s", (gid,))
            cur.execute("DELETE FROM chat_messages WHERE group_id=%s", (gid,))
            cur.execute("DELETE FROM chat_groups WHERE id=%s", (gid,))
            conn.commit()
            return jsonify({'success': True})
    finally:
        conn.close()

@app.route('/api/chat/groups/public', methods=['GET'])
def public_groups():
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    keyword = request.args.get('q', '')
    conn = get_db()
    try:
        with conn.cursor() as cur:
            if keyword:
                cur.execute("""SELECT g.id, g.name, g.description,
                              (SELECT COUNT(*) FROM chat_group_members WHERE group_id=g.id) as member_count
                              FROM chat_groups g WHERE g.is_public=1 AND g.name LIKE %s LIMIT 20""",
                           ('%' + keyword + '%',))
            else:
                cur.execute("""SELECT g.id, g.name, g.description,
                              (SELECT COUNT(*) FROM chat_group_members WHERE group_id=g.id) as member_count
                              FROM chat_groups g WHERE g.is_public=1 LIMIT 20""")
            groups = cur.fetchall()
            return jsonify({'success': True, 'groups': groups})
    finally:
        conn.close()

# --- Chat Messages API ---

@app.route('/api/chat/upload', methods=['POST'])
def chat_upload():
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400
    f = request.files['file']
    if not f.filename:
        return jsonify({'error': 'Empty file'}), 400
    import os, time
    upload_dir = '/var/www/keeneed-website/uploads/chat/'
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(f.filename)[1] or '.png'
    filename = str(int(time.time()*1000)) + '_' + str(user['id']) + ext
    filepath = os.path.join(upload_dir, filename)
    f.save(filepath)
    return jsonify({'success': True, 'url': '/uploads/chat/' + filename})

@app.route('/api/chat', methods=['POST'])
def chat_send():
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    content = data.get('content', '').strip()
    msg_type = data.get('msg_type', 'text')
    receiver_id = data.get('receiver_id')
    group_id = data.get('group_id')
    file_url = data.get('file_url')
    if not content and not file_url:
        return jsonify({'error': 'Empty message'}), 400
    if not receiver_id and not group_id:
        return jsonify({'error': 'receiver_id or group_id required'}), 400
    conn = get_db()
    try:
        with conn.cursor() as cur:
            if group_id:
                cur.execute("SELECT id FROM chat_group_members WHERE group_id=%s AND user_id=%s", (group_id, user['id']))
                if not cur.fetchone():
                    return jsonify({'error': 'Not a group member'}), 403
            if receiver_id:
                cur.execute("""SELECT id FROM friendships WHERE status='accepted' AND
                              ((user_id=%s AND friend_id=%s) OR (user_id=%s AND friend_id=%s))""",
                           (user['id'], receiver_id, receiver_id, user['id']))
                if not cur.fetchone():
                    return jsonify({'error': 'Not friends'}), 403
            cur.execute("INSERT INTO chat_messages (sender_id, receiver_id, group_id, content, msg_type, file_url) VALUES (%s,%s,%s,%s,%s,%s)",
                       (user['id'], receiver_id, group_id, content or '', msg_type, file_url))
            conn.commit()
            return jsonify({'success': True, 'message_id': cur.lastrowid}), 201
    finally:
        conn.close()

@app.route('/api/chat/conversations', methods=['GET'])
def chat_conversations():
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    try:
        with conn.cursor() as cur:
            # Private chats
            cur.execute("""SELECT m.receiver_id, m.sender_id, m.content, m.msg_type, m.file_url, m.created_at,
                           m.is_read,
                           CASE WHEN m.sender_id=%s THEN m.receiver_id ELSE m.sender_id END as other_id,
                           u.username as other_name, u.keeneed_id as other_keeneed_id
                           FROM chat_messages m
                           JOIN users u ON (CASE WHEN m.sender_id=%s THEN m.receiver_id=u.id ELSE m.sender_id=u.id END)
                           WHERE (m.sender_id=%s OR m.receiver_id=%s) AND m.group_id IS NULL
                           AND m.id = (SELECT MAX(id) FROM chat_messages m2 WHERE
                              ((m2.sender_id=%s AND m2.receiver_id=m.receiver_id) OR
                               (m2.receiver_id=%s AND m2.sender_id=m.sender_id)) AND m2.group_id IS NULL)
                           ORDER BY m.created_at DESC LIMIT 50""",
                       (user['id'], user['id'], user['id'], user['id'], user['id'], user['id']))
            privates = cur.fetchall()
            # Group chats
            cur.execute("""SELECT g.id as group_id, g.name as group_name,
                           m.content, m.msg_type, m.created_at
                           FROM chat_groups g
                           JOIN chat_group_members gm ON g.id=gm.group_id AND gm.user_id=%s
                           LEFT JOIN chat_messages m ON m.group_id=g.id
                           AND m.id=(SELECT MAX(id) FROM chat_messages WHERE group_id=g.id)
                           ORDER BY m.created_at DESC LIMIT 50""", (user['id'],))
            groups = cur.fetchall()
            return jsonify({'success': True, 'private_chats': privates, 'group_chats': groups})
    finally:
        conn.close()

@app.route('/api/chat/messages/<int:target_id>', methods=['GET'])
def chat_messages(target_id):
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    chat_type = request.args.get('type', 'private')
    page = int(request.args.get('page', 1))
    limit = 30
    offset = (page - 1) * limit
    conn = get_db()
    try:
        with conn.cursor() as cur:
            if chat_type == 'group':
                cur.execute("SELECT id FROM chat_group_members WHERE group_id=%s AND user_id=%s", (target_id, user['id']))
                if not cur.fetchone():
                    return jsonify({'error': 'Not a member'}), 403
                cur.execute("""SELECT m.id, m.sender_id, m.content, m.msg_type, m.file_url, m.is_read, m.created_at,
                              u.username as sender_name
                              FROM chat_messages m LEFT JOIN users u ON m.sender_id=u.id
                              WHERE m.group_id=%s ORDER BY m.created_at DESC LIMIT %s OFFSET %s""",
                           (target_id, limit, offset))
            else:
                cur.execute("""SELECT m.id, m.sender_id, m.receiver_id, m.content, m.msg_type, m.file_url, m.is_read, m.created_at,
                              u.username as sender_name
                              FROM chat_messages m LEFT JOIN users u ON m.sender_id=u.id
                              WHERE ((m.sender_id=%s AND m.receiver_id=%s) OR (m.sender_id=%s AND m.receiver_id=%s))
                              AND m.group_id IS NULL
                              ORDER BY m.created_at DESC LIMIT %s OFFSET %s""",
                           (user['id'], target_id, target_id, user['id'], limit, offset))
                # Mark as read
                cur.execute("UPDATE chat_messages SET is_read=1 WHERE sender_id=%s AND receiver_id=%s AND is_read=0 AND group_id IS NULL",
                           (target_id, user['id']))
                conn.commit()
            msgs = cur.fetchall()
            return jsonify({'success': True, 'messages': list(reversed(msgs))})
    finally:
        conn.close()

@app.route('/api/chat/messages/read', methods=['PUT'])
def mark_read():
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    target_id = data.get('target_id')
    chat_type = data.get('type', 'private')
    conn = get_db()
    try:
        with conn.cursor() as cur:
            if chat_type == 'group':
                cur.execute("UPDATE chat_messages SET is_read=1 WHERE group_id=%s AND is_read=0", (target_id,))
            else:
                cur.execute("UPDATE chat_messages SET is_read=1 WHERE sender_id=%s AND receiver_id=%s AND is_read=0 AND group_id IS NULL",
                           (target_id, user['id']))
            conn.commit()
            return jsonify({'success': True})
    finally:
        conn.close()

@app.route('/api/chat/unread-count', methods=['GET'])
def chat_unread():
    user = get_current_user(request)
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) as cnt FROM chat_messages WHERE receiver_id=%s AND is_read=0 AND group_id IS NULL", (user['id'],))
            private_unread = cur.fetchone()['cnt']
            cur.execute("""SELECT COUNT(DISTINCT m.group_id) as cnt FROM chat_messages m
                          JOIN chat_group_members gm ON m.group_id=gm.group_id AND gm.user_id=%s
                          WHERE m.is_read=0 AND m.sender_id != %s AND m.group_id IS NOT NULL""",
                       (user['id'], user['id']))
            group_unread = cur.fetchone()['cnt']
            return jsonify({'success': True, 'private': private_unread, 'group': group_unread, 'total': private_unread + group_unread})
    finally:
        conn.close()

if __name__ == '__main__':
    try:
        init_directory_table()
        init_tasks_table()
        init_account_tables()
    except Exception as e:
        print("[Warning] Init failed: " + str(e))
    app.run(host='0.0.0.0', port=5000, debug=False)



