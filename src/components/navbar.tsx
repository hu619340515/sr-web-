"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    if (confirm("确定要退出登录吗？")) {
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("username");
      router.push("/login");
    }
  };

  const username = typeof window !== 'undefined' ? localStorage.getItem("username") || "Admin" : "Admin";

  const navItems = [
    { href: "/", label: "仪表盘" },
    { href: "/server", label: "服务器状态" },
    { href: "/users", label: "用户管理" },
    { href: "/traffic", label: "流量统计" },
    { href: "/tasks", label: "定时任务" },
    { href: "/test", label: "测试" },
  ];

  return (
    <nav className="flex items-center gap-4">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={
            pathname === item.href
              ? "text-blue-600 font-medium hover:underline"
              : "text-gray-600 hover:text-blue-600"
          }
        >
          {item.label}
        </Link>
      ))}
      <div className="w-px h-6 bg-gray-300 mx-2" />
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <User className="h-4 w-4" />
        <span>{username}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        className="text-red-600 hover:text-red-700"
      >
        <LogOut className="h-4 w-4 mr-1" />
        退出
      </Button>
    </nav>
  );
}
