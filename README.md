# SSR代理管理系统

一个功能完整的SSR代理服务端多用户管理系统，基于Next.js构建，提供现代化的Web管理界面。

## 功能特性

### ✅ 已实现功能

1. **服务器状态监控**
   - 实时显示服务器运行状态（运行中/停止/重启中）
   - CPU和内存使用率监控
   - 活跃连接数统计
   - 服务器重启功能

2. **用户管理**
   - 用户增删改查（CRUD）
   - 用户信息包括：用户名、邮箱、密码、端口
   - **加密方式**：none, aes-128-gcm, aes-192-gcm, aes-256-gcm, aes-128-cfb, aes-192-cfb, aes-256-cfb, aes-128-ctr, aes-192-ctr, aes-256-ctr, rc4-md5, chacha20-ietf, chacha20-poly1305
   - **协议选项**：origin, auth_aes128_md5, auth_aes128_sha1, auth_chain_a, auth_chain_b
   - **混淆选项**：plain, http_simple, http_post, random_head, tls1.2_ticket_auth, tls1.2_ticket_fastauth
   - **协议参数和混淆参数**：支持自定义参数
   - 流量限制和已使用流量统计
   - 用户到期时间管理
   - 用户状态管理（正常/已到期/已禁用）

3. **SSR链接生成**
   - 自动生成标准SSR链接（ssr://格式）
   - 一键复制SSR链接到剪贴板
   - 支持自定义服务器地址和端口
   - 测试服务器配置预览

4. **流量统计**
   - 总流量统计（上传/下载/总计）
   - 按用户筛选流量数据
   - 流量趋势图表可视化
   - 用户流量排行榜

5. **定时任务**
   - 创建定时任务（支持Cron表达式）
   - 任务启用/禁用切换
   - 立即执行任务
   - 任务管理（增删改）

6. **到期自动关闭**
   - 一键检查到期用户
   - 自动将到期用户状态设置为"已到期"

## 技术栈

- **前端框架**: Next.js 16 (App Router)
- **UI组件库**: shadcn/ui
- **样式**: Tailwind CSS 4
- **图表**: Recharts
- **语言**: TypeScript
- **包管理器**: pnpm

**注意**: 本项目使用 Next.js 16，动态路由参数 `params` 为异步 Promise 类型。

## 项目结构

```
src/
├── app/                          # Next.js App Router
│   ├── api/                      # API路由
│   │   ├── users/                # 用户管理API
│   │   │   ├── route.ts          # GET(列表), POST(创建)
│   │   │   └── [id]/route.ts     # GET, PUT, DELETE
│   │   ├── server/               # 服务器状态API
│   │   │   └── route.ts          # GET(状态), POST(重启)
│   │   ├── tasks/                # 定时任务API
│   │   │   ├── route.ts          # GET(列表), POST(创建)
│   │   │   ├── [id]/route.ts     # PUT(更新), DELETE
│   │   │   └── [id]/execute/route.ts  # POST(执行)
│   │   ├── traffic/              # 流量统计API
│   │   │   └── route.ts          # GET(统计)
│   │   └── check-expired/        # 到期检查API
│   │       └── route.ts          # POST(检查)
│   ├── users/page.tsx            # 用户管理页面
│   ├── server/page.tsx           # 服务器状态页面
│   ├── traffic/page.tsx          # 流量统计页面
│   ├── tasks/page.tsx            # 定时任务页面
│   ├── page.tsx                  # 仪表盘页面
│   └── layout.tsx                # 根布局
├── components/
│   ├── ui/                       # shadcn/ui组件
│   └── app-sidebar.tsx           # 侧边栏导航
├── lib/
│   ├── storage.ts                # 数据存储层（内存存储）
│   └── utils.ts                  # 工具函数
└── types/
    └── index.ts                  # TypeScript类型定义
```

## 如何对接真实SSR服务端

### 1. 数据持久化

当前系统使用内存存储，重启后数据会丢失。对接真实SSR服务端需要：

#### 方案A：使用数据库（推荐）

1. **安装PostgreSQL**:
```bash
# 使用Docker
docker run -d --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 postgres:15

# 或使用云数据库（如Supabase、AWS RDS等）
```

2. **配置数据库连接**:
创建 `.env.local` 文件：
```env
DATABASE_URL="postgresql://user:password@localhost:5432/ssr_management"
```

3. **使用ORM（Drizzle）**:
项目已预装 Drizzle ORM，需要创建schema并迁移。

