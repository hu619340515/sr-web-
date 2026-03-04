"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ScheduledTask } from "@/types";
import { Plus, Play, Trash2, Clock } from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";

export default function TasksPage() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    cronExpression: '0 * * * *',
    code: 'console.log("Hello, World!");',
    enabled: true,
  });

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      if (data.success) {
        setTasks(data.data);
      }
    } catch (error) {
      console.error('获取任务列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message || '任务创建成功');
        setDialogOpen(false);
        resetForm();
        fetchTasks();
      } else {
        alert('创建失败: ' + data.error);
      }
    } catch (error) {
      alert('创建失败');
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      const data = await res.json();
      if (data.success) {
        fetchTasks();
      } else {
        alert('更新失败: ' + data.error);
      }
    } catch (error) {
      alert('更新失败');
    }
  };

  const handleExecute = async (id: string) => {
    if (!confirm('确定要立即执行该任务吗？')) return;

    try {
      const res = await fetch(`/api/tasks/${id}/execute`, {
        method: 'POST',
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message || '任务执行成功');
        fetchTasks();
      } else {
        alert('执行失败: ' + data.error);
      }
    } catch (error) {
      alert('执行失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除该任务吗？')) return;

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchTasks();
      } else {
        alert('删除失败: ' + data.error);
      }
    } catch (error) {
      alert('删除失败');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      cronExpression: '0 * * * *',
      code: 'console.log("Hello, World!");',
      enabled: true,
    });
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('zh-CN');
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
            <h1 className="text-3xl font-bold text-gray-900">定时任务</h1>
            <p className="text-gray-600 mt-1">管理系统定时执行的任务</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                添加任务
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
              <DialogTitle>创建定时任务</DialogTitle>
              <DialogDescription>
                创建一个定时执行的代码任务（支持 Cron 表达式）
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">任务名称 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例如：每日备份"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">任务描述</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="简要描述任务功能"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cronExpression">Cron 表达式 *</Label>
                  <Input
                    id="cronExpression"
                    value={formData.cronExpression}
                    onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}
                    placeholder="例如：0 0 * * * (每天零点执行)"
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    格式：分 时 日 月 周 | 示例：0 */1 * * * (每小时执行)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">执行代码 *</Label>
                  <Textarea
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="// 在此输入要执行的代码"
                    className="min-h-[150px] font-mono"
                    required
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enabled"
                    checked={formData.enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                  />
                  <Label htmlFor="enabled">立即启用</Label>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">创建任务</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>任务列表</CardTitle>
          <CardDescription>当前系统中的所有定时任务</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>任务名称</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>Cron 表达式</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>最后执行</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">{task.name}</TableCell>
                  <TableCell>{task.description || '-'}</TableCell>
                  <TableCell className="font-mono text-sm">{task.cronExpression}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={task.enabled}
                        onCheckedChange={(checked) => handleToggle(task.id, checked)}
                      />
                      <Badge variant={task.enabled ? 'default' : 'secondary'}>
                        {task.enabled ? '已启用' : '已禁用'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(task.lastRun)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExecute(task.id)}
                        disabled={!task.enabled}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(task.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {tasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    暂无定时任务，点击右上角添加任务
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cron 表达式说明</CardTitle>
          <CardDescription>常用 Cron 表达式示例</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="font-mono">0 * * * *</span>
              <span className="text-muted-foreground">每小时执行一次</span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono">0 0 * * *</span>
              <span className="text-muted-foreground">每天零点执行</span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono">0 0 * * 0</span>
              <span className="text-muted-foreground">每周日零点执行</span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono">0 0 1 * *</span>
              <span className="text-muted-foreground">每月1号零点执行</span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono">*/30 * * * *</span>
              <span className="text-muted-foreground">每30分钟执行一次</span>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
