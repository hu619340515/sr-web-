import { User, ServerStatus, TrafficStat, ScheduledTask } from '@/types';

// 内存数据存储（生产环境应替换为数据库）
class DataStorage {
  private users: User[] = [];
  private serverStatus: ServerStatus = {
    status: 'running',
    cpuUsage: 0,
    memoryUsage: 0,
    uptime: 0,
    activeConnections: 0,
  };
  private trafficStats: TrafficStat[] = [];
  private scheduledTasks: ScheduledTask[] = [];

  constructor() {
    // 初始化一些测试数据
    this.initTestData();
  }

  private initTestData() {
    // 创建测试用户
    const now = new Date();
    const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30天后

    this.users = [
      {
        id: '1',
        username: 'testuser1',
        email: 'test1@example.com',
        password: 'hashed_password_1',
        port: 10001,
        method: 'aes-256-gcm',
        protocol: 'origin',
        obfs: 'plain',
        createdAt: now.toISOString(),
        expiresAt: future.toISOString(),
        status: 'active',
        trafficLimit: 10240, // 10GB
        trafficUsed: 5120, // 5GB
      },
      {
        id: '2',
        username: 'testuser2',
        email: 'test2@example.com',
        password: 'hashed_password_2',
        port: 10002,
        method: 'aes-256-gcm',
        protocol: 'auth_chain_a',
        obfs: 'tls1.2_ticket_auth',
        protocolParam: '',
        obfsParam: '',
        createdAt: now.toISOString(),
        expiresAt: future.toISOString(),
        status: 'active',
        trafficLimit: 5120, // 5GB
        trafficUsed: 1024, // 1GB
      },
    ];

    // 创建测试流量统计
    for (let i = 0; i < 7; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      this.trafficStats.push(
        {
          userId: '1',
          username: 'testuser1',
          timestamp: date.toISOString(),
          upload: Math.floor(Math.random() * 500),
          download: Math.floor(Math.random() * 1000),
          total: 0,
        },
        {
          userId: '2',
          username: 'testuser2',
          timestamp: date.toISOString(),
          upload: Math.floor(Math.random() * 300),
          download: Math.floor(Math.random() * 600),
          total: 0,
        }
      );
    }
    // 计算总流量
    this.trafficStats.forEach(stat => {
      stat.total = stat.upload + stat.download;
    });
  }

  // 用户操作
  getUsers(): User[] {
    return [...this.users];
  }

  getUserById(id: string): User | undefined {
    return this.users.find(u => u.id === id);
  }

  getUserByUsername(username: string): User | undefined {
    return this.users.find(u => u.username === username);
  }

  createUser(user: Omit<User, 'id' | 'createdAt' | 'status' | 'trafficUsed'>): User {
    const newUser: User = {
      ...user,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      status: 'active',
      trafficUsed: 0,
    };
    this.users.push(newUser);
    return newUser;
  }

  updateUser(id: string, updates: Partial<User>): User | undefined {
    const index = this.users.findIndex(u => u.id === id);
    if (index !== -1) {
      this.users[index] = { ...this.users[index], ...updates };
      return this.users[index];
    }
    return undefined;
  }

  deleteUser(id: string): boolean {
    const index = this.users.findIndex(u => u.id === id);
    if (index !== -1) {
      this.users.splice(index, 1);
      return true;
    }
    return false;
  }

  // 服务器状态操作
  getServerStatus(): ServerStatus {
    return { ...this.serverStatus };
  }

  updateServerStatus(updates: Partial<ServerStatus>): void {
    this.serverStatus = { ...this.serverStatus, ...updates };
  }

  restartServer(): void {
    this.serverStatus.status = 'restarting';
    this.serverStatus.lastRestart = new Date().toISOString();
    this.serverStatus.uptime = 0;

    // 模拟重启过程
    setTimeout(() => {
      this.serverStatus.status = 'running';
    }, 2000);
  }

  // 流量统计操作
  getTrafficStats(userId?: string): TrafficStat[] {
    if (userId) {
      return this.trafficStats.filter(s => s.userId === userId);
    }
    return [...this.trafficStats];
  }

  addTrafficStat(stat: Omit<TrafficStat, 'total'>): TrafficStat {
    const newStat: TrafficStat = {
      ...stat,
      total: stat.upload + stat.download,
    };
    this.trafficStats.unshift(newStat);
    return newStat;
  }

  // 定时任务操作
  getScheduledTasks(): ScheduledTask[] {
    return [...this.scheduledTasks];
  }

  getScheduledTaskById(id: string): ScheduledTask | undefined {
    return this.scheduledTasks.find(t => t.id === id);
  }

  createScheduledTask(task: Omit<ScheduledTask, 'id' | 'createdAt' | 'lastRun' | 'nextRun'>): ScheduledTask {
    const newTask: ScheduledTask = {
      ...task,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    this.scheduledTasks.push(newTask);
    return newTask;
  }

  updateScheduledTask(id: string, updates: Partial<ScheduledTask>): ScheduledTask | undefined {
    const index = this.scheduledTasks.findIndex(t => t.id === id);
    if (index !== -1) {
      this.scheduledTasks[index] = { ...this.scheduledTasks[index], ...updates };
      return this.scheduledTasks[index];
    }
    return undefined;
  }

  deleteScheduledTask(id: string): boolean {
    const index = this.scheduledTasks.findIndex(t => t.id === id);
    if (index !== -1) {
      this.scheduledTasks.splice(index, 1);
      return true;
    }
    return false;
  }

  // 检查并更新到期用户
  checkExpiredUsers(): User[] {
    const now = new Date();
    const expiredUsers: User[] = [];

    this.users.forEach(user => {
      if (user.status === 'active' && new Date(user.expiresAt) < now) {
        user.status = 'expired';
        expiredUsers.push(user);
      }
    });

    return expiredUsers;
  }
}

// 导出单例
export const storage = new DataStorage();
