/**
 * share.js —— 吐槽码编解码（无后端的板数据完整转移）
 * 格式：RTB1.<base64url(json)>.<checksum4>
 * checksum：FNV-1a 32 位 hex 前 4 位，防剪贴板截断/手改导致的静默坏数据。
 */

const PREFIX = 'RTB1';
const SUPPORTED_SCHEMA_VERSIONS = [1];

// —— base64url（纯 JS 实现，不依赖运行时 btoa/atob）——
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function utf8Encode(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = (code - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000;
        i++;
      }
    }
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return bytes;
}

function utf8Decode(bytes) {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    let code;
    if (b < 0x80) {
      code = b;
      i += 1;
    } else if (b < 0xe0) {
      code = ((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f);
      i += 2;
    } else if (b < 0xf0) {
      code = ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f);
      i += 3;
    } else {
      code =
        ((b & 0x07) << 18) |
        ((bytes[i + 1] & 0x3f) << 12) |
        ((bytes[i + 2] & 0x3f) << 6) |
        (bytes[i + 3] & 0x3f);
      i += 4;
    }
    if (code >= 0x10000) {
      code -= 0x10000;
      out += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
    } else {
      out += String.fromCharCode(code);
    }
  }
  return out;
}

function bytesToBase64url(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64_CHARS[b0 >> 2];
    out += B64_CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    if (i + 1 < bytes.length) out += B64_CHARS[((b1 & 15) << 2) | (b2 >> 6)];
    if (i + 2 < bytes.length) out += B64_CHARS[b2 & 63];
  }
  return out;
}

function base64urlToBytes(str) {
  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < str.length; i++) {
    const idx = B64_CHARS.indexOf(str[i]);
    if (idx === -1) throw new Error('含非 base64 字符：' + str[i]);
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return bytes;
}

function fnv1a(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash >>> 0;
}

/**
 * 编码板为吐槽码
 * @param {object} board 已 validateBoard 的板
 * @returns {string}
 */
function encodeBoard(board) {
  const json = JSON.stringify({ t: 'board', v: board.schemaVersion || 1, b: board });
  const payload = bytesToBase64url(utf8Encode(json));
  const checksum = fnv1a(payload).toString(16).slice(0, 4);
  return PREFIX + '.' + payload + '.' + checksum;
}

/**
 * 解析吐槽码（只负责解出对象，结构校验交给 validateBoard）
 * @returns {{ ok: boolean, error?: string, board?: object }}
 */
function decodeBoard(code) {
  if (typeof code !== 'string') return { ok: false, error: '吐槽码为空' };
  const cleaned = code.trim().replace(/\s+/g, '');
  if (!cleaned) return { ok: false, error: '吐槽码为空' };
  const parts = cleaned.split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) {
    return { ok: false, error: '不是有效的吐槽码（应以 RTB1. 开头）' };
  }
  const payload = parts[1];
  const checksum = fnv1a(payload).toString(16).slice(0, 4);
  if (parts[2].toLowerCase() !== checksum) {
    return { ok: false, error: '吐槽码不完整或被修改（校验失败），请重新复制' };
  }
  let json;
  try {
    json = utf8Decode(base64urlToBytes(payload));
  } catch (e) {
    return { ok: false, error: '吐槽码内容损坏，无法解析' };
  }
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return { ok: false, error: '吐槽码内容损坏，无法解析' };
  }
  if (!parsed || parsed.t !== 'board') {
    return { ok: false, error: '这不是一块吐槽板' };
  }
  if (SUPPORTED_SCHEMA_VERSIONS.indexOf(parsed.v) === -1) {
    return { ok: false, error: '吐槽码版本过新（v' + parsed.v + '），请先把小程序更新到最新版' };
  }
  return { ok: true, board: parsed.b };
}

module.exports = {
  PREFIX,
  SUPPORTED_SCHEMA_VERSIONS,
  encodeBoard,
  decodeBoard,
  utf8Encode,
  utf8Decode,
  bytesToBase64url,
  base64urlToBytes,
  fnv1a,
};
