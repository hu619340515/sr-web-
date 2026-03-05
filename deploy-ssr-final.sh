#!/bin/bash

set -e

echo "🚀 开始 SSR 系统一键部署（最终版 v14 · 含 checkExpiredUsers 修复 + Node.js 20 + storage 导出）..."

# === 1. 安装/升级 Node.js 到 v20 ===
CURRENT_NODE=$(node -v 2>/dev/null || echo "none")
if [[ "$CURRENT_NODE" == "v18"* ]] || [[ "$CURRENT_NODE" == "none" ]]; then
  echo "🔧 升级 Node.js 到 v20.x (LTS)..."
  apt update
  apt install -y ca-certificates curl gnupg
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
  apt update
  apt install -y nodejs
  npm install -g pnpm
  echo "✅ Node.js $(node -v) 已安装"
else
  echo "✅ Node.js $CURRENT_NODE 已满足要求（>=20.9.0）"
fi

if ! node -v | grep -E 'v2[0-9]+\.' > /dev/null; then
  echo "❌ Node.js 版本仍低于 20，请检查安装"
  exit 1
fi

# === 2. 安装其他基础依赖 ===
DEBIAN_FRONTEND=noninteractive apt install -y \
  git wget python3 python3-pip build-essential \
  software-properties-common lsb-release

# === 3. 部署 ShadowsocksR ===
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

# === 4. 安装并启动 Docker + PostgreSQL ===
if ! command -v docker &> /dev/null; then
  echo "🐳 安装 Docker..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt update
  DEBIAN_FRONTEND=noninteractive apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
fi

if ! docker ps -a --format '{{.Names}}' | grep -q '^ssr-postgres$'; then
  echo "🆕 创建 PostgreSQL 容器..."
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
  echo "✅ PostgreSQL 已启动"
fi

# === 5. 部署 Web 项目 ===
cd /root
[ ! -d "sr-web-" ] && git clone https://github.com/hu619340515/sr-web-.git
cd sr-web-

cat > .env.local << 'EOF'
DATABASE_URL=postgres://ssr_user:secure_password_123@localhost:5432/ssr_management
EOF

# === 6. 修复 package.json 构建命令 ===
if [ -f "package.json" ]; then
  cp package.json package.json.bak
  sed -i 's|"build": *"[^"]*"|"build": "next build"|g' package.json
  if ! grep -q '"start"' package.json; then
    sed -i 's/"scripts": {/"scripts": {\n    "start": "next start",/g' package.json
  fi
  echo "✅ 修复 package.json 构建命令"
fi

# === 7. 注入 Drizzle Schema 和 DB Client ===
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

# === 8. 【核心修复】注入完整的 storage.ts（含 checkExpiredUsers）===
cat > src/lib/storage.ts << 'EOF'
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

async function updateSSRConfig() {
  const allUsers = await db.select({ port: users.port, password: users.passwordHash, method: users.method, protocol: users.protocol, obfs: users.obfs }).from(users).where(eq(users.status, 'normal'));
  const config = { server: "0.0.0.0", local_address: "127.0.0.1", local_port: 1080, port_password: Object.fromEntries(allUsers.map(u => [String(u.port), u.password])), timeout: 120, method: "aes-256-cfb", protocol: "origin", obfs: "plain", redirect: "", dns_ipv6: false, fast_open: false, workers: 1 };
  await fs.writeFile('/etc/shadowsocks/config.json', JSON.stringify(config, null, 2));
  try { await execAsync('systemctl restart shadowsocksr'); } catch (e) { console.warn('⚠️ SSR 重启失败'); }
}

export async function createUser(input) {
  const userData = { username: input.username, email: input.email, passwordHash: input.password, port: input.port, method: input.method, protocol: input.protocol || 'origin', obfs: input.obfs || 'plain', protoparam: '', obfsparam: '', trafficLimit: input.trafficLimit, expiresAt: input.expiresAt, status: 'normal' };
  const result = await db.insert(users).values(userData).returning();
  await updateSSRConfig();
  return result[0];
}
export async function getUsers() { return await db.select().from(users).orderBy(users.id); }
export async function getUserById(id) { const r = await db.select().from(users).where(eq(users.id, id)).limit(1); return r[0]; }
export async function updateUser(id, data) { const r = await db.update(users).set(data).where(eq(users.id, id)).returning(); await updateSSRConfig(); return r[0] || null; }
export async function deleteUser(id) { const r = await db.delete(users).where(eq(users.id, id)); await updateSSRConfig(); return r.count > 0; }
export async function getUserByPort(port) { const r = await db.select().from(users).where(eq(users.port, port)).limit(1); return r[0]; }

// ✅ 新增：获取已过期但状态仍为 normal 的用户（用于 /api/check-expired）
export async function checkExpiredUsers() {
  const now = new Date();
  return await db
    .select()
    .from(users)
    .where(sql`${users.expiresAt} <= ${now} AND ${users.status} = 'normal'`);
}

// ✅ 标记过期用户为 expired（用于定时任务）
export async function markUserExpired() {
  const now = new Date();
  const r = await db.update(users).set({ status: 'expired' }).where(sql`${users.expiresAt} <= ${now} AND ${users.status} = 'normal'`).returning({ id: users.id });
  await updateSSRConfig();
  return r.length;
}

// ✅ 统一导出 storage 对象，供 API 路由使用
export const storage = {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserByPort,
  checkExpiredUsers,
  markUserExpired,
};
EOF

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

# === 9. 安装依赖 ===
pnpm install
pnpm add next react react-dom drizzle-orm pg postgres bcrypt
pnpm add -D drizzle-kit tsx @types/bcrypt dotenv @types/node typescript

# === 10. 智能数据库迁移（幂等）===
echo "🔍 检查数据库表是否存在..."
TABLES_EXIST=false
if docker exec ssr-postgres psql -U ssr_user -d ssr_management -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')" | grep -q "t"; then
  if docker exec ssr-postgres psql -U ssr_user -d ssr_management -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'scheduled_tasks')" | grep -q "t"; then
    TABLES_EXIST=true
  fi
fi

if [ "$TABLES_EXIST" = "true" ]; then
  echo "✅ 数据库表已存在，跳过迁移"
else
  echo "🔄 生成并应用迁移..."
  rm -rf drizzle/*
  mkdir -p drizzle
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
    const statements = migrationSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (const stmt of statements) {
      await sql.unsafe(stmt);
    }
    console.log('✅ 迁移执行成功');
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

# === 11. 构建并启动服务 ===
echo "📦 构建 Next.js 应用..."
pnpm build

echo "▶️ 启动 Web 服务..."
pkill -f "next start" 2>/dev/null || true
nohup pnpm start > /root/ssr-web.log 2>&1 &
sleep 5

IP=$(hostname -I | awk '{print $1}')
echo ""
echo "🎉 部署成功！"
echo "🌐 Web 管理地址: http://$IP:3000"
echo "📄 日志文件: /root/ssr-web.log"
echo "💡 此脚本可安全重复运行（幂等设计）"
