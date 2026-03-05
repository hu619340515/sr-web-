#!/bin/bash

set -e

echo "🚀 开始 SSR 管理系统一键部署（v25 · 完整最终版）..."

# === 1. Node.js 20 ===
CURRENT_NODE=$(node -v 2>/dev/null || echo "none")
if [[ "$CURRENT_NODE" == "v18"* ]] || [[ "$CURRENT_NODE" == "none" ]]; then
  apt update
  apt install -y ca-certificates curl gnupg
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
  apt update
  apt install -y nodejs
  npm install -g pnpm
fi

# === 2. 基础依赖 ===
DEBIAN_FRONTEND=noninteractive apt install -y git wget python3 python3-pip build-essential software-properties-common lsb-release

# === 3. ShadowsocksR ===
cd /opt
[ ! -d "shadowsocksr" ] && git clone -b akkariiin/master https://github.com/shadowsocksrr/shadowsocksr.git
mkdir -p /etc/shadowsocks
touch /etc/shadowsocks/config.json

cat > /etc/systemd/system/shadowsocksr.service << 'EOF'
[Unit]
Description=ShadowsocksR Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/shadowsocksr
ExecStart=/usr/bin/python3 /opt/shadowsocksr/server.py -c /etc/shadowsocks/config.json
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable shadowsocksr
systemctl start shadowsocksr || true

# === 4. Docker + PostgreSQL ===
if ! command -v docker &> /dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt update
  DEBIAN_FRONTEND=noninteractive apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
fi

if ! docker ps -a --format '{{.Names}}' | grep -q '^ssr-postgres$'; then
  docker run -d --name ssr-postgres \
    -e POSTGRES_DB=ssr_management \
    -e POSTGRES_USER=ssr_user \
    -e POSTGRES_PASSWORD=secure_password_123 \
    -p 5432:5432 \
    --restart unless-stopped \
    postgres:15
  sleep 15
else
  docker start ssr-postgres 2>/dev/null || true
fi

# === 5. Web 项目 ===
cd /root
[ ! -d "sr-web-" ] && git clone https://github.com/hu619340515/sr-web-.git
cd sr-web-

# 设置环境变量
cat > .env.local << 'EOF'
DATABASE_URL=postgres://ssr_user:secure_password_123@localhost:5432/ssr_management
NEXT_PUBLIC_SERVER_HOST=localhost
EOF

# 自动更新公网 IP
PUBLIC_IP=$(curl -s https://api.ipify.org || hostname -I | awk '{print $1}')
sed -i "s/NEXT_PUBLIC_SERVER_HOST=localhost/NEXT_PUBLIC_SERVER_HOST=$PUBLIC_IP/" .env.local

# === 6. 修复 package.json ===
sed -i 's|"build": *"[^"]*"|"build": "next build"|g' package.json || true
if ! grep -q '"start"' package.json; then
  sed -i 's/"scripts": {/"scripts": {\n    "start": "next start",/g' package.json
fi

# === 7. 【核心】类型定义（v25 · 含 UpdateUserRequest + SSR_CONFIG）===
mkdir -p src/types

cat > src/types/index.ts << 'EOF'
// 用户数据模型（来自数据库）
export interface User {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  port: number;
  method: string;
  protocol: string | null;
  obfs: string | null;
  protoparam: string | null;
  obfsparam: string | null;
  trafficLimit: number; // MB
  trafficUsed: number;  // MB
  expiresAt: Date | null;
  status: 'normal' | 'expired' | 'disabled';
  createdAt: Date | null;
}

// 创建用户请求体（必填字段）
export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  port: number;
  method: string;
  protocol?: string | null;
  obfs?: string | null;
  trafficLimit: number;
  expiresAt: string; // ISO 8601 字符串
}

// 更新用户请求体（所有字段可选）
export interface UpdateUserRequest {
  username?: string;
  email?: string;
  password?: string; // 若提供则重新哈希
  port?: number;
  method?: string;
  protocol?: string | null;
  obfs?: string | null;
  trafficLimit?: number;
  trafficUsed?: number;
  expiresAt?: string; // ISO 8601 字符串
  status?: 'normal' | 'expired' | 'disabled';
}

