"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 登录页面不需要认证
    if (pathname === "/login") {
      return;
    }

    // 检查是否已登录
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (isAuthenticated !== "true") {
      router.push("/login");
    }
  }, [router, pathname]);

  return <>{children}</>;
}
