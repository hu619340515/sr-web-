"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrafficStat, User } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, Download, Upload } from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";

export default function TrafficPage() {
  const [stats, setStats] = useState<TrafficStat[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [selectedUser]);

  const fetchData = async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([
        fetch(`/api/traffic${selectedUser !== 'all' ? `?userId=${selectedUser}` : ''}`),
        fetch('/api/users'),
      ]);

      const statsData = await statsRes.json();
      const usersData = await usersRes.json();

      if (statsData.success) {
        setStats(statsData.data);
      }
      if (usersData.success) {
        setUsers(usersData.data);
      }
    } catch (error) {
      console.error('获取流量数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 按日期分组数据
  const getChartData = () => {
    const grouped: { [key: string]: { upload: number; download: number; total: number } } = {};

    stats.forEach(stat => {
      const date = new Date(stat.timestamp).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
      if (!grouped[date]) {
        grouped[date] = { upload: 0, download: 0, total: 0 };
      }
      grouped[date].upload += stat.upload;
      grouped[date].download += stat.download;
      grouped[date].total += stat.total;
    });

    return Object.entries(grouped)
      .map(([date, data]) => ({
        date,
        upload: data.upload,
        download: data.download,
        total: data.total,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  // 获取用户流量汇总
  const getUserTrafficSummary = () => {
    const userStats: { [userId: string]: TrafficStat } = {};

    stats.forEach(stat => {
      if (!userStats[stat.userId]) {
        userStats[stat.userId] = {
          userId: stat.userId,
          username: stat.username,
          timestamp: stat.timestamp,
          upload: 0,
          download: 0,
          total: 0,
        };
      }
      userStats[stat.userId].upload += stat.upload;
      userStats[stat.userId].download += stat.download;
      userStats[stat.userId].total += stat.total;
    });

    return Object.values(userStats);
  };

  const formatTraffic = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  const chartData = getChartData();
  const userTrafficSummary = getUserTrafficSummary();

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
            <h1 className="text-3xl font-bold text-gray-900">流量统计</h1>
            <p className="text-gray-600 mt-1">系统流量使用情况分析</p>
          </div>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="选择用户" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部用户</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

      {/* 总流量统计 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总上传流量</CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatTraffic(stats.reduce((sum, s) => sum + s.upload, 0))}
            </div>
            <p className="text-xs text-muted-foreground">累计上传</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总下载流量</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatTraffic(stats.reduce((sum, s) => sum + s.download, 0))}
            </div>
            <p className="text-xs text-muted-foreground">累计下载</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总流量</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatTraffic(stats.reduce((sum, s) => sum + s.total, 0))}
            </div>
            <p className="text-xs text-muted-foreground">累计总流量</p>
          </CardContent>
        </Card>
      </div>

      {/* 流量趋势图 */}
      <Card>
        <CardHeader>
          <CardTitle>流量趋势</CardTitle>
          <CardDescription>最近7天流量使用情况</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => formatTraffic(Number(value))} />
                <Legend />
                <Bar dataKey="download" fill="#3b82f6" name="下载" />
                <Bar dataKey="upload" fill="#10b981" name="上传" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground">暂无流量数据</div>
          )}
        </CardContent>
      </Card>

      {/* 用户流量排行 */}
      {selectedUser === 'all' && userTrafficSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>用户流量排行</CardTitle>
            <CardDescription>各用户流量使用统计</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={userTrafficSummary}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="username" />
                <YAxis />
                <Tooltip formatter={(value) => formatTraffic(Number(value))} />
                <Legend />
                <Bar dataKey="total" fill="#8b5cf6" name="总流量" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* 流量明细 */}
      <Card>
        <CardHeader>
          <CardTitle>流量明细</CardTitle>
          <CardDescription>详细流量记录</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.slice(0, 10).map((stat, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <div className="font-medium">{stat.username}</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(stat.timestamp).toLocaleString('zh-CN')}
                  </div>
                </div>
                <div className="flex gap-6 text-sm">
                  <div>
                    <div className="text-muted-foreground">上传</div>
                    <div className="font-medium">{formatTraffic(stat.upload)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">下载</div>
                    <div className="font-medium">{formatTraffic(stat.download)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">总计</div>
                    <div className="font-medium">{formatTraffic(stat.total)}</div>
                  </div>
                </div>
              </div>
            ))}
            {stats.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">暂无流量记录</div>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