// SSR 配置常量（用于生成链接）
export const SSR_CONFIG = {
  defaultMethod: 'aes-256-cfb',
  defaultProtocol: 'origin',
  defaultObfs: 'plain',
  serverHost: typeof window !== 'undefined'
    ? window.location.hostname
    : process.env.NEXT_PUBLIC_SERVER_HOST || '127.0.0.1',
} as const;

// 通用 API 响应
export interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}
EOF

# === 8. DB Schema ===
mkdir -p src/lib/db

cat > src/lib/db/schema.ts << 'EOF'
import { pgTable, serial, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  port: integer('port').notNull().unique(),
  method: text('method').notNull(),
  protocol: text('protocol').default('origin'),
  obfs: text('obfs').default('plain'),
  protoparam: text('protoparam').default(''),
  obfsparam: text('obfsparam').default(''),
  trafficLimit: integer('traffic_limit').notNull(),
  trafficUsed: integer('traffic_used').default(0),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
export const scheduledTasks = pgTable('scheduled_tasks', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  cronExpression: text('cron_expression').notNull(),
  code: text('code').notNull(),
  enabled: boolean('enabled').default(true),
  lastRun: timestamp('last_run', { mode: 'date' }),
  createdAt: timestamp('created_at').defaultNow(),
});
EOF

cat > src/lib/db/client.ts << 'EOF'
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
export const db = drizzle(client, { schema });
EOF

# === 9. 【核心】storage.ts（v25 · 类型安全 + bcrypt + 完整导出）===
cat > src/lib/storage.ts << 'EOF'
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users, scheduledTasks } from '@/lib/db/schema';
import * as fs from 'fs/promises';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as bcrypt from 'bcrypt';
import { CreateUserRequest } from '@/types';

const execAsync = promisify(exec);

async function updateSSRConfig() {
  const allUsers = await db.select({ port: users.port, password: users.passwordHash, method: users.method, protocol: users.protocol, obfs: users.obfs }).from(users).where(eq(users.status, 'normal'));
  const config = {
    server: "0.0.0.0",
    local_address: "127.0.0.1",
    local_port: 1080,
    port_password: Object.fromEntries(allUsers.map(u => [String(u.port), u.password])),
    timeout: 120,
    method: "aes-256-cfb",
    protocol: "origin",
    obfs: "plain",
    redirect: "",
    dns_ipv6: false,
    fast_open: false,
    workers: 1
  };
  await fs.writeFile('/etc/shadowsocks/config.json', JSON.stringify(config, null, 2));
  try { await execAsync('systemctl restart shadowsocksr'); } catch (e) { console.warn('⚠️ SSR 重启失败'); }
}

// --- Users ---
export async function createUser(input: CreateUserRequest) {
  const expiresAt = input.expiresAt instanceof Date 
    ? input.expiresAt 
    : new Date(input.expiresAt);

  const passwordHash = await bcrypt.hash(input.password, 12);

  const userData = {
    username: input.username,
    email: input.email,
    passwordHash,
    port: input.port,
    method: input.method,
    protocol: input.protocol || 'origin',
    obfs: input.obfs || 'plain',
    protoparam: '',
    obfsparam: '',
    trafficLimit: input.trafficLimit,
    expiresAt,
    status: 'normal' as const,
  };

  const result = await db.insert(users).values(userData).returning();
  await updateSSRConfig();
  return result[0];
}

export async function getUsers() { return await db.select().from(users).orderBy(users.id); }
export async function getUserById(id: number) { const r = await db.select().from(users).where(eq(users.id, id)).limit(1); return r[0]; }
export async function updateUser(id: number, data: Partial<typeof users.$inferInsert>) { const r = await db.update(users).set(data).where(eq(users.id, id)).returning(); await updateSSRConfig(); return r[0] || null; }
export async function deleteUser(id: number) { const r = await db.delete(users).where(eq(users.id, id)); await updateSSRConfig(); return r.count > 0; }
export async function getUserByPort(port: number) { const r = await db.select().from(users).where(eq(users.port, port)).limit(1); return r[0]; }

// --- Expired Users ---
export async function checkExpiredUsers() {
  const now = new Date();
  return await db
    .select()
    .from(users)
    .where(sql`${users.expiresAt} <= ${now} AND ${users.status} = 'normal'`);
}
export async function markUserExpired() {
  const now = new Date();
  const r = await db.update(users).set({ status: 'expired' }).where(sql`${users.expiresAt} <= ${now} AND ${users.status} = 'normal'}`).returning({ id: users.id });
  await updateSSRConfig();
  return r.length;
}

