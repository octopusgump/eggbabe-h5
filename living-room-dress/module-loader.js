/* ==========================================================================
   EggBabe 分布式按需模块加载器 & 全站图片防裂图护栏 (module-loader.js)
   - Tier 0 首屏仅加载核心运行时，Tier 1 空闲预热，Tier 2 点击按需拉取
   - 统一全站 <img> 规则：未完全加载解码前严禁露出裂图图标或 alt 占位文字
   - 零构建依赖，100% 兼容 H5 / GitHub Pages / 微信小程序 WebView
   ========================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.EggBabeLoader = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this), function () {
  "use strict";

  const FEATURES = Object.freeze({
    settings: Object.freeze({
      styles: ["./living-room-dress/settings-panel.css"],
      scripts: ["./living-room-dress/settings-panel.js"],
      readyCheck: () => typeof globalThis !== "undefined" && !!globalThis.EggBabeSettingsPanel
    }),
    holo: Object.freeze({
      styles: ["./living-room-dress/holo-card-showcase.css"],
      scripts: [
        "./living-room-dress/holo-pack/holo-pack-config.js",
        "./living-room-dress/holo-card-showcase.js"
      ],
      readyCheck: () => typeof globalThis !== "undefined"
        && !!globalThis.EggBabeHoloConfig
        && !!globalThis.EggBabeHoloCardShowcase
    }),
    diary: Object.freeze({
      styles: [],
      scripts: ["./living-room-dress/diary-engine.js"],
      readyCheck: () => typeof globalThis !== "undefined" && !!globalThis.EggBabeDiaryEngine
    }),
    rooms: Object.freeze({
      styles: [],
      scripts: [
        "./living-room-dress/p5-rooms-and-games.js",
        "./living-room-dress/native-minigames-ui.js"
      ],
      readyCheck: () => typeof globalThis !== "undefined"
        && !!globalThis.EggBabeP5Data
        && !!globalThis.EggBabeNativeMinigames
    })
  });

  const scriptPromises = new Map();
  const stylePromises = new Map();
  const featurePromises = new Map();

  function loadScript(url, doc) {
    const targetDoc = doc || (typeof document !== "undefined" ? document : null);
    if (!url) return Promise.reject(new Error("Missing script URL"));
    if (scriptPromises.has(url)) return scriptPromises.get(url);
    if (!targetDoc) return Promise.resolve();

    const existing = targetDoc.querySelector && targetDoc.querySelector(`script[src="${url}"]`);
    if (existing && existing.dataset && existing.dataset.ebLoaded === "true") {
      const done = Promise.resolve();
      scriptPromises.set(url, done);
      return done;
    }

    const p = new Promise((resolve, reject) => {
      const el = targetDoc.createElement("script");
      el.src = url;
      el.async = false;
      el.onload = () => {
        if (el.dataset) el.dataset.ebLoaded = "true";
        resolve();
      };
      el.onerror = () => {
        scriptPromises.delete(url);
        if (el.parentNode) el.parentNode.removeChild(el);
        reject(new Error(`Failed to load script: ${url}`));
      };
      (targetDoc.body || targetDoc.head || targetDoc.documentElement).appendChild(el);
    });
    scriptPromises.set(url, p);
    return p;
  }

  function loadStyle(href, doc) {
    const targetDoc = doc || (typeof document !== "undefined" ? document : null);
    if (!href) return Promise.reject(new Error("Missing style URL"));
    if (stylePromises.has(href)) return stylePromises.get(href);
    if (!targetDoc) return Promise.resolve();

    const existing = targetDoc.querySelector && targetDoc.querySelector(`link[rel="stylesheet"][href="${href}"]`);
    if (existing) {
      const done = Promise.resolve();
      stylePromises.set(href, done);
      return done;
    }

    const p = new Promise((resolve, reject) => {
      const el = targetDoc.createElement("link");
      el.rel = "stylesheet";
      el.href = href;
      el.onload = () => resolve();
      el.onerror = () => {
        stylePromises.delete(href);
        if (el.parentNode) el.parentNode.removeChild(el);
        reject(new Error(`Failed to load stylesheet: ${href}`));
      };
      (targetDoc.head || targetDoc.documentElement).appendChild(el);
    });
    stylePromises.set(href, p);
    return p;
  }

  function loadFeature(name, opts) {
    const def = FEATURES[name];
    if (!def) return Promise.reject(new Error(`Unknown feature: ${name}`));
    if (typeof def.readyCheck === "function" && def.readyCheck()) {
      return Promise.resolve(true);
    }
    if (featurePromises.has(name)) return featurePromises.get(name);

    const doc = opts && opts.doc;
    const styleTasks = (def.styles || []).map((href) => loadStyle(href, doc));
    const scriptTask = (def.scripts || []).reduce(
      (chain, src) => chain.then(() => loadScript(src, doc)),
      Promise.resolve()
    );

    const p = Promise.all([...styleTasks, scriptTask])
      .then(() => true)
      .catch((err) => {
        featurePromises.delete(name);
        throw err;
      });
    featurePromises.set(name, p);
    return p;
  }

  function scheduleIdle(fn, timeoutMs) {
    const delay = typeof timeoutMs === "number" ? timeoutMs : 1200;
    if (typeof fn !== "function") return;
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(() => fn(), { timeout: delay });
    } else {
      setTimeout(fn, Math.min(delay, 900));
    }
  }

  function loadImageReady(url) {
    if (!url || typeof Image === "undefined") return Promise.resolve(false);
    return new Promise((resolve) => {
      const probe = new Image();
      const finish = (ok) => resolve(!!ok && probe.naturalWidth > 0);
      probe.onload = () => {
        if (typeof probe.decode === "function") {
          probe.decode().then(() => finish(true)).catch(() => finish(true));
        } else {
          finish(true);
        }
      };
      probe.onerror = () => resolve(false);
      probe.src = url;
      if (probe.complete && probe.naturalWidth > 0) {
        finish(true);
      }
    });
  }

  function hydrateImgState(img) {
    if (!img || img.tagName !== "IMG") return;
    if (img.dataset && img.dataset.ebImgIgnore === "true") return;
    const rawSrc = img.getAttribute("src");
    if (!rawSrc) {
      img.dataset.ebImg = "loading";
      return;
    }
    if (img.complete && img.naturalWidth > 0) {
      img.dataset.ebImg = "ready";
    } else {
      img.dataset.ebImg = "loading";
    }
  }

  function installGlobalImageGuard(rootEl) {
    if (typeof document === "undefined") return null;
    const target = rootEl || document.body || document.documentElement;
    if (!target) return null;

    const scan = (node) => {
      if (!node || node.nodeType !== 1) return;
      if (node.tagName === "IMG") {
        hydrateImgState(node);
      } else if (typeof node.querySelectorAll === "function") {
        node.querySelectorAll("img").forEach(hydrateImgState);
      }
    };

    scan(target);

    const onLoad = (ev) => {
      const el = ev && ev.target;
      if (!el || el.tagName !== "IMG") return;
      if (el.dataset && el.dataset.ebImgIgnore === "true") return;
      if (el.naturalWidth > 0) {
        el.dataset.ebImg = "ready";
      } else {
        el.dataset.ebImg = "error";
      }
    };

    const onError = (ev) => {
      const el = ev && ev.target;
      if (!el || el.tagName !== "IMG") return;
      if (el.dataset && el.dataset.ebImgIgnore === "true") return;
      el.dataset.ebImg = "error";
    };

    target.addEventListener("load", onLoad, true);
    target.addEventListener("error", onError, true);

    let observer = null;
    if (typeof MutationObserver === "function") {
      observer = new MutationObserver((mutations) => {
        for (let i = 0; i < mutations.length; i++) {
          const m = mutations[i];
          if (m.type === "attributes" && m.attributeName === "src" && m.target && m.target.tagName === "IMG") {
            hydrateImgState(m.target);
          } else if (m.type === "childList" && m.addedNodes && m.addedNodes.length) {
            m.addedNodes.forEach(scan);
          }
        }
      });
      observer.observe(target, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["src"]
      });
    }

    return {
      destroy() {
        target.removeEventListener("load", onLoad, true);
        target.removeEventListener("error", onError, true);
        if (observer) observer.disconnect();
      }
    };
  }

  function resetCachesForTest() {
    scriptPromises.clear();
    stylePromises.clear();
    featurePromises.clear();
  }

  return {
    FEATURES,
    loadScript,
    loadStyle,
    loadFeature,
    scheduleIdle,
    loadImageReady,
    hydrateImgState,
    installGlobalImageGuard,
    resetCachesForTest
  };
});
