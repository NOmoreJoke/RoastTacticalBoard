/**
 * check-package.js —— 小程序包结构校验（CI 无密钥也能跑）
 * 校验：app.json 每个页面四件套齐全、必需根文件存在、project.config.json 合法、
 *       utils 纯逻辑模块可在 Node 下加载。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MP = path.join(ROOT, 'miniprogram');

let failed = false;
function check(cond, msg) {
  if (cond) {
    console.log('  ✓ ' + msg);
  } else {
    failed = true;
    console.error('  ✗ ' + msg);
  }
}

console.log('校验小程序包结构...');

// 根文件
['miniprogram/app.js', 'miniprogram/app.json', 'miniprogram/app.wxss', 'miniprogram/sitemap.json', 'project.config.json'].forEach((f) => {
  check(fs.existsSync(path.join(ROOT, f)), f + ' 存在');
});

// project.config.json
const proj = JSON.parse(fs.readFileSync(path.join(ROOT, 'project.config.json'), 'utf8'));
check(proj.miniprogramRoot === 'miniprogram/', 'project.config.json 声明 miniprogramRoot');
check(typeof proj.appid === 'string' && proj.appid.length > 0, 'appid 已声明（当前为占位/游客 id 也可）');
check(proj.compileType === 'miniprogram', 'compileType 为 miniprogram');

// 页面四件套
const appJson = JSON.parse(fs.readFileSync(path.join(MP, 'app.json'), 'utf8'));
check(Array.isArray(appJson.pages) && appJson.pages.length >= 5, 'app.json 注册页面数 >= 5');
appJson.pages.forEach((p) => {
  ['js', 'wxml', 'wxss', 'json'].forEach((ext) => {
    const f = path.join(MP, p + '.' + ext);
    check(fs.existsSync(f), `页面 ${p}.${ext} 存在`);
  });
});

// utils 模块静态清单：逐一确认存在且可加载（新增模块时同步维护此清单）
const UTIL_MODULES = {
  'avatar.js': () => require('../miniprogram/utils/avatar'),
  'board.js': () => require('../miniprogram/utils/board'),
  'courts.js': () => require('../miniprogram/utils/courts'),
  'format.js': () => require('../miniprogram/utils/format'),
  'renderer.js': () => require('../miniprogram/utils/renderer'),
  'safety.js': () => require('../miniprogram/utils/safety'),
  'share.js': () => require('../miniprogram/utils/share'),
  'storage.js': () => require('../miniprogram/utils/storage'),
  'tags.js': () => require('../miniprogram/utils/tags'),
};
Object.keys(UTIL_MODULES).forEach((f) => {
  const full = path.join(utilsDirSafe(), f);
  if (!fs.existsSync(full)) {
    check(false, 'utils/' + f + ' 存在');
    return;
  }
  try {
    UTIL_MODULES[f]();
    check(true, 'utils/' + f + ' 可加载');
  } catch (e) {
    check(false, 'utils/' + f + ' 加载失败: ' + e.message);
  }
});

function utilsDirSafe() {
  return path.join(MP, 'utils');
}

if (failed) {
  console.error('\n包结构校验未通过');
  process.exit(1);
}
console.log('\n包结构校验通过 ✓');
