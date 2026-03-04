import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { ApiResponse } from '@/types';

// POST - 执行定时任务
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = storage.getScheduledTaskById(id);

    if (!task) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '定时任务不存在',
      }, { status: 404 });
    }

    if (!task.enabled) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '定时任务已禁用',
      }, { status: 400 });
    }

    // 更新最后执行时间
    storage.updateScheduledTask(id, {
      lastRun: new Date().toISOString(),
    });

    // 在实际应用中，这里应该执行代码
    // 这里只是模拟执行
    console.log(`执行任务: ${task.name}`);
    console.log(`代码: ${task.code}`);

    return NextResponse.json<ApiResponse>({
      success: true,
      message: '定时任务执行成功',
      data: {
        executed: true,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '执行定时任务失败',
    }, { status: 500 });
  }
}
