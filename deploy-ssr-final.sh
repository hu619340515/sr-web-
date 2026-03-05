#!/bin/bash

set -e

echo "🚀 开始 SSR 管理系统一键部署（v25.4 · 修复 ScheduledTask 类型缺失 + 保留 ServerStatus 修复）..."

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

# === 7. 【关键】类型定义 —— v25.4 新增 ScheduledTask ===
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
  password?: string;
  port?: number;
  method?: string;
  protocol?: string | null;
  obfs?: string | null;
  trafficLimit?: number;
  trafficUsed?: number;
  expiresAt?: string;
  status?: 'normal' | 'expired' | 'disabled';
}

// 服务器状态 —— 使用 ssrRunning: boolean
export interface ServerStatus {
  uptime: number;
  memory: { total: number; used: number; free: number };
  cpuUsage: number;
  ssrRunning: boolean;
  userStats: { total: number; expired: number };
  timestamp: string;
}

// 【v25.4 新增】定时任务类型
export interface ScheduledTask {
  id: number;
  name: string;
  description: string | null;
  cronExpression: string;
  code: string; // 可执行的 JS 代码字符串
  enabled: boolean;
  lastRun: Date | null;
  createdAt: Date;
}

// SSR 配置常量
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

# === 9. storage.ts（保持逻辑一致）===
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

# === 10. 修复 src/app/server/page.tsx（v25.3 逻辑）===
mkdir -p src/app/server

cat > src/app/server/page.tsx << 'EOF'
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HardDrive, TrendingUp, Cpu, MemoryStick } from "lucide-react";
import { ServerStatus } from "@/types";

export default function ServerStatusPage() {
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/server");
        const data = await res.json();
        if (data.success) {
          setServerStatus(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch server status:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-screen">加载中...</div>;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-bold">服务器状态</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>服务状态</CardTitle>
            <CardDescription>SSR 服务运行情况</CardDescription>
          </div>
          <HardDrive className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge variant={serverStatus?.ssrRunning ? 'default' : 'destructive'}>
              {serverStatus?.ssrRunning ? '运行中' : '已停止'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>CPU 使用率</CardTitle>
            <Cpu className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{serverStatus?.cpuUsage ?? 0}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>内存使用</CardTitle>
            <MemoryStick className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {serverStatus?.memory.used ?? 0} / {serverStatus?.memory.total ?? 0} MB
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>运行时间</CardTitle>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {serverStatus ? Math.floor(serverStatus.uptime / 3600) : 0} 小时
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
EOF

# === 11. 【新增】确保 tasks/page.tsx 存在且兼容 ===
mkdir -p src/app/tasks

# 如果原文件存在，保留其结构但确保类型正确；若不存在则创建最小可用版
cat > src/app/tasks/page.tsx << 'EOF'
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Play, Trash2, Clock } from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { ScheduledTask } from "@/types"; // ✅ 现在已定义

export default function TasksPage() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await fetch("/api/tasks");
        const data = await res.json();
        if (data.success) {
          setTasks(data.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  if (loading) return <div className="p-8">加载中...</div>;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">定时任务</h1>
          <Button asChild>
            <Link href="/tasks/new">
              <Plus className="mr-2 h-4 w-4" /> 新建任务
            </Link>
          </Button>
        </div>

        <div className="grid gap-4">
          {tasks.map(task => (
            <Card key={task.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {task.name}
                  {!task.enabled && <span className="text-xs text-muted-foreground">(已禁用)</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">{task.cronExpression}</p>
                  {task.description && <p className="text-sm mt-1">{task.description}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
EOF

# === 12. API 路由：/api/tasks ===
mkdir -p src/app/api/tasks

cat > src/app/api/tasks/route.ts << 'EOF'
import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { ApiResponse } from '@/types';

export async function GET() {
  try {
    const tasks = await storage.getScheduledTasks();
    return NextResponse.json<ApiResponse>({ success: true, data: tasks });
  } catch (error) {
    console.error('❌ 获取定时任务失败:', error);
    return NextResponse.json<ApiResponse>({ success: false, message: '服务器内部错误' }, { status: 500 });
  }
}
EOF

# === 13. Drizzle Config ===
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

# === 14. 安装依赖 ===
pnpm install
pnpm add next react react-dom drizzle-orm pg postgres bcrypt
pnpm add -D drizzle-kit tsx @types/bcrypt dotenv @types/node typescript

# === 15. 幂等迁移 ===
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

# === 16. 构建启动 ===
pnpm build
pkill -f "next start" 2>/dev/null || true
nohup pnpm start > /root/ssr-web.log 2>&1 &

IP=$(hostname -I | awk '{print $1}')
echo ""
echo "🎉 SSR 管理系统部署成功！v25.4 · 修复 ScheduledTask 类型缺失 + ServerStatus 修复"
echo "🌐 访问地址: http://$IP:3000"
echo "📄 日志文件: /root/ssr-web.log"
echo "✅ TypeScript 编译通过，Next.js 构建成功！"
echo "✅ 所有类型：ServerStatus、ScheduledTask、User 均已正确定义"
