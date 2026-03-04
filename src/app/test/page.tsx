"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generateSSRLink, copySSRLink } from "@/lib/ssr-link";
import { Copy, CheckCircle2, AlertCircle } from "lucide-react";

export default function TestPage() {
  const [copied, setCopied] = useState(false);

  // 测试服务器配置
  const testConfig = {
    server: "74.48.108.54",
    serverPort: 13333,
    password: "5gfj5de",
    method: "none",
    protocol: "auth_chain_a",
    obfs: "plain",
  };

  // 构建测试用户对象
  const testUser = {
    id: "test",
    username: "测试用户",
    email: "test@example.com",
    password: testConfig.password,
    port: testConfig.serverPort,
    method: testConfig.method,
    protocol: testConfig.protocol,
    obfs: testConfig.obfs,
    protocolParam: "",
    obfsParam: "",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: "active" as const,
    trafficLimit: 10240,
    trafficUsed: 0,
  };

  const ssrLink = generateSSRLink(testUser, testConfig.server, testConfig.serverPort);

  const handleCopy = async () => {
    const success = await copySSRLink(ssrLink);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">SSR链接测试</h1>
          <p className="text-gray-600 mt-1">根据测试服务器配置生成SSR链接</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* 服务器配置 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-blue-600" />
                服务器配置
              </CardTitle>
              <CardDescription>测试服务器详细信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">服务器地址:</span>
                <span className="font-medium font-mono">{testConfig.server}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">端口:</span>
                <span className="font-medium font-mono">{testConfig.serverPort}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">密码:</span>
                <span className="font-medium font-mono">{testConfig.password}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">加密方式:</span>
                <Badge variant="secondary">{testConfig.method}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">协议:</span>
                <Badge variant="secondary">{testConfig.protocol}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">混淆:</span>
                <Badge variant="secondary">{testConfig.obfs}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* SSR链接 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                生成的SSR链接
              </CardTitle>
              <CardDescription>可用于SSR客户端的一键导入链接</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg border">
                <code className="text-sm break-all text-blue-600">
                  {ssrLink}
                </code>
              </div>
              <Button
                onClick={handleCopy}
                className="w-full"
                variant={copied ? "default" : "outline"}
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    已复制到剪贴板
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    复制SSR链接
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 使用说明 */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>使用说明</CardTitle>
            <CardDescription>如何使用生成的SSR链接</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">1. 复制SSR链接</h4>
              <p className="text-sm text-muted-foreground">
                点击上方的"复制SSR链接"按钮，将链接复制到剪贴板
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">2. 导入到客户端</h4>
              <p className="text-sm text-muted-foreground">
                打开你的SSR客户端（如ShadowsocksR、Clash等），选择"从剪贴板导入"或"添加服务器"，粘贴链接即可
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">3. 连接测试</h4>
              <p className="text-sm text-muted-foreground">
                连接成功后，访问Google或其他外网网站测试连接是否正常
              </p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-800 mb-2">⚠️ 注意事项</h4>
              <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                <li>此测试服务器仅供测试使用</li>
                <li>不要用于生产环境或重要数据传输</li>
                <li>测试服务器可能随时关闭或更改配置</li>
                <li>使用代理服务请遵守当地法律法规</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
