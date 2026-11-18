# eggbabe-h5 领域词汇

## 小屋

**小屋（House）**  
四块房间模块组成的玉兔居住场景；玩家可指挥玉兔在室内走动。

**房间模块（RoomModule）**  
与 `geom.rooms` 一一对应的可升级单元（卧室、咖啡角、小厨房、阳光房）。

**档位（Tier）**  
某一房间模块的一档装修外观；数字越大表示越「满」的粘土内装。与牧场玩法里的 **关卡（Level）** 无关。

**外壳（Shell）**  
不随单房 tier 变化的 2D 底图（外墙、隔墙、草地等）。

**内装（Furnishing）**  
随 tier 变化的视觉内容；路线 B 中由 Three.js 粘土件描述并烘焙为贴片。

**模块烘焙（ModuleBake）**  
某一 `RoomModule × Tier` 离屏渲染后的 2D 贴图，叠在 Shell 上显示升级效果。

**足迹（Footprint）**  
家具占位是否影响寻路障碍；一期为 cosmetic，不改变 `geom.obst`。