// --- Server Status ---
export async function getServerStatus() {
  const uptime = Math.floor(os.uptime());
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memory = {
    total: Math.round(totalMem / 1024 / 1024),
    used: Math.round(usedMem / 1024 / 1024),
    free: Math.round(freeMem / 1024 / 1024),
  };

  const cpus = os.cpus();
  let idleTicks = 0, totalTicks = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTicks += cpu.times[type];
    }
    idleTicks += cpu.times.idle;
  }
  const idlePct = idleTicks / totalTicks;
  const cpuUsage = Math.round((1 - idlePct) * 100);

  let ssrRunning = false;
  try {
    const { stdout } = await execAsync('systemctl is-active shadowsocksr');
    ssrRunning = stdout.trim() === 'active';
  } catch (e) {
    ssrRunning = false;
  }

  const [totalUsers, expiredUsers] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(users),
    db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.status, 'expired')),
  ]);

  return {
    uptime,
    memory,
    cpuUsage,
    ssrRunning,
    userStats: {
      total: Number(totalUsers[0]?.count || 0),
      expired: Number(expiredUsers[0]?.count || 0),
    },
    timestamp: new Date().toISOString(),
  };
}

// --- Traffic Stats ---
export async function getTrafficStats(userId?: string) {
  let query = db.select({
    id: users.id,
    username: users.username,
    port: users.port,
    trafficUsed: users.trafficUsed,
    trafficLimit: users.trafficLimit,
    status: users.status,
    expiresAt: users.expiresAt,
  }).from(users);

  if (userId) {
    const idNum = parseInt(userId, 10);
    if (!isNaN(idNum)) {
      query = query.where(eq(users.id, idNum));
    }
  }

  return await query;
}

// --- Scheduled Tasks ---
export async function getScheduledTasks() {
  return await db.select().from(scheduledTasks).orderBy(scheduledTasks.id);
}

export async function getScheduledTaskById(id: number) {
  const r = await db.select().from(scheduledTasks).where(eq(scheduledTasks.id, id)).limit(1);
  return r[0] || null;
}

export async function updateScheduledTask(id: number, data: Partial<typeof scheduledTasks.$inferInsert>) {
  const r = await db.update(scheduledTasks).set(data).where(eq(scheduledTasks.id, id)).returning();
  return r[0] || null;
}

export const storage = {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserByPort,
  checkExpiredUsers,
  markUserExpired,
  getServerStatus,
  getTrafficStats,
  getScheduledTasks,
  getScheduledTaskById,
  updateScheduledTask,
};
EOF

# === 10. API 路由（v25 · 修复 passwordHash 类型错误）===
mkdir -p src/app/api/check-expired src/app/api/server src/app/api/tasks src/app/api/tasks/[id]/execute src/app/api/traffic src/app/api/users src/app/api/users/[id]

# users/route.ts
cat > src/app/api/users/route.ts << 'EOF'
import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { ApiResponse } from '@/types';

