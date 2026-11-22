<template>
  <view class="viewport">
    <view class="page" :style="{ background: currentBg.stageBg }">
      <!-- 1. 全屏背景图 -->
      <image class="stage-bg" :src="currentBg.url" mode="aspectFill" />

      <!-- 2. 顶部安全区：宠物切换 + 存壁纸/分享 + 11 套背景滑条 -->
      <view class="top-bar" :style="{ paddingTop: safeTop + 'px' }">
        <view class="top-row" :style="{ paddingRight: capsuleRightPad + 'px' }">
          <view class="pet-switch">
            <button
              class="pet-pill"
              :class="{ active: petId === 'koi' }"
              @tap="onSwitchPet('koi')"
            >锦鲤</button>
            <button
              class="pet-pill"
              :class="{ active: petId === 'yutu' }"
              @tap="onSwitchPet('yutu')"
            >玉兔</button>
          </view>
          <view class="action-group">
            <button class="act-btn" :loading="exporting" :disabled="exporting" @tap="onSaveWallpaper">存壁纸</button>
            <!-- #ifdef MP-WEIXIN -->
            <button class="act-btn share-btn" open-type="share">分享</button>
            <!-- #endif -->
          </view>
        </view>

        <scroll-view class="bg-strip" scroll-x="true" enable-flex="true" show-scrollbar="false">
          <view class="bg-strip-inner">
            <view
              v-for="bg in backgrounds"
              :key="bg.id"
              class="bg-chip"
              :class="{ active: currentBg.id === bg.id }"
              @tap="onSelectBg(bg)"
            >
              <image class="bg-thumb" :src="bg.url" mode="aspectFill" lazy-load="true" />
              <text class="bg-label">{{ bg.name }}</text>
            </view>
          </view>
        </scroll-view>
      </view>

      <!-- 3. 宠物互动舞台 -->
      <view
        id="stage-box"
        class="stage-box"
        @touchstart="onStageTouchStart"
        @touchmove="onStageTouchMove"
        @touchend="onStageTouchEnd"
        @touchcancel="onStageTouchEnd"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
      >
        <view
          class="shadow-soft"
          :style="{
            background: currentBg.shadowSoft,
            transform: 'translate(-50%,-50%) scale(' + shadow.softS + ')',
            opacity: shadow.softO
          }"
        ></view>
        <view
          class="shadow-contact"
          :style="{
            background: currentBg.shadowContact,
            transform: 'translate(-50%,-50%) scale(' + shadow.conS + ')',
            opacity: shadow.conO
          }"
        ></view>

        <!-- #ifdef H5 -->
        <canvas ref="h5CanvasRef" id="pet-gl-h5" class="pet-gl"></canvas>
        <!-- #endif -->
        <!-- #ifndef H5 -->
        <canvas type="webgl" id="pet-gl" class="pet-gl"></canvas>
        <!-- #endif -->

        <view v-if="sleeping" class="sleep-zz">Zzz</view>
        <view v-if="loadingPet" class="stage-loading">加载宠物中...</view>
      </view>

      <!-- 4. 底部衣橱抽屉 -->
      <view class="sheet">
        <view class="sheet-handle"></view>
        <view class="sheet-header">
          <text class="sheet-title">{{ currentPet.drawerTitle }}</text>
          <text class="sheet-tip">点宠物跳一跳 · 按住摸摸头</text>
        </view>
        <scroll-view class="grid-scroll" scroll-y="true" show-scrollbar="false">
          <view class="card-grid">
            <view
              v-for="item in drawerItems"
              :key="item.id"
              class="card"
              :class="{ selected: item.selected }"
              @tap="onTapItem(item)"
            >
              <view class="thumb-wrap">
                <image class="card-img" :src="item.thumbUrl" mode="aspectFit" lazy-load="true" />
              </view>
              <text class="card-name">{{ item.name }}</text>
              <view v-if="item.selected" class="card-badge">✓</view>
            </view>
          </view>
        </scroll-view>
      </view>

      <!-- #ifndef H5 -->
      <canvas type="2d" id="export-canvas" class="export-canvas"></canvas>
      <!-- #endif -->
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from "vue";
import { onShareAppMessage, onShareTimeline } from "@dcloudio/uni-app";
import { getDefaultCatalog, fetchRemoteCatalog } from "../../config/catalogLoader";
import { PetStage } from "../../engine/petStage";
import { exportWallpaper } from "../../engine/wallpaperExporter";

const initial = getDefaultCatalog();
const catalog = reactive({
  version: initial.version,
  backgrounds: initial.backgrounds,
  pets: initial.pets
});

