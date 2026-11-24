export const originalAppearance = 'original';
export const koiAppearance = 'star-sticker';

export const appearances = Object.freeze([
  { id: originalAppearance, name: '原瓶', condition: '默认可用', unlocked: () => true },
  { id: 'cream-label', name: '焦糖咕噜', condition: '五关全部通过', unlocked: chapterComplete => chapterComplete },
  ...[
    { id: 'mint-cap', name: '瓶中余烬', minimumRecord: 5 },
    { id: koiAppearance, name: '瓶中有鲤', minimumRecord: 10 },
  ].map(({ id, name, minimumRecord }) => ({
    id, name, condition: `连翻到底，连续立稳${minimumRecord}次`,
    unlocked: (_chapterComplete, record) => record >= minimumRecord,
  })),
].map(appearance => Object.freeze(appearance)));
