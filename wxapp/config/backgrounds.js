const { assetUrl } = require("./cdn");

const RAW_BACKGROUNDS = [
  {
    id: "room_bg",
    name: "奶油暖屋",
    file: "assets/shared/room_bg.jpg",
    stageBg: "#f0e2cc",
    shadowSoft: "radial-gradient(ellipse at 48% 46%, rgba(86,52,28,.32) 0%, rgba(92,58,32,.19) 28%, rgba(110,72,40,.09) 52%, rgba(120,80,46,0) 76%)",
    shadowContact: "radial-gradient(ellipse at 50% 50%, rgba(52,32,16,.46) 0%, rgba(62,38,20,.2) 42%, rgba(62,38,20,0) 74%)",
    exportShadowRgba: "rgba(52, 32, 16, 0.32)"
  },
  {
    id: "bg_winter_blue",
    name: "冬日蓝菱格",
    file: "assets/shared/bgs/bg_winter_blue.jpg",
    stageBg: "#5b7996",
    shadowSoft: "radial-gradient(ellipse at 48% 46%, rgba(36,52,72,.32) 0%, rgba(44,62,84,.18) 30%, rgba(56,74,96,.08) 54%, rgba(56,74,96,0) 76%)",
    shadowContact: "radial-gradient(ellipse at 50% 50%, rgba(26,38,54,.46) 0%, rgba(34,48,66,.2) 42%, rgba(34,48,66,0) 74%)",
    exportShadowRgba: "rgba(26, 38, 54, 0.34)"
  },
  {
    id: "bg_mint_room",
    name: "复古薄荷房",
    file: "assets/shared/bgs/bg_mint_room.jpg",
    stageBg: "#b8c7b3",
    shadowSoft: "radial-gradient(ellipse at 48% 46%, rgba(78,58,34,.30) 0%, rgba(88,66,40,.17) 30%, rgba(102,78,48,.08) 54%, rgba(102,78,48,0) 76%)",
    shadowContact: "radial-gradient(ellipse at 50% 50%, rgba(50,36,20,.44) 0%, rgba(60,44,24,.19) 42%, rgba(60,44,24,0) 74%)",
    exportShadowRgba: "rgba(50, 36, 20, 0.30)"
  },
  {
    id: "bg_moon_courtyard",
    name: "桂月亭台夜",
    file: "assets/shared/bgs/bg_moon_courtyard.jpg",
    stageBg: "#27335c",
    shadowSoft: "radial-gradient(ellipse at 48% 46%, rgba(20,24,48,.42) 0%, rgba(28,32,62,.24) 30%, rgba(36,42,74,.10) 54%, rgba(36,42,74,0) 76%)",
    shadowContact: "radial-gradient(ellipse at 50% 50%, rgba(14,16,34,.56) 0%, rgba(22,26,48,.26) 42%, rgba(22,26,48,0) 74%)",
    exportShadowRgba: "rgba(14, 16, 34, 0.42)"
  },
  {
    id: "bg_lotus_pond",
    name: "荷灯锦鲤池",
    file: "assets/shared/bgs/bg_lotus_pond.jpg",
    stageBg: "#16384c",
    shadowSoft: "radial-gradient(ellipse at 48% 46%, rgba(20,30,46,.42) 0%, rgba(28,40,58,.24) 30%, rgba(38,52,72,.10) 54%, rgba(38,52,72,0) 76%)",
    shadowContact: "radial-gradient(ellipse at 50% 50%, rgba(14,22,34,.56) 0%, rgba(22,32,48,.26) 42%, rgba(22,32,48,0) 74%)",
    exportShadowRgba: "rgba(14, 22, 34, 0.42)"
  },
  {
    id: "bg_plush_meadow",
    name: "星夜绒花坡",
    file: "assets/shared/bgs/bg_plush_meadow.jpg",
    stageBg: "#2b2566",
    shadowSoft: "radial-gradient(ellipse at 48% 46%, rgba(68,36,56,.36) 0%, rgba(82,46,68,.20) 30%, rgba(96,58,80,.09) 54%, rgba(96,58,80,0) 76%)",
    shadowContact: "radial-gradient(ellipse at 50% 50%, rgba(44,22,38,.50) 0%, rgba(56,30,48,.22) 42%, rgba(56,30,48,0) 74%)",
    exportShadowRgba: "rgba(44, 22, 38, 0.38)"
  },
  {
    id: "bg_sunset_meadow",
    name: "晚霞云朵坡",
    file: "assets/shared/bgs/bg_sunset_meadow.jpg",
    stageBg: "#8e6d88",
    shadowSoft: "radial-gradient(ellipse at 48% 46%, rgba(76,58,44,.34) 0%, rgba(88,68,52,.19) 30%, rgba(104,82,64,.08) 54%, rgba(104,82,64,0) 76%)",
    shadowContact: "radial-gradient(ellipse at 50% 50%, rgba(50,36,26,.48) 0%, rgba(62,46,34,.22) 42%, rgba(62,46,34,0) 74%)",
    exportShadowRgba: "rgba(50, 36, 26, 0.34)"
  },
  {
    id: "bg_deep_sea",
    name: "幻光深海屋",
    file: "assets/shared/bgs/bg_deep_sea.jpg",
    stageBg: "#1c6392",
    shadowSoft: "radial-gradient(ellipse at 48% 46%, rgba(56,36,78,.34) 0%, rgba(68,46,92,.19) 30%, rgba(84,58,108,.08) 54%, rgba(84,58,108,0) 76%)",
    shadowContact: "radial-gradient(ellipse at 50% 50%, rgba(38,24,56,.48) 0%, rgba(50,32,72,.22) 42%, rgba(50,32,72,0) 74%)",
    exportShadowRgba: "rgba(38, 24, 56, 0.36)"
  },
  {
    id: "bg_autumn_cabin",
    name: "秋日暖炉屋",
    file: "assets/shared/bgs/bg_autumn_cabin.jpg",
    stageBg: "#5b321a",
    shadowSoft: "radial-gradient(ellipse at 48% 46%, rgba(46,22,10,.44) 0%, rgba(58,28,14,.25) 30%, rgba(72,38,18,.11) 54%, rgba(72,38,18,0) 76%)",
    shadowContact: "radial-gradient(ellipse at 50% 50%, rgba(28,12,6,.58) 0%, rgba(40,18,8,.28) 42%, rgba(40,18,8,0) 74%)",
    exportShadowRgba: "rgba(28, 12, 6, 0.44)"
  },
  {
    id: "bg_candy_hearth",
    name: "甜梦糖果屋",
    file: "assets/shared/bgs/bg_candy_hearth.jpg",
    stageBg: "#2d6f82",
    shadowSoft: "radial-gradient(ellipse at 48% 46%, rgba(92,42,42,.34) 0%, rgba(108,52,52,.19) 30%, rgba(124,64,64,.08) 54%, rgba(124,64,64,0) 76%)",
    shadowContact: "radial-gradient(ellipse at 50% 50%, rgba(62,26,28,.48) 0%, rgba(76,34,36,.22) 42%, rgba(76,34,36,0) 74%)",
    exportShadowRgba: "rgba(62, 26, 28, 0.36)"
  },
  {
    id: "bg_pink_cloud",
    name: "暮粉祥云境",
    file: "assets/shared/bgs/bg_pink_cloud.jpg",
    stageBg: "#b38fa3",
    shadowSoft: "radial-gradient(ellipse at 48% 46%, rgba(86,52,74,.32) 0%, rgba(98,62,86,.18) 30%, rgba(114,76,100,.08) 54%, rgba(114,76,100,0) 76%)",
    shadowContact: "radial-gradient(ellipse at 50% 50%, rgba(58,34,50,.46) 0%, rgba(72,44,62,.20) 42%, rgba(72,44,62,0) 74%)",
    exportShadowRgba: "rgba(58, 34, 50, 0.34)"
  }
];

const BACKGROUNDS = RAW_BACKGROUNDS.map((bg) => ({
  ...bg,
  url: assetUrl(bg.file)
}));

module.exports = {
  BACKGROUNDS
};
