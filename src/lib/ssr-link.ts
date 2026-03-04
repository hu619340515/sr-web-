import { User } from '@/types';

/**
 * 生成SSR链接
 * 格式: ssr://base64(server:port:protocol:method:obfs:password_base64/?params_base64)
 */
export function generateSSRLink(user: User, server: string, port?: number): string {
  const serverPort = port || user.port;
  const serverAddress = `${server}:${serverPort}`;

  // 构建参数对象
  const params: Record<string, string> = {
    obfsparam: user.obfsParam || '',
    protoparam: user.protocolParam || '',
    remarks: user.username,
    group: 'SSR',
    protocol: user.protocol,
    obfs: user.obfs,
  };

  // 构建SSR信息部分
  // 格式: server:port:protocol:method:obfs:password_base64
  const passwordBase64 = Buffer.from(user.password).toString('base64');
  const ssrInfo = `${serverAddress}:${user.protocol}:${user.method}:${user.obfs}:${passwordBase64}`;

  // 将参数转换为查询字符串
  const queryString = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  // 组合完整信息
  const fullInfo = `${ssrInfo}/?${queryString}`;

  // Base64编码
  const base64Encoded = Buffer.from(fullInfo).toString('base64');

  return `ssr://${base64Encoded}`;
}

/**
 * 解析SSR链接
 */
export function parseSSRLink(ssrLink: string): {
  server: string;
  port: number;
  protocol: string;
  method: string;
  obfs: string;
  password: string;
  params: Record<string, string>;
} | null {
  try {
    // 移除 ssr:// 前缀
    const base64Part = ssrLink.replace('ssr://', '');

    // Base64解码
    const decoded = Buffer.from(base64Part, 'base64').toString('utf-8');

    // 分离信息部分和参数部分
    const [infoPart, paramsPart] = decoded.split('/?');

    if (!infoPart) return null;

    // 解析信息部分: server:port:protocol:method:obfs:password_base64
    const parts = infoPart.split(':');
    if (parts.length < 6) return null;

    const [serverPort, protocol, method, obfs, passwordBase64] = parts;
    const [server, port] = serverPort.split(':');

    // 解析密码
    const password = Buffer.from(passwordBase64, 'base64').toString('utf-8');

    // 解析参数
    const params: Record<string, string> = {};
    if (paramsPart) {
      paramsPart.split('&').forEach(param => {
        const [key, value] = param.split('=');
        if (key && value !== undefined) {
          params[key] = decodeURIComponent(value);
        }
      });
    }

    return {
      server,
      port: parseInt(port),
      protocol,
      method,
      obfs,
      password,
      params,
    };
  } catch (error) {
    console.error('解析SSR链接失败:', error);
    return null;
  }
}

/**
 * 复制SSR链接到剪贴板
 */
export async function copySSRLink(ssrLink: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(ssrLink);
    return true;
  } catch (error) {
    console.error('复制失败:', error);
    return false;
  }
}

/**
 * 生成二维码内容（返回SSR链接）
 * 如果需要生成二维码图片，可以使用第三方库如 qrcode
 */
export function generateQRCodeContent(ssrLink: string): string {
  return ssrLink;
}
