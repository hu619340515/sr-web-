# Next.js 16 动态路由参数说明

## 重要变更

在 Next.js 16 中，动态路由参数 `params` 的类型发生了变化：

### 之前（Next.js 15及以下）
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id; // 直接访问
  // ...
}
```

### 现在（Next.js 16）
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }  // params 是 Promise
) {
  const { id } = await params; // 需要 await
  // ...
}
```

## 原因

Next.js 16 改进了服务端组件的渲染性能，将 `params` 改为异步的，允许在渲染期间进行并行数据获取。

## 修复的文件

在本项目中，以下文件已更新为使用 Promise 类型的 params：

1. `src/app/api/users/[id]/route.ts` - GET, PUT, DELETE
2. `src/app/api/tasks/[id]/route.ts` - PUT, DELETE
3. `src/app/api/tasks/[id]/execute/route.ts` - POST

## 迁移指南

### 1. 更新类型签名
将 `{ params: { id: string } }` 改为 `{ params: Promise<{ id: string }> }`

### 2. 添加 await
在使用 params 之前，添加 `const { id } = await params;`

### 3. 确保函数是 async
确保处理程序函数是 `async` 的，这样才能使用 await

## 其他注意事项

- 这种变化只影响动态路由，静态路由不受影响
- 对于嵌套的动态路由（如 `[id]/[slug]`），所有参数都在同一个 Promise 对象中
- 这种变化是 Next.js 16 的破坏性变更之一，升级时需要注意

## 参考文档

- [Next.js 16 Release Notes](https://nextjs.org/blog/next-16)
- [Next.js Dynamic Routes](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)