export async function GET() {
  try {
    const users = await storage.getUsers();
    return NextResponse.json<ApiResponse>({ success: true, data: users });
  } catch (error) {
    console.error('❌ 获取用户列表失败:', error);
    return NextResponse.json<ApiResponse>({ success: false, message: '服务器内部错误' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const existingUsers = await storage.getUsers();

    if (existingUsers.some(u => u.port === body.port)) {
      return NextResponse.json<ApiResponse>({ success: false, message: '该端口已被使用' }, { status: 400 });
    }
    if (existingUsers.some(u => u.username === body.username)) {
      return NextResponse.json<ApiResponse>({ success: false, message: '用户名已存在' }, { status: 400 });
    }

    const newUser = await storage.createUser(body);
    return NextResponse.json<ApiResponse>({ success: true, message: '用户创建成功', data: newUser }, { status: 201 });

  } catch (error) {
    console.error('❌ 创建用户失败:', error);
    return NextResponse.json<ApiResponse>({ success: false, message: '服务器内部错误' }, { status: 500 });
  }
}
EOF

# users/[id]/route.ts （v25 · 关键修复：使用 updateFields）
cat > src/app/api/users/[id]/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { UpdateUserRequest, ApiResponse } from '@/types';
import { users } from '@/lib/db/schema';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json<ApiResponse>({ success: false, message: '无效的用户 ID' }, { status: 400 });
    }

    const user = await storage.getUserById(userId);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, message: '用户不存在' }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({ success: true, data: user });
  } catch (error) {
    console.error('❌ 获取用户失败:', error);
    return NextResponse.json<ApiResponse>({ success: false, message: '服务器内部错误' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json() as UpdateUserRequest;
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return NextResponse.json<ApiResponse>({ success: false, message: '无效的用户 ID' }, { status: 400 });
    }

    const updateFields: Partial<typeof users.$inferInsert> = {};

    if (body.username !== undefined) updateFields.username = body.username;
    if (body.email !== undefined) updateFields.email = body.email;
    if (body.port !== undefined) updateFields.port = body.port;
    if (body.method !== undefined) updateFields.method = body.method;
    if (body.protocol !== undefined) updateFields.protocol = body.protocol;
    if (body.obfs !== undefined) updateFields.obfs = body.obfs;
    if (body.trafficLimit !== undefined) updateFields.trafficLimit = body.trafficLimit;
    if (body.trafficUsed !== undefined) updateFields.trafficUsed = body.trafficUsed;
    if (body.status !== undefined) updateFields.status = body.status;

    if (body.password !== undefined) {
      const bcrypt = await import('bcrypt');
      updateFields.passwordHash = await bcrypt.hash(body.password, 12);
    }

    if (body.expiresAt !== undefined) {
      updateFields.expiresAt = new Date(body.expiresAt);
    }

    const updatedUser = await storage.updateUser(userId, updateFields);
    if (!updatedUser) {
      return NextResponse.json<ApiResponse>({ success: false, message: '用户更新失败或不存在' }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({ success: true, message: '用户更新成功', data: updatedUser });
  } catch (error) {
    console.error('❌ 更新用户失败:', error);
    return NextResponse.json<ApiResponse>({ success: false, message: '服务器内部错误' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json<ApiResponse>({ success: false, message: '无效的用户 ID' }, { status: 400 });
    }

    const deleted = await storage.deleteUser(userId);
    if (!deleted) {
      return NextResponse.json<ApiResponse>({ success: false, message: '用户删除失败或不存在' }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({ success: true, message: '用户删除成功' });
  } catch (error) {
    console.error('❌ 删除用户失败:', error);
    return NextResponse.json<ApiResponse>({ success: false, message: '服务器内部错误' }, { status: 500 });
  }
}
EOF

# 其他路由（简化）
cat > src/app/api/check-expired/route.ts << 'EOF'
import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { ApiResponse } from '@/types';

export async function POST() {
  try {
    const expiredCount = await storage.markUserExpired();
    return NextResponse.json<ApiResponse>({
      success: true,
      message: `检查完成，已关闭 ${expiredCount} 个到期用户`,
      data: { expiredCount },
    });
  } catch (error) {
    console.error('❌ 检查过期用户失败:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, message: '服务器内部错误' },
      { status: 500 }
    );
  }
}
EOF

cat > src/app/api/server/route.ts << 'EOF'
import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { ApiResponse } from '@/types';

export async function GET() {
  try {
    const status = await storage.getServerStatus();
    return NextResponse.json<ApiResponse>({
      success: true,
      message: '服务器状态获取成功',
      data: status,
    });
  } catch (error) {
    console.error('❌ 获取服务器状态失败:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, message: '服务器内部错误' },
      { status: 500 }
    );
  }
}
EOF

cat > src/app/api/tasks/route.ts << 'EOF'
import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { ApiResponse } from '@/types';

export async function GET() {
  try {
    const tasks = await storage.getScheduledTasks();
    return NextResponse.json<ApiResponse>({ success: true, data: tasks });
  } catch (error) {
    console.error('❌ 获取定时任务列表失败:', error);
    return NextResponse.json<ApiResponse>({ success: false, message: '服务器内部错误' }, { status: 500 });
  }
}
EOF

cat > src/app/api/tasks/[id]/execute/route.ts << 'EOF'
import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { ApiResponse } from '@/types';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const taskId = parseInt(id, 10);
    if (isNaN(taskId)) {
      return NextResponse.json<ApiResponse>({ success: false, message: '无效的任务 ID' }, { status: 400 });
    }

    const task = await storage.getScheduledTaskById(taskId);
    if (!task) {
      return NextResponse.json<ApiResponse>({ success: false, message: '任务不存在' }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: `任务 "${task.name}" 执行成功（模拟）`,
      data: task,
    });
  } catch (error) {
    console.error('❌ 执行任务失败:', error);
    return NextResponse.json<ApiResponse>({ success: false, message: '服务器内部错误' }, { status: 500 });
  }
}
EOF

cat > src/app/api/tasks/[id]/route.ts << 'EOF'
import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { ApiResponse } from '@/types';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const taskId = parseInt(id, 10);
    if (isNaN(taskId)) {
      return NextResponse.json<ApiResponse>({ success: false, message: '无效的任务 ID' }, { status: 400 });
    }

    const updatedTask = await storage.updateScheduledTask(taskId, body);
    if (!updatedTask) {
      return NextResponse.json<ApiResponse>({ success: false, message: '任务更新失败或不存在' }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: '任务更新成功',
      data: updatedTask,
    });
  } catch (error) {
    console.error('❌ 更新任务失败:', error);
    return NextResponse.json<ApiResponse>({ success: false, message: '服务器内部错误' }, { status: 500 });
  }
}
EOF

cat > src/app/api/traffic/route.ts << 'EOF'
import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { ApiResponse } from '@/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const stats = await storage.getTrafficStats(userId || undefined);

    return NextResponse.json<ApiResponse>({ success: true, data: stats });
  } catch (error) {
    console.error('❌ 获取流量统计失败:', error);
    return NextResponse.json<ApiResponse>({ success: false, message: '服务器内部错误' }, { status: 500 });
  }
}
EOF

