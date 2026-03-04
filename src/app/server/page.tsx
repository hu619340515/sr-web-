"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ServerStatus } from "@/types";
import { Activity, Cpu, HardDrive, RefreshCw, Clock, Zap } from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";

export default function ServerPage() {
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServerStatus();
    const interval = setInterval(fetchServerStatus, 3000); // 每3秒刷新
    return () => clearInterval(interval);
  }, []);

  const fetchServerStatus = async () => {
    try {
      const res = await fetch('/api/server');
      const data = await res.json();
      if (data.success) {
        setServerStatus(data.data);
      }
    } catch (error) {
      console.error('获取服务器状态失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async () => {
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
        fetchServerStatus();
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

  if (!serverStatus) {
    return <div className="text-center text-muted-foreground">无法获取服务器状态</div>;
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
          <h1 className="text-3xl font-bold text-gray-900">服务器状态</h1>
          <p className="text-gray-600 mt-1">实时监控服务器运行状态</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchServerStatus}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
          <Button variant="destructive" onClick={handleRestart}>
            重启服务器
          </Button>
        </div>
      </div>

      {/* 服务器状态卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">运行状态</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant={serverStatus.status === 'running' ? 'default' : serverStatus.status === 'stopped' ? 'destructive' : 'secondary'}>
                {serverStatus.status === 'running' ? '运行中' : serverStatus.status === 'stopped' ? '已停止' : '重启中'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU 使用率</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{serverStatus.cpuUsage}%</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${serverStatus.cpuUsage}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">内存使用率</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{serverStatus.memoryUsage}%</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all"
                style={{ width: `${serverStatus.memoryUsage}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">活跃连接</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{serverStatus.activeConnections}</div>
            <p className="text-xs text-muted-foreground">当前在线用户</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">运行时长</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {Math.floor(serverStatus.uptime / 3600)}h
            </div>
            <p className="text-xs text-muted-foreground">
              {(Math.floor(serverStatus.uptime % 3600) / 60).toFixed(0)} 分钟
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">上次重启</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {serverStatus.lastRestart
                ? new Date(serverStatus.lastRestart).toLocaleString('zh-CN')
                : '无记录'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 服务器详情 */}
      <Card>
        <CardHeader>
          <CardTitle>服务器信息</CardTitle>
          <CardDescription>详细的系统运行信息</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Cpu className="h-5 w-5 text-blue-600" />
                <span className="font-medium">CPU 负载</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">{serverStatus.cpuUsage}%</div>
                {serverStatus.cpuUsage > 80 && (
                  <Badge variant="destructive">高负载</Badge>
                )}
                {serverStatus.cpuUsage > 60 && serverStatus.cpuUsage <= 80 && (
                  <Badge variant="secondary">中等</Badge>
                )}
                {serverStatus.cpuUsage <= 60 && (
                  <Badge className="bg-green-500">正常</Badge>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <HardDrive className="h-5 w-5 text-green-600" />
                <span className="font-medium">内存占用</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">{serverStatus.memoryUsage}%</div>
                {serverStatus.memoryUsage > 80 && (
                  <Badge variant="destructive">高占用</Badge>
                )}
                {serverStatus.memoryUsage > 60 && serverStatus.memoryUsage <= 80 && (
                  <Badge variant="secondary">中等</Badge>
                )}
                {serverStatus.memoryUsage <= 60 && (
                  <Badge className="bg-green-500">正常</Badge>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-yellow-600" />
                <span className="font-medium">活跃连接数</span>
              </div>
              <div className="text-2xl font-bold">{serverStatus.activeConnections}</div>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
