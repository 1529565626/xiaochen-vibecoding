import QRCode from 'qrcode';

async function generateQrSvg(url, options = {}) {
  const opts = {
    type: 'svg',
    width: options.width || 200,
    color: {
      dark: options.color || '#000000',
      light: options.bgColor || '#FFFFFF'
    },
    margin: 2
  };
  return QRCode.toString(url, opts);
}

export { generateQrSvg };