# === 11. Drizzle Config ===
cat > drizzle.config.ts << 'EOF'
import type { Config } from 'drizzle-kit';
import { config } from 'dotenv';
config({ path: '.env.local' });

if (!process.env.DATABASE_URL) throw new Error('❌ DATABASE_URL missing');
if (!process.env.DATABASE_URL.startsWith('postgres://')) throw new Error('❌ Use postgres://');

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL },
} satisfies Config;
EOF

# === 12. 安装依赖 ===
pnpm install
pnpm add next react react-dom drizzle-orm pg postgres bcrypt
pnpm add -D drizzle-kit tsx @types/bcrypt dotenv @types/node typescript

# === 13. 幂等迁移 ===
TABLES_EXIST=false
if docker exec ssr-postgres psql -U ssr_user -d ssr_management -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')" | grep -q "t"; then
  if docker exec ssr-postgres psql -U ssr_user -d ssr_management -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'scheduled_tasks')" | grep -q "t"; then
    TABLES_EXIST=true
  fi
fi

if [ "$TABLES_EXIST" = "false" ]; then
  rm -rf drizzle/*; mkdir -p drizzle
  npx drizzle-kit generate
  MIGRATION_FILE=$(find drizzle -name "*.sql" | sort | tail -n1)
  if [ -n "$MIGRATION_FILE" ]; then
    cat > apply-migration.ts << 'EOF'
import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';
import { readFile } from 'fs/promises';
(async () => {
  const sql = postgres(process.env.DATABASE_URL!);
  try {
    const migrationSql = await readFile(process.argv[2], 'utf8');
    const statements = migrationSql.split(';').map(s => s.trim()).filter(s => s && !s.startsWith('--'));
    for (const stmt of statements) await sql.unsafe(stmt);
    console.log('✅ 迁移成功');
  } catch (err) {
    console.error('❌ 迁移失败:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
})();
EOF
    npx tsx apply-migration.ts "$MIGRATION_FILE"
  fi
fi

# === 14. 构建启动 ===
pnpm build
pkill -f "next start" 2>/dev/null || true
nohup pnpm start > /root/ssr-web.log 2>&1 &

IP=$(hostname -I | awk '{print $1}')
echo ""
echo "🎉 SSR 管理系统部署成功！v25 · 完整最终版"
echo "🌐 访问地址: http://$IP:3000"
echo "📄 日志文件: /root/ssr-web.log"
echo "🔒 支持用户创建/更新/删除，密码自动哈希"
echo "✅ TypeScript 编译通过，Next.js 构建成功！"