const safeTop = ref(16);
const capsuleRightPad = ref(12);
const petId = ref("koi");
const currentBgId = ref(initial.backgrounds[0].id);
const loadingPet = ref(true);
const sleeping = ref(false);
const exporting = ref(false);
const shadow = reactive({ softS: 1, softO: 1, conS: 1, conO: 1 });
const h5CanvasRef = ref(null);

const wornByPet = reactive({
  koi: { set: null },
  yutu: { head: null, neck: null }
});

const backgrounds = computed(() => catalog.backgrounds);
const currentBg = computed(
  () => catalog.backgrounds.find((b) => b.id === currentBgId.value) || catalog.backgrounds[0]
);
const currentPet = computed(() => catalog.pets[petId.value] || catalog.pets.koi);
const drawerItems = computed(() => {
  const pet = currentPet.value;
  const worn = wornByPet[pet.id];
  return pet.items.map((it) => ({
    ...it,
    selected: pet.mode === "sets" ? worn.set === it.id : worn[it.slot] === it.id
  }));
});

let stage = null;
let exportCanvas = null;
let stageRect = { left: 0, top: 0, width: 390, height: 844 };
const touchState = { active: false, startX: 0, startY: 0, moved: false, startTime: 0 };

function updateSafeArea() {
  // #ifndef H5
  try {
    const win = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync();
    const menu = uni.getMenuButtonBoundingClientRect ? uni.getMenuButtonBoundingClientRect() : null;
    safeTop.value = menu ? Math.max(menu.top, win.statusBarHeight || 20) : (win.statusBarHeight || 24) + 8;
    capsuleRightPad.value = menu ? Math.max(96, win.windowWidth - menu.left + 8) : 100;
  } catch (e) {
    safeTop.value = 44;
    capsuleRightPad.value = 104;
  }
  // #endif
}

function initStage() {
  // #ifdef H5
  const el = document.getElementById("pet-gl-h5");
  const box = document.getElementById("stage-box");
  if (box) {
    const r = box.getBoundingClientRect();
    stageRect = { left: r.left, top: r.top, width: r.width, height: r.height };
  }
  if (!el) return;
  try {
    stage = new PetStage(el, {
      dpr: window.devicePixelRatio || 2,
      onShadowUpdate: (s) => Object.assign(shadow, s),
      onSleepChange: (v) => { sleeping.value = v; },
      onReady: () => { loadingPet.value = false; }
    });
    stage.setPet(currentPet.value, wornByPet[petId.value]);
  } catch (err) {
    console.error(err);
    loadingPet.value = false;
    uni.showToast({ title: "当前设备不支持 WebGL", icon: "none" });
  }
  // #endif

  // #ifndef H5
  const query = uni.createSelectorQuery();
  query.select("#stage-box").boundingClientRect();
  query.select("#pet-gl").node();
  query.select("#export-canvas").node();
  query.exec((res) => {
    if (!res || !res[1] || !res[1].node) {
      uni.showToast({ title: "画布初始化失败", icon: "none" });
      return;
    }
    if (res[0]) stageRect = res[0];
    const glCanvas = res[1].node;
    exportCanvas = res[2] ? res[2].node : null;
    const win = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync();
    try {
      stage = new PetStage(glCanvas, {
        dpr: win.pixelRatio || 2,
        onShadowUpdate: (s) => Object.assign(shadow, s),
        onSleepChange: (v) => { sleeping.value = v; },
        onReady: () => { loadingPet.value = false; }
      });
      stage.setPet(currentPet.value, wornByPet[petId.value]);
    } catch (err) {
      console.error(err);
      loadingPet.value = false;
      uni.showToast({ title: "当前设备不支持 WebGL", icon: "none" });
    }
  });
  // #endif
}

function refreshStageRectH5() {
  // #ifdef H5
  const box = document.getElementById("stage-box");
  if (box) {
    const r = box.getBoundingClientRect();
    stageRect = { left: r.left, top: r.top, width: r.width, height: r.height };
  }
  // #endif
}

onMounted(() => {
  updateSafeArea();
  setTimeout(initStage, 50);

  // 静默拉取线上 catalog.json，支持免审热更新背景与套装列表
  fetchRemoteCatalog().then((remote) => {
    if (!remote) return;
    catalog.version = remote.version;
    catalog.backgrounds = remote.backgrounds;
    catalog.pets = remote.pets;
  });

  // #ifdef H5
  window.addEventListener("resize", refreshStageRectH5);
  // #endif
});

