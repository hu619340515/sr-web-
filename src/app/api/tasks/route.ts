import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { ScheduledTask, ApiResponse } from '@/types';

// GET - 获取所有定时任务
export async function GET() {
  try {
    const tasks = storage.getScheduledTasks();
    return NextResponse.json<ApiResponse>({
      success: true,
      data: tasks,
    });
  } catch (error) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '获取定时任务列表失败',
    }, { status: 500 });
  }
}

// POST - 创建新定时任务
export async function POST(request: NextRequest) {
  try {
    const body: Omit<ScheduledTask, 'id' | 'createdAt' | 'lastRun' | 'nextRun'> = await request.json();

    // 验证必填字段
    if (!body.name || !body.cronExpression || !body.code) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '缺少必填字段',
      }, { status: 400 });
    }

    const newTask = storage.createScheduledTask({
      name: body.name,
      description: body.description,
      cronExpression: body.cronExpression,
      code: body.code,
      enabled: body.enabled ?? true,
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: newTask,
      message: '定时任务创建成功',
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '创建定时任务失败',
    }, { status: 500 });
  }
}
