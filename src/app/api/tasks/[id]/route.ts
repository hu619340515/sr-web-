import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { ScheduledTask, ApiResponse } from '@/types';

// PUT - 更新定时任务
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body: Partial<ScheduledTask> = await request.json();
    const { id } = await params;

    const updatedTask = storage.updateScheduledTask(id, body);

    if (!updatedTask) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '定时任务不存在',
      }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: updatedTask,
      message: '定时任务更新成功',
    });
  } catch (error) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '更新定时任务失败',
    }, { status: 500 });
  }
}

// DELETE - 删除定时任务
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = storage.deleteScheduledTask(id);

    if (!deleted) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '定时任务不存在',
      }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: '定时任务删除成功',
    });
  } catch (error) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '删除定时任务失败',
    }, { status: 500 });
  }
}
