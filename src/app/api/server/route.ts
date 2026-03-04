import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { ApiResponse } from '@/types';

// GET - 获取服务器状态
export async function GET() {
  try {
    const status = storage.getServerStatus();

    // 模拟一些动态数据
    const now = Date.now();
    const cpu = Math.floor(Math.random() * 30) + 10; // 10-40%
    const memory = Math.floor(Math.random() * 40) + 30; // 30-70%
    const connections = Math.floor(Math.random() * 50) + 10;

    status.cpuUsage = cpu;
    status.memoryUsage = memory;
    status.activeConnections = connections;
    status.uptime = Math.floor((now - new Date('2024-01-01').getTime()) / 1000);

    storage.updateServerStatus(status);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: status,
    });
  } catch (error) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '获取服务器状态失败',
    }, { status: 500 });
  }
}

// POST - 重启服务器
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;

    if (action === 'restart') {
      storage.restartServer();

      return NextResponse.json<ApiResponse>({
        success: true,
        data: storage.getServerStatus(),
        message: '服务器正在重启',
      });
    }

    return NextResponse.json<ApiResponse>({
      success: false,
      error: '无效的操作',
    }, { status: 400 });
  } catch (error) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '操作失败',
    }, { status: 500 });
  }
}