onUnmounted(() => {
  if (stage) {
    stage.destroy();
    stage = null;
  }
  // #ifdef H5
  window.removeEventListener("resize", refreshStageRectH5);
  // #endif
});

function onSwitchPet(nextPet) {
  if (!nextPet || nextPet === petId.value || !catalog.pets[nextPet]) return;
  petId.value = nextPet;
  loadingPet.value = true;
  sleeping.value = false;
  if (stage) {
    stage.setPet(catalog.pets[nextPet], wornByPet[nextPet]);
  }
}

function onSelectBg(bg) {
  if (!bg || bg.id === currentBgId.value) return;
  currentBgId.value = bg.id;
}

function onTapItem(item) {
  const pet = currentPet.value;
  const worn = wornByPet[pet.id];
  let triggerHop = false;
  if (pet.mode === "sets") {
    if (worn.set === item.id) {
      worn.set = null;
    } else {
      worn.set = item.id;
      triggerHop = true;
    }
  } else {
    if (worn[item.slot] === item.id) {
      worn[item.slot] = null;
    } else {
      worn[item.slot] = item.id;
      triggerHop = true;
    }
  }
  if (stage) {
    stage.setWorn(worn, triggerHop);
  }
  // #ifndef H5
  if (uni.vibrateShort) uni.vibrateShort({ type: "light" });
  // #endif
}

function toStageCoord(clientX, clientY) {
  refreshStageRectH5();
  const r = stageRect;
  return {
    x: ((clientX - r.left) / (r.width || 390)) * 390,
    y: ((clientY - r.top) / (r.height || 844)) * 844
  };
}

function startPointer(clientX, clientY) {
  const pt = toStageCoord(clientX, clientY);
  touchState.active = true;
  touchState.startX = pt.x;
  touchState.startY = pt.y;
  touchState.moved = false;
  touchState.startTime = Date.now();
}

function movePointer(clientX, clientY) {
  if (!touchState.active) return;
  const pt = toStageCoord(clientX, clientY);
  if (Math.hypot(pt.x - touchState.startX, pt.y - touchState.startY) > 8) {
    touchState.moved = true;
    if (stage) stage.onPetMove(pt.x);
  }
}

function endPointer() {
  if (!touchState.active) return;
  touchState.active = false;
  if (touchState.moved) {
    if (stage) stage.onPetEnd();
  } else if (Date.now() - touchState.startTime < 450) {
    if (stage) stage.onTap(touchState.startX, touchState.startY);
  }
}

function onStageTouchStart(e) {
  const t = e.touches && e.touches[0];
  if (t) startPointer(t.clientX, t.clientY);
}
function onStageTouchMove(e) {
  const t = e.touches && e.touches[0];
  if (t) movePointer(t.clientX, t.clientY);
}
function onStageTouchEnd() {
  endPointer();
}
function onMouseDown(e) {
  // #ifdef H5
  startPointer(e.clientX, e.clientY);
  // #endif
}
function onMouseMove(e) {
  // #ifdef H5
  movePointer(e.clientX, e.clientY);
  // #endif
}
function onMouseUp() {
  // #ifdef H5
  endPointer();
  // #endif
}

async function onSaveWallpaper() {
  if (exporting.value) return;
  exporting.value = true;
  uni.showLoading({ title: "生成高清壁纸...", mask: true });
  try {
    await exportWallpaper({
      canvas: exportCanvas,
      bg: currentBg.value,
      pet: currentPet.value,
      worn: wornByPet[petId.value]
    });
    uni.hideLoading();
    uni.showToast({ title: "壁纸已保存", icon: "success" });
  } catch (err) {
    uni.hideLoading();
    console.error("[exportWallpaper]", err);
    const msg = (err && err.errMsg) || "";
    if (msg.indexOf("auth deny") >= 0 || msg.indexOf("authorize") >= 0) {
      uni.showModal({
        title: "需要相册权限",
        content: "请在设置中允许保存到相册，即可一键保存高清萌宠壁纸。",
        confirmText: "去设置",
        success: (r) => {
          if (r.confirm && uni.openSetting) uni.openSetting();
        }
      });
    } else {
      uni.showToast({ title: "保存失败，请重试", icon: "none" });
    }
  } finally {
    exporting.value = false;
  }
}

onShareAppMessage(() => ({
  title: `快来给我的${currentPet.value.label}蛋宝宝换新装、换场景！`,
  path: "/pages/index/index",
  imageUrl: currentBg.value.url
}));

onShareTimeline(() => ({
  title: `蛋宝宝装扮屋 · ${currentPet.value.label}新造型`,
  imageUrl: currentBg.value.url
}));
</script>

