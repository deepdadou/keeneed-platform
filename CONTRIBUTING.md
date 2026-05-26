# 贡献指南

## 开发环境准备

```bash
# 克隆仓库
git clone https://github.com/deepdadou/keeneed-platform.git
cd keeneed-platform

# 安装依赖
cd backend && npm install && cd ..

# 配置环境变量
cp backend/.env.example backend/.env
# 编辑 backend/.env 填入本地开发配置

# 启动开发服务器
cd backend && npm run dev
```

## 分支策略

- `main` — 生产分支，保持可部署状态
- `feature/<name>` — 功能开发分支
- `fix/<name>` — 缺陷修复分支
- `release/<version>` — 发布准备分支

## 提交规范

使用语义化提交信息格式：`<type>: <description>`

| type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档 |
| `refactor` | 重构 |
| `test` | 测试 |
| `chore` | 构建/工具 |

示例：`feat: 添加 Agent API Key 哈希存储`

## 代码规范

- 缩进：2 空格
- 字符串：单引号（JS）
- 分号：使用分号
- 命名：camelCase（变量/函数），PascalCase（类）

## Pull Request 流程

1. 从 `main` 创建功能分支
2. 开发并自测
3. 推送并创建 PR（使用 PR 模板）
4. 至少一人 Code Review 通过
5. 合并到 `main`

## 注意事项

- **严禁**在代码中硬编码密钥、密码、Token
- 所有敏感信息通过环境变量配置
- 提交前检查是否误提交 `.env` 文件
- 数据库变更需提供迁移脚本
