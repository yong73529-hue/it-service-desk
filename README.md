# 企业内部 IT 报修工单系统

基于 Next.js 15、TypeScript、Tailwind CSS、Prisma 和 SQLite 的企业内部 IT 服务台。第一阶段可独立运行，后续可通过 `src/services/wecom` 接入企业微信自建应用。

## 已实现功能

- 员工端：提交报修、图片附件、查看个人工单、实时排队位次、进度时间线、确认解决
- 运维端：今日工作台、优先队列、接单与状态流转、处理记录、优先级调整、维修结论、历史检索与组合筛选
- 管理端：真实工单统计、7 日趋势、分类/部门/运维处理量、响应与解决时间、最近和未完成工单
- 安全：HttpOnly 签名会话、服务端页面权限、服务端操作权限、员工工单归属校验
- 数据：每日工单编号、完整状态日志、可迁移的关系模型、27 张测试工单

## 本地初始化

要求 Node.js 20+。当前项目已在 Node.js 24 下验证。

```bash
npm install
copy .env.example .env
npm run db:setup
npm run dev
```

打开 `http://localhost:3000`，在 DEV_MODE 登录页可切换测试员工、运维和管理员身份。

如需重新生成测试数据（会清空当前本地数据库中的业务数据）：

```bash
npm run db:seed
```

## 生产构建与运行

```bash
npm ci
npm run db:deploy
npm run build
npm run start
```

默认监听 3000 端口。可使用 `PORT=3001 npm run start` 指定端口（PowerShell 使用 `$env:PORT=3001; npm run start`）。

生产环境务必设置高强度随机 `AUTH_SECRET`，关闭 `DEV_MODE` 和 `NEXT_PUBLIC_DEV_MODE`，并通过企业微信 OAuth 或其他正式身份源登录。

## Linux 服务器部署

1. 安装 Node.js 20+，将代码放置到例如 `/opt/it-service-desk`。
2. 创建 `.env`，设置生产 `AUTH_SECRET`、数据库连接和企业微信配置。
3. 执行 `npm ci && npm run db:deploy && npm run build`。
4. 确保运行用户可写 `public/uploads/tickets` 和 SQLite 数据文件所在目录。
5. 使用 systemd 或 PM2 托管 `npm run start`，在 Nginx/Caddy 后配置 HTTPS 反向代理。

systemd 示例：

```ini
[Unit]
Description=IT Service Desk
After=network.target

[Service]
Type=simple
User=itdesk
WorkingDirectory=/opt/it-service-desk
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

附件第一版保存在 `public/uploads/tickets`。备份时需同时备份 SQLite 数据库和附件目录。生产切换对象存储时，只需替换上传存储适配逻辑，数据库继续保存可访问路径。

## 企业微信预留

环境变量：`WECOM_CORP_ID`、`WECOM_AGENT_ID`、`WECOM_SECRET`、`WECOM_CALLBACK_URL`。集中适配层位于 `src/services/wecom/index.ts`；业务代码只调用适配层，不直接依赖企业微信 SDK。当前已预留 OAuth 回调路由和消息事件调用点，无参数时会安全跳过，不影响系统独立运行。

## SQLite 迁移到 MySQL

业务模型未使用 SQLite 特有字段。迁移时将 Prisma `datasource` 的 provider 改为 `mysql`，更新 `DATABASE_URL`，重新生成并执行数据库迁移。上线前应先在测试环境完成数据导出、导入和统计核对。
