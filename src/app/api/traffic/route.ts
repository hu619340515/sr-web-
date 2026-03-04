import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { ApiResponse } from '@/types';

// GET - 获取流量统计
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    const stats = storage.getTrafficStats(userId || undefined);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: stats,
    });
  } catch (error) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '获取流量统计失败',
    }, { status: 500 });
  }
}
