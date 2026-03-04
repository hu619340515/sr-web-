import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { CreateUserRequest, ApiResponse } from '@/types';

// GET - 获取所有用户
export async function GET() {
  try {
    const users = storage.getUsers();
    return NextResponse.json<ApiResponse>({
      success: true,
      data: users,
    });
  } catch (error) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '获取用户列表失败',
    }, { status: 500 });
  }
}

// POST - 创建新用户
export async function POST(request: NextRequest) {
  try {
    const body: CreateUserRequest = await request.json();

    // 验证必填字段
    if (!body.username || !body.email || !body.password || !body.port || !body.method || !body.expiresAt) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '缺少必填字段',
      }, { status: 400 });
    }

    // 检查端口是否已存在
    if (storage.getUsers().some(u => u.port === body.port)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '该端口已被使用',
      }, { status: 400 });
    }

    // 检查用户名是否已存在
    if (storage.getUserByUsername(body.username)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '用户名已存在',
      }, { status: 400 });
    }

    const newUser = storage.createUser({
      username: body.username,
      email: body.email,
      password: body.password, // 实际应用中应该加密
      port: body.port,
      method: body.method,
      protocol: body.protocol,
      obfs: body.obfs,
      protocolParam: body.protocolParam,
      obfsParam: body.obfsParam,
      expiresAt: body.expiresAt,
      trafficLimit: body.trafficLimit || 10240,
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: newUser,
      message: '用户创建成功',
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '创建用户失败',
    }, { status: 500 });
  }
}
