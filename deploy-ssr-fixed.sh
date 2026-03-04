#!/bin/bash

set -e

echo "🚀 开始部署 SSR 管理系统（修复版：无 exec 陷阱）..."

# === 辅助函数 ===
run_as_user() {
  if [ "$EUID" -eq 0 ]; then
    sudo -u "$SUDO_USER" -E "$@"
  else
    "$@"
  fi
}

# === 1. 安装基础依赖 ===
echo "🔧 安装 Node.js、Python、Docker、Git..."
sudo apt update
sudo DEBIAN_FRONTEND=noninteractive apt install -y \
  curl git wget python3 python3-pip build-essential \
  ca-certificates gnupg lsb-release software-properties-common

# Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# pnpm
sudo npm install -g pnpm

# Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo DEBIAN_FRONTEND=noninteractive apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 将当前用户加入 docker 组
if [ "$EUID" -eq 0 ]; then
  sudo usermod -aG docker "$SUDO_USER"
  # 重新加载组（关键！避免需重新登录）
  newgrp docker << END
export HOME=\$(getent passwd $SUDO_USER | cut -d: -f6)
export USER=\$SUDO_USER
cd \$HOME
exec \$0 --after-newgrp "\$@"
END
  exit
else
  sudo usermod -aG docker $USER
  # 非 root 用户直接继续
fi

# 检查是否在 newgrp 子 shell 中
if [[ "$1" == "--after-newgrp" ]]; then
  shift
  echo "🔁 用户组已更新，继续部署..."
fi

# === 2. 安装 ShadowsocksR ===
echo "📦 安装 ShadowsocksR 服务端..."
cd /opt
sudo git clone -b akkariiin/master https://github.com/shadowsocksrr/shadowsocksr.git
sudo mkdir -p /etc/shadowsocks
sudo touch /etc/shadowsocks/config.json

cat << 'EOF' | sudo tee /etc/systemd/system/shadowsocksr.service
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

sudo systemctl daemon-reload
sudo systemctl enable shadowsocksr

# === 3. 启动 PostgreSQL ===
echo "🗃️  启动 PostgreSQL 数据库..."
docker run -d \
  --name ssr-postgres \
  -e POSTGRES_DB=ssr_management \
  -e POSTGRES_USER=ssr_user \
  -e POSTGRES_PASSWORD=secure_password_123 \
  -p 5432:5432 \
  --restart unless-stopped \
  postgres:15

sleep 15

# === 4. 部署 Web 项目 ===
echo "🌐 部署 Web 管理系统..."
cd ~
git clone https://github.com/hu619340515/sr-web-.git
cd sr-web-

# 创建 .env.local
cat > .env.local << 'EOF'
DATABASE_URL=postgresql://ssr_user:secure_password_123@localhost:5432/ssr_management
EOF

# === 5. 注入完整集成代码 ===
mkdir -p src/lib/db

# schema.ts
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

# client.ts
cat > src/lib/db/client.ts << 'EOF'
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
export const db = drizzle(client, { schema });
EOF

# storage.ts
cat > src/lib/storage.ts << 'EOF'
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users, scheduledTasks } from '@/lib/db/schema';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

export type User = typeof users.$inferSelect;
export type NewUserInput = Omit<typeof users.$inferInsert, 'passwordHash'> & { password: string };
export type ScheduledTask = typeof scheduledTasks.$inferSelect;

async function updateSSRConfig() {
  const allUsers = await db.select({
    port: users.port,
    password: users.passwordHash,
    method: users.method,
    protocol: users.protocol,
    obfs: users.obfs,
  }).from(users).where(eq(users.status, 'normal'));

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
  try {
    await execAsync('systemctl restart shadowsocksr');
  } catch (e) {
    console.warn('⚠️  SSR 服务重启失败（可能未启用）');
  }
}

export async function createUser(input: NewUserInput) {
  const userData = {
    username: input.username,
    email: input.email,
    passwordHash: input.password,
    port: input.port,
    method: input.method,
    protocol: input.protocol || 'origin',
    obfs: input.obfs || 'plain',
    protoparam: '',
    obfsparam: '',
    trafficLimit: input.trafficLimit,
    expiresAt: input.expiresAt,
    status: 'normal' as const,
  };
  const result = await db.insert(users).values(userData).returning();
  await updateSSRConfig();
  return result[0];
}

export async function getUsers() { return await db.select().from(users).orderBy(users.id); }
export async function getUserById(id: number) { const r = await db.select().from(users).where(eq(users.id, id)).limit(1); return r[0]; }
export async function updateUser(id: number, data: Partial<any>) { const r = await db.update(users).set(data).where(eq(users.id, id)).returning(); await updateSSRConfig(); return r[0] || null; }
export async function deleteUser(id: number) { const r = await db.delete(users).where(eq(users.id, id)); await updateSSRConfig(); return r.count > 0; }
export async function getUserByPort(port: number) { const r = await db.select().from(users).where(eq(users.port, port)).limit(1); return r[0]; }

export async function getScheduledTasks() { return await db.select().from(scheduledTasks).orderBy(scheduledTasks.id); }
export async function createScheduledTask(data: any) { const r = await db.insert(scheduledTasks).values(data).returning(); return r[0]; }
export async function updateScheduledTask(id: number, data: Partial<any>) { const r = await db.update(scheduledTasks).set(data).where(eq(scheduledTasks.id, id)).returning(); return r[0] || null; }
export async function deleteScheduledTask(id: number) { const r = await db.delete(scheduledTasks).where(eq(scheduledTasks.id, id)); return r.count > 0; }

export async function markUserExpired() {
  const now = new Date();
  const r = await db.update(users)
    .set({ status: 'expired' })
    .where(sql`${users.expiresAt} <= ${now} AND ${users.status} = 'normal'`)
    .returning({ id: users.id });
  await updateSSRConfig();
  return r.length;
}
EOF

# drizzle.config.ts
cat > drizzle.config.ts << 'EOF'
import type { Config } from 'drizzle-kit';
export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;
EOF

# === 6. 安装依赖并迁移数据库 ===
echo "📦 安装 Node.js 依赖..."
run_as_user pnpm install
run_as_user pnpm add drizzle-orm pg postgres bcrypt
run_as_user pnpm add -D drizzle-kit tsx @types/bcrypt

echo "🔄 生成并执行数据库迁移..."
run_as_user pnpm dlx drizzle-kit generate:pg
run_as_user npx tsx -e "
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './src/lib/db/schema';
const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client, { schema });
await migrate(db, { migrationsFolder: './drizzle' });
console.log('✅ 数据库迁移完成');
process.exit(0);
"

# === 7. 构建并启动 Web 服务 ===
echo "🏗️  构建 Web 应用..."
run_as_user pnpm build

echo "▶️  启动 Web 服务（端口 3000）..."
nohup run_as_user pnpm start > ~/sr-web-log.txt 2>&1 &

sleep 5

# === 8. 输出结果 ===
IP=$(hostname -I | awk '{print $1}')
echo ""
echo "🎉 部署成功！"
echo "🌐 Web 管理地址: http://$IP:3000"
echo "📄 日志文件: ~/sr-web-log.txt"
echo "🔐 数据库: ssr_user / secure_password_123"
echo ""
echo "⚠️ 注意事项："
echo "   - 首次使用请通过 Web 界面注册用户"
echo "   - 密码同时用于 Web 登录和 SSR 连接（演示用途）"
echo "   - 云服务器请在安全组开放 3000 和 SSR 端口（如 10000-20000）"