<style scoped>
.viewport {
  width: 100vw;
  height: 100vh;
  background: #1e1a16;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.page {
  position: relative;
  width: 100%;
  height: 100%;
  max-width: 430px;
  overflow: hidden;
}

.stage-bg {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.top-bar {
  position: relative;
  z-index: 20;
  padding-left: 12px;
  padding-right: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.pet-switch {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(30, 24, 18, 0.44);
  padding: 3px;
  border-radius: 999px;
  backdrop-filter: blur(8px);
}

.pet-pill {
  margin: 0;
  padding: 5px 14px;
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 248, 238, 0.88);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
}

.pet-pill.active {
  background: #fbf4ea;
  color: #5a4636;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.16);
}

.action-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.act-btn {
  margin: 0;
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(251, 244, 234, 0.92);
  color: #5a4636;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.25;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.16);
}

.act-btn.share-btn {
  background: #c9955a;
  color: #ffffff;
}

.bg-strip {
  width: 100%;
  white-space: nowrap;
}

.bg-strip-inner {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 2px 4px;
}

.bg-chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px 3px 4px;
  border-radius: 999px;
  background: rgba(26, 22, 18, 0.48);
  border: 1.5px solid rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(8px);
  cursor: pointer;
}

.bg-chip.active {
  background: rgba(251, 244, 234, 0.94);
  border-color: #d9a466;
}

.bg-thumb {
  width: 21px;
  height: 21px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.35);
}

.bg-label {
  font-size: 11px;
  font-weight: 500;
  color: #fff6ea;
}

.bg-chip.active .bg-label {
  color: #5a4636;
  font-weight: 600;
}

.stage-box {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  z-index: 5;
  user-select: none;
  touch-action: none;
}

.pet-gl {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  display: block;
}

.shadow-soft {
  position: absolute;
  left: 53%;
  top: 48.2%;
  width: 160px;
  height: 44px;
  border-radius: 50%;
  filter: blur(7px);
  z-index: 1;
  pointer-events: none;
}

.shadow-contact {
  position: absolute;
  left: 50.8%;
  top: 48.9%;
  width: 110px;
  height: 15px;
  border-radius: 50%;
  filter: blur(2px);
  z-index: 1;
  pointer-events: none;
}

.sleep-zz {
  position: absolute;
  left: 64%;
  top: 24%;
  z-index: 6;
  font-size: 15px;
  font-weight: 700;
  color: rgba(255, 250, 240, 0.92);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  animation: zzFloat 2.2s ease-in-out infinite;
  pointer-events: none;
}

@keyframes zzFloat {
  0% { opacity: 0; transform: translateY(6px) scale(0.85); }
  45% { opacity: 1; transform: translateY(-5px) scale(1); }
  100% { opacity: 0; transform: translateY(-16px) scale(1.1); }
}

.stage-loading {
  position: absolute;
  left: 50%;
  top: 34%;
  transform: translate(-50%, -50%);
  z-index: 8;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(30, 24, 18, 0.56);
  color: #fff6ea;
  font-size: 12px;
}

.sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 45vh;
  max-height: 390px;
  min-height: 270px;
  z-index: 15;
  background: rgba(251, 244, 234, 0.97);
  border-radius: 24px 24px 0 0;
  box-shadow: 0 -8px 24px rgba(60, 38, 18, 0.18);
  padding: 8px 12px calc(10px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
}

.sheet-handle {
  width: 38px;
  height: 4px;
  border-radius: 999px;
  background: #e2d0bc;
  margin: 2px auto 6px;
  flex-shrink: 0;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px 8px;
  flex-shrink: 0;
}

.sheet-title {
  font-size: 14px;
  font-weight: 700;
  color: #5a4636;
}

.sheet-tip {
  font-size: 11px;
  color: #9b846d;
}

.grid-scroll {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px 7px;
  padding: 2px 1px 14px;
}

.card {
  position: relative;
  background: #fffdf9;
  border-radius: 13px;
  border: 2px solid transparent;
  box-shadow: 0 1px 4px rgba(80, 50, 20, 0.08);
  padding: 6px 4px 5px;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
}

.card.selected {
  border-color: #c9955a;
  box-shadow: 0 2px 7px rgba(201, 149, 90, 0.25);
}

.thumb-wrap {
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-img {
  width: 100%;
  height: 100%;
}

.card-name {
  margin-top: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #4f3d2e;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #c9955a;
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.export-canvas {
  position: fixed;
  left: -9999px;
  top: -9999px;
  width: 780px;
  height: 1688px;
  pointer-events: none;
}
</style>
