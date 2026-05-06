# KEENEED 项目文档

本目录存放KEENEED平台的设计文档、实施指南和修复报告，作为项目复盘和后续维护的参考。

## 目录结构

```
docs/
├── design/          # 设计文档
│   ├── KEENEED-Agent-API-Key设计文档.md   # Agent API Key申领流程设计
│   └── KEENEED技术路线图.md               # 平台技术路线图（4阶段16周计划）
├── guides/          # 实施指南
│   ├── KEENEED_Apple_OAuth_Implementation_Guide.md  # Apple OAuth集成指南
│   └── KEENEED_Apple_Quick_Guide.md                # Apple快速接入指南
└── reports/         # 修复报告
    └── KEENEED_P0修复总结.md              # P0级404端点修复总结
```

## 文档规范

- **设计文档**：新功能开发前必须先写设计文档，记录需求背景、方案选型、接口设计
- **实施指南**：第三方集成、部署操作等需要步骤指引的场景
- **修复报告**：P0/P1级问题修复后写总结，记录根因、修复方案、回归验证结果
