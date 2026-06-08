import { networkInterfaces } from 'node:os';

function getLanIP() {
  const interfaces = networkInterfaces();
  for (const [name, nets] of Object.entries(interfaces)) {
    if (!nets) continue;
    for (const net of nets) {
      if (net.family === 'IPv4' && !net.internal) {
        // 优先取 192.168.x.x，其次取 10.x.x.x，最后取 172.16-31.x.x
        if (net.address.startsWith('192.168.')) {
          return net.address;
        }
      }
    }
  }
  // 第二轮：取其他非内部地址
  for (const [, nets] of Object.entries(interfaces)) {
    if (!nets) continue;
    for (const net of nets) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

export { getLanIP };