**示例schema**:
```typescript
// src/lib/db/schema.ts
import { pgTable, serial, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull(),
  password: text('password').notNull(),
  port: integer('port').notNull().unique(),
  method: text('method').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  status: text('status').notNull(),
  trafficLimit: integer('traffic_limit').notNull(),
  trafficUsed: integer('traffic_used').default(0),
});

export const scheduledTasks = pgTable('scheduled_tasks', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  cronExpression: text('cron_expression').notNull(),
  code: text('code').notNull(),
  enabled: boolean('enabled').default(true),
  lastRun: timestamp('last_run'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

4. **替换storage.ts**:
将内存存储替换为数据库查询。

### 2. 对接SSR代理服务

#### 方案A：通过配置文件管理

1. **SSR配置文件位置**:
   - Shadowsocks: `/etc/shadowsocks/config.json`
   - V2Ray: `/etc/v2ray/config.json`
   - Xray: `/etc/xray/config.json`

2. **创建API调用SSR配置更新**:
```typescript
// src/lib/ssr-manager.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function addUserToSSR(user: User) {
  // 读取当前配置
  const config = await readSSRConfig();

  // 添加新用户
  config.users.push({
    port: user.port,
    password: user.password,
    method: user.method,
    // 其他SSR特定配置
  });

  // 写回配置文件
  await writeSSRConfig(config);

  // 重启SSR服务
  await execAsync('systemctl restart shadowsocks');
}

export async function removeUserFromSSR(port: number) {
  const config = await readSSRConfig();
  config.users = config.users.filter(u => u.port !== port);
  await writeSSRConfig(config);
  await execAsync('systemctl restart shadowsocks');
}
```

#### 方案B：通过API管理

如果SSR服务提供API接口：

```typescript
// src/lib/ssr-api.ts
const SSR_API_BASE = 'http://localhost:8388/api';

