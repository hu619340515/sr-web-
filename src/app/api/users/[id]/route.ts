import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { UpdateUserRequest, ApiResponse } from '@/types';

// GET - 获取单个用户
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = storage.getUserById(id);

    if (!user) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '用户不存在',
      }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: user,
    });
  } catch (error) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '获取用户信息失败',
    }, { status: 500 });
  }
}

// PUT - 更新用户
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body: UpdateUserRequest = await request.json();
    const { id } = await params;

    const updatedUser = storage.updateUser(id, body);

    if (!updatedUser) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '用户不存在',
      }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: updatedUser,
      message: '用户更新成功',
    });
  } catch (error) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '更新用户失败',
    }, { status: 500 });
  }
}

// DELETE - 删除用户
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = storage.deleteUser(id);

    if (!deleted) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '用户不存在',
      }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: '用户删除成功',
    });
  } catch (error) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '删除用户失败',
    }, { status: 500 });
  }
}
