import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { ApiResponse } from '@/types';

// POST - 检查并关闭到期用户
export async function POST() {
  try {
    const expiredUsers = storage.checkExpiredUsers();

    return NextResponse.json<ApiResponse>({
      success: true,
      message: `检查完成，已关闭 ${expiredUsers.length} 个到期用户`,
      data: {
        expiredCount: expiredUsers.length,
        expiredUsers: expiredUsers,
      },
    });
  } catch (error) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '检查到期用户失败',
    }, { status: 500 });
  }
}