export async function addUser(user: User) {
  const response = await fetch(`${SSR_API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      port: user.port,
      password: user.password,
      method: user.method,
    }),
  });
  return response.json();
}
```

### 3. 流量统计对接

#### 方案A：读取SSR服务日志

```typescript
// src/lib/traffic-collector.ts
import { createReadStream } from 'fs';
import { readline } from 'readline';

export async function collectTrafficStats() {
  const fileStream = createReadStream('/var/log/shadowsocks/access.log');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const log = parseLogLine(line);
    await saveTrafficStat({
      userId: log.userId,
      upload: log.upload,
      download: log.download,
      timestamp: log.timestamp,
    });
  }
}
```

#### 方案B：使用SSR服务API

```typescript
export async function getTrafficStats(port: number) {
  const response = await fetch(`${SSR_API_BASE}/users/${port}/stats`);
  return response.json();
}
```

### 4. 定时任务执行

#### 方案A：使用node-cron

```bash
pnpm add node-cron
pnpm add -D @types/node-cron
```

```typescript
// src/lib/scheduler.ts
import cron from 'node-cron';
import { storage } from './storage';

export function startScheduler() {
  // 每分钟检查一次
  cron.schedule('* * * * *', async () => {
    const tasks = storage.getScheduledTasks();

    for (const task of tasks) {
      if (task.enabled && shouldRun(task.cronExpression)) {
        await executeTask(task);
      }
    }
  });
}

async function executeTask(task: ScheduledTask) {
  try {
    // 安全执行用户代码
    const fn = new Function(task.code);
    await fn();

    // 更新最后执行时间
    storage.updateScheduledTask(task.id, {
      lastRun: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Task execution failed:', error);
  }
}
```

#### 方案B：使用Bull队列（生产环境推荐）

```bash
pnpm add bull
```

### 5. 服务器状态监控

```typescript
// src/lib/server-monitor.ts
import os from 'os';

export async function getServerStats() {
  return {
    cpuUsage: getCpuUsage(),
    memoryUsage: (os.totalmem() - os.freemem()) / os.totalmem() * 100,
    activeConnections: await getActiveConnections(),
    uptime: process.uptime(),
  };
}

async function getActiveConnections() {
  // 读取网络连接数
  const { stdout } = await execAsync('netstat -an | grep ESTABLISHED | wc -l');
  return parseInt(stdout.trim());
}
```

## API接口文档

### 用户管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/users` | 获取用户列表 |
| POST | `/api/users` | 创建新用户 |
| GET | `/api/users/[id]` | 获取单个用户 |
| PUT | `/api/users/[id]` | 更新用户 |
| DELETE | `/api/users/[id]` | 删除用户 |

**创建用户示例**:
```bash
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123",
    "port": 10001,
    "method": "aes-256-gcm",
    "expiresAt": "2025-12-31T23:59:59.000Z",
    "trafficLimit": 10240
  }'
```

### 服务器状态

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/server` | 获取服务器状态 |
| POST | `/api/server` | 重启服务器 |

**重启服务器示例**:
```bash
curl -X POST http://localhost:5000/api/server \
  -H "Content-Type: application/json" \
  -d '{"action": "restart"}'
```

### 流量统计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/traffic` | 获取流量统计 |
| GET | `/api/traffic?userId=1` | 获取指定用户流量 |

### 定时任务

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tasks` | 获取任务列表 |
| POST | `/api/tasks` | 创建任务 |
| PUT | `/api/tasks/[id]` | 更新任务 |
| DELETE | `/api/tasks/[id]` | 删除任务 |
| POST | `/api/tasks/[id]/execute` | 执行任务 |

### 到期检查

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/check-expired` | 检查并关闭到期用户 |

## 测试服务器配置

系统内置了测试服务器配置，可用于测试SSR链接生成功能：

- **服务器地址**: 74.48.108.54
- **端口**: 13333
- **密码**: 5gfj5de
- **加密方式**: none
- **协议**: auth_chain_a
- **混淆**: plain

访问 `/test` 页面可以查看和复制基于此配置生成的SSR链接。

## SSR链接生成

系统支持自动生成标准SSR链接，格式为 `ssr://base64(...)`。

### 使用方式

1. **用户列表页面**:
   - 点击"复制"图标，复制该用户的SSR链接
   - 点击"链接"图标，查看SSR链接内容

2. **测试页面**:
   - 访问 `/test` 页面
   - 查看预生成的测试服务器SSR链接
   - 一键复制到剪贴板

3. **代码中使用**:

```typescript
import { generateSSRLink } from '@/lib/ssr-link';

// 生成SSR链接
const ssrLink = generateSSRLink(user, '74.48.108.54', 13333);
console.log(ssrLink);
// 输出: ssr://eyJzZXJ2ZXIiOiI3NC40OC4xMDguNTQ6MTMzMzMiLCJwcm90b2NvbCI6ImF1dGhfY2hhaW5fYSIsIm1ldGhvZCI6Im5vbmUiLCJvYmZzIjoicGxhaW4iLCJwYXNzd29yZCI6IjVnZmo1ZGUifQ==

// 复制到剪贴板
import { copySSRLink } from '@/lib/ssr-link';
await copySSRLink(ssrLink);
```

### SSR链接格式

标准SSR链接格式：`ssr://base64(server:port:protocol:method:obfs:password_base64/?params)`

包含的参数：
- server:port - 服务器地址和端口
- protocol - 协议类型
- method - 加密方式
- obfs - 混淆方式
- password_base64 - Base64编码的密码
- obfsparam - 混淆参数（可选）
- protoparam - 协议参数（可选）
- remarks - 备注（用户名）
- group - 分组名称

## 支持的加密方式、协议和混淆

### 加密方式（Encryption Method）
- none
- aes-128-gcm
- aes-192-gcm
- aes-256-gcm
- aes-128-cfb
- aes-192-cfb
- aes-256-cfb
- aes-128-ctr
- aes-192-ctr
- aes-256-ctr
- rc4-md5
- chacha20-ietf
- chacha20-poly1305

### 协议（Protocol）
- origin
- auth_aes128_md5
- auth_aes128_sha1
- auth_chain_a
- auth_chain_b

### 混淆（Obfuscation）
- plain
- http_simple
- http_post
- random_head
- tls1.2_ticket_auth
- tls1.2_ticket_fastauth

## 部署

### 开发环境

```bash
# 启动开发服务器
pnpm dev
```

### 生产环境

```bash
# 构建项目
pnpm build

# 启动生产服务器
pnpm start
```

### Docker部署

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build
EXPOSE 5000
CMD ["pnpm", "start"]
```

## 安全建议

1. **密码加密**: 用户密码应使用bcrypt或argon2加密存储
2. **API认证**: 添加JWT或Session认证机制
3. **HTTPS**: 生产环境必须使用HTTPS
4. **速率限制**: 防止API滥用
5. **输入验证**: 所有用户输入都应验证和清理

## 扩展功能建议

1. **用户认证系统**: 登录/注册/权限管理
2. **支付集成**: 自动续费和流量包购买
3. **邮件通知**: 到期提醒、流量超额提醒
4. **多服务器管理**: 支持管理多个SSR服务器
5. **客户端配置生成**: 自动生成SSR客户端配置文件
6. **节点分流**: 支持配置多个节点和分流规则

## 许可证

MIT License
