"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Users, Calendar, HardDrive, TrendingUp } from "lucide-react";
import { ServerStatus, User } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Navbar } from "@/components/navbar";

export default function DashboardPage() {
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [userCount, setUserCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000); // 每5秒刷新
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [serverRes, usersRes, tasksRes] = await Promise.all([
        fetch('/api/server'),
        fetch('/api/users'),
        fetch('/api/tasks'),
      ]);

      const serverData = await serverRes.json();
      const usersData = await usersRes.json();
      const tasksData = await tasksRes.json();

      if (serverData.success) {
        setServerStatus(serverData.data);
      }
      if (usersData.success) {
        setUserCount(usersData.data.length);
      }
      if (tasksData.success) {
        setTaskCount(tasksData.data.length);
      }
    } catch (error) {
      console.error('获取仪表盘数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestartServer = async () => {
    if (!confirm('确定要重启服务器吗？')) return;

    try {
      const res = await fetch('/api/server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart' }),
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchDashboardData();
      } else {
        alert('操作失败: ' + data.error);
      }
    } catch (error) {
      alert('操作失败');
    }
  };

  const handleCheckExpiredUsers = async () => {
    try {
      const res = await fetch('/api/check-expired', {
        method: 'POST',
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchDashboardData();
      } else {
        alert('操作失败: ' + data.error);
      }
    } catch (error) {
      alert('操作失败');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 顶部导航 */}
      <div className="bg-white border-b shadow-sm mb-6">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">SSR管理系统</h1>
              <p className="text-sm text-gray-500">多用户代理服务管理</p>
            </div>
            <Navbar />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">仪表盘</h1>
            <p className="text-gray-600 mt-1">系统概览与状态监控</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCheckExpiredUsers} variant="outline">
              检查到期用户
            </Button>
            <Button onClick={handleRestartServer} variant="destructive">
              重启服务器
            </Button>
          </div>
        </div>

        {/* 服务器状态卡片 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">服务器状态</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant={serverStatus?.status === 'running' ? 'default' : 'destructive'}>
                  {serverStatus?.status === 'running' ? '运行中' : serverStatus?.status === 'stopped' ? '已停止' : '重启中'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CPU 使用率</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{serverStatus?.cpuUsage || 0}%</div>
              <p className="text-xs text-muted-foreground">CPU 负载</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">内存使用率</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{serverStatus?.memoryUsage || 0}%</div>
              <p className="text-xs text-muted-foreground">内存占用</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">活跃连接</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{serverStatus?.activeConnections || 0}</div>
              <p className="text-xs text-muted-foreground">当前连接数</p>
            </CardContent>
          </Card>
        </div>

        {/* 用户和任务统计 */}
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>用户统计</CardTitle>
              <CardDescription>系统用户信息概览</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <div className="text-3xl font-bold">{userCount}</div>
                  <div className="text-sm text-muted-foreground">总用户数</div>
                </div>
                <div className="h-16 w-px bg-gray-200" />
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {serverStatus?.activeConnections || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">在线用户</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>任务统计</CardTitle>
              <CardDescription>定时任务信息概览</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <div className="text-3xl font-bold">{taskCount}</div>
                  <div className="text-sm text-muted-foreground">总任务数</div>
                </div>
                <div className="h-16 w-px bg-gray-200" />
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {taskCount}
                  </div>
                  <div className="text-sm text-muted-foreground">活跃任务</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 运行时间 */}
        {serverStatus && (
          <Card>
            <CardHeader>
              <CardTitle>系统信息</CardTitle>
              <CardDescription>服务器运行详情</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">运行时长:</span>
                <span className="font-medium">{Math.floor(serverStatus.uptime / 3600)} 小时</span>
              </div>
              {serverStatus.lastRestart && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">上次重启:</span>
                  <span className="font-medium">
                    {new Date(serverStatus.lastRestart).toLocaleString('zh-CN')}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
