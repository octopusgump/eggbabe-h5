# 锦鲤换装资产与入口说明

> **线上主入口提示**：锦鲤换装已统一合入 Uni-app 一码双端正式版（支持 12 套全身套装、11 套背景、高清壁纸导出与 `catalog.json` 热更新）：
> - 总入口：<https://octopusgump.github.io/eggbabe-h5/>
> - 装扮屋直达：<https://octopusgump.github.io/eggbabe-h5/eggbabe-uni/site/>

## 历史单页基线文件（仅作对照与资产源）

| 文件 | 说明 |
| :--- | :--- |
| `assets/dress_pets_demo.html` | 历史双宠 iframe 基线页（顶部已加一键跳转新版入口） |
| `assets/koi-v2b/koi_mesh_demo.html` | 锦鲤单页 WebGL 基线产物（12 全身套装 + 11 背景 + 逐套精准眼位着色器） |
| `assets/koi-v2b/work/sets/sets_meta.json` | 12 套全身套装清单与每套精确 `eyeL` / `eyeR` 坐标 |
| `assets/shared/catalog.json` | Uni-app H5 与微信小程序共用的线上热更新清单 |

## 锦鲤资产与单页基线构建

```bash
python3 assets/koi-v2b/work/prepare_koi_sets.py
python3 assets/koi-v2b/work/build_koi_demo.py
```

## 当前 12 套全身套装

- **日常萌趣**：小黄鸭雨衣（`set_duck`）、夏日祭浴衣（`set_yukata`）、小海军水手（`set_sailor`）、草莓睡衣（`set_strawberry_pj`）
- **童话节日**：森林小蘑菇（`set_mushroom`）、小厨师烘焙（`set_baker`）、复古宇航员（`set_astronaut`，透明玻璃泡泡头盔）、新年小醒狮（`set_lion`）
- **搞怪恐龙**：暴走霸王龙（`set_trex`）、针织三角龙（`set_triceratops`）、破壳小恐龙（`set_eggshell_dino`）、粉黄小剑龙（`set_stego`）