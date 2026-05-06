const http = require('http');
const url = require('url');

const PORT = 8080;

// MCP Server implementation
const mcpServer = {
  name: 'keeneed-mcp',
  version: '1.0.0',
  
  // Handle JSON-RPC requests
  handleRequest(req) {
    if (!req.method || typeof this[req.method] !== 'function') {
      return {
        jsonrpc: '2.0',
        error: { code: -32601, message: 'Method not found' },
        id: req.id
      };
    }
    return this[req.method](req);
  },
  
  // Initialize - MCP handshake
  'initialize'(req) {
    return {
      jsonrpc: '2.0',
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {}
        },
        serverInfo: {
          name: this.name,
          version: this.version
        }
      },
      id: req.id
    };
  },
  
  // Health check
  'health'(req) {
    return {
      jsonrpc: '2.0',
      result: { status: 'healthy', uptime: process.uptime() },
      id: req.id
    };
  },
  
  // Tools list
  'tools/list'(req) {
    return {
      jsonrpc: '2.0',
      result: {
        tools: [
          { name: 'echo', description: 'Echo back the input', inputSchema: { type: 'object', properties: { message: { type: 'string' } } } },
          { name: 'get_status', description: 'Get server status', inputSchema: { type: 'object' } }
        ]
      },
      id: req.id
    };
  },
  
  // Tools call
  'tools/call'(req) {
    const { name, arguments: args = {} } = req.params || {};
    if (name === 'echo') {
      return { jsonrpc: '2.0', result: { content: [{ type: 'text', text: args.message || '' }] }, id: req.id };
    }
    if (name === 'get_status') {
      return { jsonrpc: '2.0', result: { content: [{ type: 'text', text: JSON.stringify({ status: 'running', uptime: process.uptime() }) }] }, id: req.id };
    }
    return { jsonrpc: '2.0', error: { code: -32601, message: 'Tool not found' }, id: req.id };
  }
};

// HTTP Server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Health endpoint
  if (parsedUrl.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', uptime: process.uptime() }));
    return;
  }
  
  // JSON-RPC endpoint
  if (req.method === 'POST' && parsedUrl.pathname === '/mcp') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const request = JSON.parse(body);
        const response = mcpServer.handleRequest(request);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null }));
      }
    });
    return;
  }
  
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`KeenNeed MCP Server running on port ${PORT}`);
});
