/**
 * 静态资源 CDN 根地址。
 * - 开发调试阶段：默认直接指向本项目 GitHub Pages（在微信开发者工具中勾选「不校验合法域名」即可立即可用）。
 * - 正式提审上线前：请将仓库内 `assets/` 目录上传至自己的已备案 HTTPS 对象存储（腾讯云 COS / 阿里云 OSS / 微信云托管），
 *   在微信公众平台「开发管理 -> 开发设置 -> 服务器域名」中将域名加入 `downloadFile` 合法域名，并替换下方 CDN_BASE。
 */
const CDN_BASE = "https://octopusgump.github.io/eggbabe-h5";

function assetUrl(relPath) {
  const clean = String(relPath || "").replace(/^\/+/, "");
  return `${CDN_BASE}/${clean}`;
}

module.exports = {
  CDN_BASE,
  assetUrl
};
