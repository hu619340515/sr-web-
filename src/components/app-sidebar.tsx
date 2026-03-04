"use client";

import * as React from "react";
import { Calendar, LayoutDashboard, Users, BarChart3, Activity, Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  {
    title: "仪表盘",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "服务器状态",
    url: "/server",
    icon: Activity,
  },
  {
    title: "用户管理",
    url: "/users",
    icon: Users,
  },
  {
    title: "流量统计",
    url: "/traffic",
    icon: BarChart3,
  },
  {
    title: "定时任务",
    url: "/tasks",
    icon: Calendar,
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-gray-200 p-4">
        <h1 className="text-xl font-bold text-gray-900">SSR管理系统</h1>
        <p className="text-sm text-gray-500">多用户代理服务管理</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>导航菜单</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
