import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";

export const metadata: Metadata = {
  title: "SSR代理管理系统",
  description: "多用户SSR代理服务端管理系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased">
        <AuthProvider>
          <div className="min-h-screen w-full">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
