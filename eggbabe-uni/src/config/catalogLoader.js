import fallbackCatalog from "../../../assets/shared/catalog.json";

/**
 * 静态资源与热更新配置根地址：
 * - 日常小版本迭代（加新套装/新背景/改文案）：只需更新仓库 `assets/shared/catalog.json` 并推送，
 *   H5 与已上线的微信小程序会在下次打开时自动拉取最新配置，无需重新提交微信审核。
 * - 正式上线微信小程序前：将仓库 `assets/` 上传至自己的已备案 COS/OSS，并替换下方 CDN_BASE。
 */
const DEFAULT_CDN_BASE = "https://octopusgump.github.io/eggbabe-h5";
const RAW_CDN_BASE =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_CDN_BASE) ||
  DEFAULT_CDN_BASE;
export const CDN_BASE = String(RAW_CDN_BASE).replace(/\/+$/, "");

export function assetUrl(relPath) {
  if (!relPath) return "";
  if (/^https?:\/\//i.test(relPath)) return relPath;
  return `${CDN_BASE}/${String(relPath).replace(/^\/+/, "")}`;
}

export function hydrateCatalog(raw) {
  const src = raw && raw.backgrounds && raw.pets ? raw : fallbackCatalog;
  const backgrounds = src.backgrounds.map((bg) => ({
    ...bg,
    url: assetUrl(bg.file)
  }));
  const pets = {};
  Object.keys(src.pets).forEach((k) => {
    const p = src.pets[k];
    pets[k] = {
      ...p,
      textures: {
        base: assetUrl(p.textures.base),
        closed: assetUrl(p.textures.closed),
        doze: assetUrl(p.textures.doze)
      },
      items: p.items.map((it) => ({
        ...it,
        texUrl: assetUrl(it.tex),
        closedTexUrl: it.closedTex ? assetUrl(it.closedTex) : "",
        dozeTexUrl: it.dozeTex ? assetUrl(it.dozeTex) : "",
        thumbUrl: assetUrl(it.thumb)
      }))
    };
  });
  return {
    version: src.version || "1.0.0",
    updatedAt: src.updatedAt || "",
    backgrounds,
    pets
  };
}

export function getDefaultCatalog() {
  return hydrateCatalog(fallbackCatalog);
}

/**
 * 拉取线上最新 catalog.json 实现内容热更新；失败时静默回退到本地快照。
 */
export function fetchRemoteCatalog() {
  return new Promise((resolve) => {
    const url = `${assetUrl("assets/shared/catalog.json")}?t=${Date.now()}`;
    uni.request({
      url,
      method: "GET",
      timeout: 4500,
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.backgrounds && res.data.pets) {
          resolve(hydrateCatalog(res.data));
        } else {
          resolve(null);
        }
      },
      fail: () => resolve(null)
    });
  });
}
