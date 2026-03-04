"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, CreateUserRequest, SSR_CONFIG } from "@/types";
import { Plus, Pencil, Trash2, Copy, Link2 } from "lucide-react";
import Link from "next/link";
import { generateSSRLink, copySSRLink } from "@/lib/ssr-link";
import { Navbar } from "@/components/navbar";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<CreateUserRequest>({
    username: '',
    email: '',
    password: '',
    port: 0,
    method: 'none',
    protocol: 'origin',
    obfs: 'plain',
    protocolParam: '',
    obfsParam: '',
    expiresAt: '',
    trafficLimit: 10240,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
    const method = editingUser ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message || '操作成功');
        setDialogOpen(false);
        resetForm();
        fetchUsers();
      } else {
        alert('操作失败: ' + data.error);
      }
    } catch (error) {
      alert('操作失败');
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: user.password,
      port: user.port,
      method: user.method,
      protocol: user.protocol,
      obfs: user.obfs,
      protocolParam: user.protocolParam || '',
      obfsParam: user.obfsParam || '',
      expiresAt: user.expiresAt.split('T')[0],
      trafficLimit: user.trafficLimit,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除该用户吗？')) return;

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchUsers();
      } else {
        alert('删除失败: ' + data.error);
      }
    } catch (error) {
      alert('删除失败');
    }
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      email: '',
      password: '',
      port: 0,
      method: 'none',
      protocol: 'origin',
      obfs: 'plain',
      protocolParam: '',
      obfsParam: '',
      expiresAt: '',
      trafficLimit: 10240,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const formatTraffic = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb} MB`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">正常</Badge>;
      case 'expired':
        return <Badge variant="secondary">已到期</Badge>;
      case 'disabled':
        return <Badge variant="destructive">已禁用</Badge>;
      default:
        return <Badge>未知</Badge>;
    }
  };

  const handleCopySSRLink = async (user: User) => {
    const ssrLink = generateSSRLink(user, '74.48.108.54'); // 使用用户的端口
    const success = await copySSRLink(ssrLink);
    if (success) {
      alert('SSR链接已复制到剪贴板');
    } else {
      alert('复制失败，请手动复制');
    }
  };

  const getSSRLink = (user: User) => {
    return generateSSRLink(user, '74.48.108.54'); // 使用用户的端口
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
          <h1 className="text-3xl font-bold text-gray-900">用户管理</h1>
          <p className="text-gray-600 mt-1">管理系统用户和权限</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              添加用户
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingUser ? '编辑用户' : '添加新用户'}</DialogTitle>
              <DialogDescription>
                {editingUser ? '修改用户信息' : '创建新的SSR代理用户'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">用户名 *</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">邮箱 *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">密码 *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required={!editingUser}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">端口 *</Label>
                    <Input
                      id="port"
                      type="number"
                      value={formData.port}
                      onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="method">加密方式 *</Label>
                    <Select
                      value={formData.method}
                      onValueChange={(value) => setFormData({ ...formData, method: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SSR_CONFIG.methods.map((method) => (
                          <SelectItem key={method} value={method}>{method}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="protocol">协议 *</Label>
                    <Select
                      value={formData.protocol}
                      onValueChange={(value) => setFormData({ ...formData, protocol: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SSR_CONFIG.protocols.map((protocol) => (
                          <SelectItem key={protocol} value={protocol}>{protocol}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="obfs">混淆 *</Label>
                    <Select
                      value={formData.obfs}
                      onValueChange={(value) => setFormData({ ...formData, obfs: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SSR_CONFIG.obfs.map((obfs) => (
                          <SelectItem key={obfs} value={obfs}>{obfs}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trafficLimit">流量限制 (MB) *</Label>
                    <Input
                      id="trafficLimit"
                      type="number"
                      value={formData.trafficLimit}
                      onChange={(e) => setFormData({ ...formData, trafficLimit: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="protocolParam">协议参数（可选）</Label>
                    <Input
                      id="protocolParam"
                      value={formData.protocolParam}
                      onChange={(e) => setFormData({ ...formData, protocolParam: e.target.value })}
                      placeholder="如需要，输入协议参数"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="obfsParam">混淆参数（可选）</Label>
                    <Input
                      id="obfsParam"
                      value={formData.obfsParam}
                      onChange={(e) => setFormData({ ...formData, obfsParam: e.target.value })}
                      placeholder="如需要，输入混淆参数"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiresAt">到期时间 *</Label>
                  <Input
                    id="expiresAt"
                    type="date"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">{editingUser ? '更新' : '创建'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>用户列表</CardTitle>
          <CardDescription>当前系统中的所有用户</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>端口</TableHead>
                <TableHead>加密/协议/混淆</TableHead>
                <TableHead>流量使用</TableHead>
                <TableHead>到期时间</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.port}</TableCell>
                  <TableCell>
                    <div className="text-xs space-y-1">
                      <div><span className="text-muted-foreground">加密:</span> {user.method}</div>
                      <div><span className="text-muted-foreground">协议:</span> {user.protocol}</div>
                      <div><span className="text-muted-foreground">混淆:</span> {user.obfs}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {formatTraffic(user.trafficUsed)} / {formatTraffic(user.trafficLimit)}
                  </TableCell>
                  <TableCell>{formatDate(user.expiresAt)}</TableCell>
                  <TableCell>{getStatusBadge(user.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopySSRLink(user)}
                        title="复制SSR链接"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const ssrLink = getSSRLink(user);
                          alert(`SSR链接:\n${ssrLink}`);
                        }}
                        title="查看SSR链接"
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(user.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
