# 锦鲤换装 demo 路径与衣橱

## 页面

| 文件 | 说明 |
|------|------|
| `assets/dress_pets_demo.html` | 顶栏切换玉兔 / 锦鲤（GitHub Pages 推荐入口） |
| `assets/koi-v2b/koi_mesh_demo.html` | 锦鲤单页 WebGL demo（构建产物） |

## 构建

```bash
python3 assets/koi-v2b/work/prepare_koi_assets.py
python3 assets/koi-v2b/work/build_koi_demo.py
```

## 8 格衣橱（MVP）

| id | slot | 说明 |
|----|------|------|
| `boots_yellow` | boots | 默认黄雨靴（切换回默认） |
| `boots_mint` | boots | 薄荷绿雨靴（互斥，换 body 贴图） |
| `kasa` | head | 小笠 |
| `crown` | head | 锦鲤冠 |
| `bow` | head | 绒球 |
| `scarf` | neck | 祈福结 |
| `omamori` | dorsal | 御守袋 |
| `goldfish` | hand | 手持小金鱼 |

槽位规则与玉兔一致：**同 slot 互斥**，同格再点卸下（靴色卸下回到 `boots_yellow`）。