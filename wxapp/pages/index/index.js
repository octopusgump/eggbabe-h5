const { BACKGROUNDS } = require("../../config/backgrounds");
const { PETS } = require("../../config/pets");
const { PetStage } = require("../../engine/petStage");
const { exportWallpaper } = require("../../engine/wallpaperExporter");

Page({
  data: {
    safeTop: 44,
    capsuleRightPad: 104,
    petId: "koi",
    drawerTitle: PETS.koi.drawerTitle,
    backgrounds: BACKGROUNDS,
    currentBg: BACKGROUNDS[0],
    items: [],
    shadow: { softS: 1, softO: 1, conS: 1, conO: 1 },
    sleeping: false,
    loadingPet: true,
    exporting: false
  },

  onLoad() {
    this.wornByPet = {
      koi: { set: null },
      yutu: { head: null, neck: null }
    };
    this.stageRect = { left: 0, top: 0, width: 390, height: 844 };
    this.touchState = { active: false, startX: 0, startY: 0, moved: false, startTime: 0 };

    // 适配刘海屏状态栏与右上角胶囊按钮安全区
    try {
      const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
      const safeTop = menu ? Math.max(menu.top, win.statusBarHeight || 20) : (win.statusBarHeight || 24) + 8;
      const capsuleRightPad = menu ? Math.max(96, win.windowWidth - menu.left + 8) : 100;
      this.setData({ safeTop, capsuleRightPad });
    } catch (e) {
      // fallback to defaults
    }

    this._syncDrawerItems();
  },

  onReady() {
    this._initStage();
  },

  onUnload() {
    if (this.stage) {
      this.stage.destroy();
      this.stage = null;
    }
  },

  _initStage() {
    const query = wx.createSelectorQuery();
    query.select("#stage-box").boundingClientRect();
    query.select("#pet-gl").node();
    query.select("#export-canvas").node();
    query.exec((res) => {
      if (!res || !res[1] || !res[1].node) {
        wx.showToast({ title: "画布初始化失败", icon: "none" });
        return;
      }
      if (res[0]) this.stageRect = res[0];
      const glCanvas = res[1].node;
      this.exportCanvas = res[2] ? res[2].node : null;
      const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      try {
        this.stage = new PetStage(glCanvas, {
          dpr: win.pixelRatio || 2,
          onShadowUpdate: (shadow) => this.setData({ shadow }),
          onSleepChange: (sleeping) => this.setData({ sleeping }),
          onReady: () => this.setData({ loadingPet: false })
        });
        this.stage.setPet(PETS[this.data.petId], this.wornByPet[this.data.petId]);
      } catch (err) {
        console.error(err);
        this.setData({ loadingPet: false });
        wx.showToast({ title: "当前设备不支持 WebGL", icon: "none" });
      }
    });
  },

  _syncDrawerItems() {
    const pet = PETS[this.data.petId];
    const worn = this.wornByPet[this.data.petId];
    const items = pet.items.map((it) => ({
      id: it.id,
      slot: it.slot,
      name: it.name,
      thumbUrl: it.thumbUrl,
      selected: pet.mode === "sets" ? worn.set === it.id : worn[it.slot] === it.id
    }));
    this.setData({
      drawerTitle: pet.drawerTitle,
      items
    });
  },

  onSwitchPet(e) {
    const nextPet = e.currentTarget.dataset.pet;
    if (!nextPet || nextPet === this.data.petId || !PETS[nextPet]) return;
    this.setData({ petId: nextPet, loadingPet: true, sleeping: false });
    this._syncDrawerItems();
    if (this.stage) {
      this.stage.setPet(PETS[nextPet], this.wornByPet[nextPet]);
    }
  },

  onSelectBg(e) {
    const id = e.currentTarget.dataset.id;
    const found = BACKGROUNDS.find((b) => b.id === id);
    if (!found || found.id === this.data.currentBg.id) return;
    this.setData({ currentBg: found });
  },

  onTapItem(e) {
    const id = e.currentTarget.dataset.id;
    const pet = PETS[this.data.petId];
    const worn = this.wornByPet[this.data.petId];
    const it = pet.items.find((x) => x.id === id);
    if (!it) return;

    let triggerHop = false;
    if (pet.mode === "sets") {
      if (worn.set === id) {
        worn.set = null;
      } else {
        worn.set = id;
        triggerHop = true;
      }
    } else {
      if (worn[it.slot] === id) {
        worn[it.slot] = null;
      } else {
        worn[it.slot] = id;
        triggerHop = true;
      }
    }
    this._syncDrawerItems();
    if (this.stage) {
      this.stage.setWorn(worn, triggerHop);
    }
    if (wx.vibrateShort) {
      wx.vibrateShort({ type: "light" });
    }
  },

  _toStageCoord(touch) {
    const r = this.stageRect;
    const x = ((touch.clientX - r.left) / (r.width || 390)) * 390;
    const y = ((touch.clientY - r.top) / (r.height || 844)) * 844;
    return { x, y };
  },

  onStageTouchStart(e) {
    const t = e.touches && e.touches[0];
    if (!t) return;
    const pt = this._toStageCoord(t);
    this.touchState = {
      active: true,
      startX: pt.x,
      startY: pt.y,
      moved: false,
      startTime: Date.now()
    };
  },

  onStageTouchMove(e) {
    if (!this.touchState.active) return;
    const t = e.touches && e.touches[0];
    if (!t) return;
    const pt = this._toStageCoord(t);
    const dist = Math.hypot(pt.x - this.touchState.startX, pt.y - this.touchState.startY);
    if (dist > 8) {
      this.touchState.moved = true;
      if (this.stage) this.stage.onPetMove(pt.x);
    }
  },

  onStageTouchEnd() {
    if (!this.touchState.active) return;
    this.touchState.active = false;
    if (this.touchState.moved) {
      if (this.stage) this.stage.onPetEnd();
    } else if (Date.now() - this.touchState.startTime < 450) {
      if (this.stage) this.stage.onTap(this.touchState.startX, this.touchState.startY);
    }
  },

  async onSaveWallpaper() {
    if (this.data.exporting) return;
    if (!this.exportCanvas) {
      wx.showToast({ title: "导出画布未就绪", icon: "none" });
      return;
    }
    this.setData({ exporting: true });
    wx.showLoading({ title: "生成高清壁纸...", mask: true });
    try {
      await exportWallpaper({
        canvas: this.exportCanvas,
        bg: this.data.currentBg,
        pet: PETS[this.data.petId],
        worn: this.wornByPet[this.data.petId]
      });
      wx.hideLoading();
      wx.showToast({ title: "已保存到相册", icon: "success" });
    } catch (err) {
      wx.hideLoading();
      console.error("[exportWallpaper]", err);
      const msg = (err && err.errMsg) || "";
      if (msg.indexOf("auth deny") >= 0 || msg.indexOf("authorize") >= 0) {
        wx.showModal({
          title: "需要相册权限",
          content: "请在设置中允许保存到相册，即可一键保存高清萌宠壁纸。",
          confirmText: "去设置",
          success: (r) => {
            if (r.confirm) wx.openSetting();
          }
        });
      } else {
        wx.showToast({ title: "保存失败，请检查网络", icon: "none" });
      }
    } finally {
      this.setData({ exporting: false });
    }
  },

  onShareAppMessage() {
    const pet = PETS[this.data.petId];
    return {
      title: `快来给我的${pet.label}蛋宝宝换新装、换场景！`,
      path: "/pages/index/index",
      imageUrl: this.data.currentBg.url
    };
  },

  onShareTimeline() {
    const pet = PETS[this.data.petId];
    return {
      title: `蛋宝宝装扮屋 · ${pet.label}新造型`,
      imageUrl: this.data.currentBg.url
    };
  }
});
