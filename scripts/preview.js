/**
 * preview.js —— 通过 miniprogram-ci 生成真机预览二维码（可选，需要密钥）
 *
 * 前置条件：
 * 1. 微信公众平台 → 开发管理 → 开发设置 → 小程序代码上传密钥，下载私钥文件；
 * 2. 将私钥放到仓库外（严禁入库），并把 IP 白名单关闭或加入本机 IP；
 * 3. 设置环境变量：
 *    MP_APP_ID=你的appid
 *    MP_PRIVATE_KEY_PATH=/绝对路径/private.key
 *
 * 用法：npm run preview:mp
 */
const path = require('path');
const fs = require('fs');

const appId = process.env.MP_APP_ID;
const keyPath = process.env.MP_PRIVATE_KEY_PATH;

if (!appId || !keyPath || !fs.existsSync(keyPath)) {
  console.error('缺少 MP_APP_ID 或 MP_PRIVATE_KEY_PATH（私钥文件须存在于仓库外）');
  console.error('配置方法见 README「CI 与真机预览」一节。');
  process.exit(1);
}

// 延迟加载，未配置密钥时不阻塞 CI
const ci = require('miniprogram-ci');

const project = new ci.Project({
  appid: appId,
  type: 'miniProgram',
  projectPath: path.resolve(__dirname, '..'),
  privateKeyPath: keyPath,
  ignores: ['node_modules/**/*', 'tests/**/*', 'docs/**/*', 'scripts/**/*'],
});

ci.preview({
  project,
  desc: 'MVP 预览',
  setting: { es6: true, minified: true },
  qrcodeFormat: 'image',
  qrcodeOutputDest: path.resolve(__dirname, '..', 'preview-qr.jpg'),
  onProgressUpdate: console.log,
})
  .then(() => console.log('预览二维码已生成：preview-qr.jpg'))
  .catch((e) => {
    console.error('预览失败：', e.message);
    process.exit(1);
  });
