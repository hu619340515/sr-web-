// 用户类型
export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  port: number;
  method: string;
  protocol: string;
  protocolParam?: string;
  obfs: string;
  obfsParam?: string;
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'disabled';
  trafficLimit: number; // 流量限制（MB）
  trafficUsed: number; // 已使用流量（MB）
}

// 服务器状态
export interface ServerStatus {
  status: 'running' | 'stopped' | 'restarting';
  cpuUsage: number;
  memoryUsage: number;
  uptime: number;
  activeConnections: number;
  lastRestart?: string;
}

// 流量统计
export interface TrafficStat {
  userId: string;
  username: string;
  timestamp: string;
  upload: number; // 上传流量（MB）
  download: number; // 下载流量（MB）
  total: number; // 总流量（MB）
}

// 定时任务
export interface ScheduledTask {
  id: string;
  name: string;
  description?: string;
  cronExpression: string;
  code: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 创建用户请求
export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  port: number;
  method: string;
  protocol: string;
  protocolParam?: string;
  obfs: string;
  obfsParam?: string;
  expiresAt: string;
  trafficLimit: number;
}

// 更新用户请求
export interface UpdateUserRequest {
  id: string;
  username?: string;
  email?: string;
  password?: string;
  port?: number;
  method?: string;
  protocol?: string;
  protocolParam?: string;
  obfs?: string;
  obfsParam?: string;
  expiresAt?: string;
  trafficLimit?: number;
  status?: 'active' | 'expired' | 'disabled';
}

// SSR配置常量
export const SSR_CONFIG = {
  methods: ['none', 'aes-128-gcm', 'aes-192-gcm', 'aes-256-gcm', 'aes-128-cfb', 'aes-192-cfb', 'aes-256-cfb', 'aes-128-ctr', 'aes-192-ctr', 'aes-256-ctr', 'rc4-md5', 'chacha20-ietf', 'chacha20-poly1305'],
  protocols: ['origin', 'auth_aes128_md5', 'auth_aes128_sha1', 'auth_chain_a', 'auth_chain_b'],
  obfs: ['plain', 'http_simple', 'http_post', 'random_head', 'tls1.2_ticket_auth', 'tls1.2_ticket_fastauth'],
};
