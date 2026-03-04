# 更新日志

## v1.1.0 - 2026-03-04

### 新增功能

#### 1. SSR协议和混淆支持
- ✅ 添加了协议选项（Protocol）：
  - origin
  - auth_aes128_md5
  - auth_aes128_sha1
  - auth_chain_a
  - auth_chain_b

- ✅ 添加了混淆选项（Obfuscation）：
  - plain
  - http_simple
  - http_post
  - random_head
  - tls1.2_ticket_auth
  - tls1.2_ticket_fastauth

- ✅ 添加了加密方式 "none" 选项
- ✅ 添加了协议参数（Protocol Param）和混淆参数（Obfs Param）的自定义支持

#### 2. SSR链接生成
- ✅ 实现了标准SSR链接生成功能
  - 格式：`ssr://base64(server:port:protocol:method:obfs:password_base64/?params)`
- ✅ 用户列表页添加一键复制SSR链接功能
- ✅ 用户列表页添加查看SSR链接功能
- ✅ 支持自定义服务器地址和端口

#### 3. 测试页面
- ✅ 新增 `/test` 测试页面
- ✅ 预置测试服务器配置：
  - 服务器地址：74.48.108.54
  - 端口：13333
  - 密码：5gfj5de
  - 加密方式：none
  - 协议：auth_chain_a
  - 混淆：plain
- ✅ 提供SSR链接一键复制功能
- ✅ 包含详细的使用说明和注意事项

### 改进

#### 1. 用户管理界面
- ✅ 更新用户列表显示，现在显示加密/协议/混淆三行信息
- ✅ 更新用户表单，添加协议和混淆字段
- ✅ 更新用户表单，添加协议参数和混淆参数输入
- ✅ 加密方式选择器改为动态渲染，支持所有13种加密方式

#### 2. 类型定义
- ✅ 更新 `User` 接口，添加 protocol, protocolParam, obfs, obfsParam 字段
- ✅ 更新 `CreateUserRequest` 接口
- ✅ 更新 `UpdateUserRequest` 接口
- ✅ 新增 `SSR_CONFIG` 常量，包含所有支持的选项

#### 3. 工具函数
- ✅ 新增 `src/lib/ssr-link.ts` 模块：
  - `generateSSRLink()` - 生成SSR链接
  - `parseSSRLink()` - 解析SSR链接
  - `copySSRLink()` - 复制SSR链接到剪贴板
  - `generateQRCodeContent()` - 生成二维码内容

### 文档更新

- ✅ 更新 `README.md`，添加：
  - SSR链接生成说明
  - 测试服务器配置说明
  - 支持的加密方式、协议和混淆列表
- ✅ 新增 `UPDATE_LOG.md`（本文件）

### 技术细节

#### SSR链接生成算法
```typescript
// 格式：ssr://base64(server:port:protocol:method:obfs:password_base64/?params)
const passwordBase64 = Buffer.from(user.password).toString('base64');
const ssrInfo = `${server}:${user.port}:${user.protocol}:${user.method}:${user.obfs}:${passwordBase64}`;
const params = `obfsparam=${user.obfsParam}&protoparam=${user.protocolParam}&remarks=${user.username}&group=SSR`;
const fullInfo = `${ssrInfo}/?${params}`;
const base64Encoded = Buffer.from(fullInfo).toString('base64');
return `ssr://${base64Encoded}`;
```

#### 测试配置
```json
{
  "server": "74.48.108.54",
  "serverPort": 13333,
  "password": "5gfj5de",
  "method": "none",
  "protocol": "auth_chain_a",
  "obfs": "plain"
}
```

### 兼容性
- ✅ 向后兼容：原有字段保持不变
- ✅ 新字段默认值：protocol='origin', obfs='plain', protocolParam='', obfsParam=''
- ✅ 适用于 ShadowsocksR (SSR) 协议
- ✅ 兼容主流SSR客户端（如ShadowsocksR、Clash等）

### 已知限制
1. 测试服务器仅供测试使用，不建议用于生产环境
2. SSR链接生成不包含二维码图片生成（如需可集成qrcode库）
3. 协议参数和混淆参数的验证较为宽松，用户需自行确保格式正确

### 后续计划
- [ ] 添加二维码图片生成功能
- [ ] 添加SSR链接批量导出功能
- [ ] 添加SSR订阅链接生成
- [ ] 支持V2Ray/VLESS等更多协议
- [ ] 添加客户端配置文件生成（SSR配置文件、Clash配置文件等）
