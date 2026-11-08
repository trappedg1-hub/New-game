// Source images are served unchanged for the full-size viewer. Cards use
// separate thumbnails; the build verifies each original's dimensions and SHA-256.
export const art = [
  {
    id: 'beach', title: 'Пляжный образ', english: 'BEACH', number: '01', group: 'still',
    file: 'HERO-01_outfit01_beach.png', source: 'Approved', width: 1184, height: 3456,
    sha256: 'baef35b2efe845feb77950504344bf27e6519664272e14a2c8e3883bb88f7f60',
    description: 'Солнечный образ и мини-бикини.', status: 'Арт утверждён',
  },
  {
    id: 'evening', title: 'Вечернее платье', english: 'EVENING', number: '02', group: 'still',
    file: 'HERO-01_outfit03_evening_fishnet.png', source: 'Approved', width: 608, height: 1775,
    sha256: 'a86cc3046642b4b152adbfa271fc6829cbbb3acddd149071baff9219362b7d93',
    description: 'Чёрное платье, сетчатые чулки и каблуки.', status: 'Арт утверждён',
  },
  {
    id: 'goth', title: 'Готический образ', english: 'GOTH GIRL', number: '03', group: 'still',
    file: 'HERO-01_outfit06_goth_girl.png', source: 'Approved', width: 768, height: 1376,
    sha256: 'ad4c15f217c918ee5b2fe24a90af721f3eea85ef7fd5240259c72a925da02bee',
    description: 'Юбка, сетка и рваные чулки. Вторая стопа скрыта в исходнике.', status: 'Арт утверждён',
  },
  {
    id: 'nightgown', title: 'Ночная накидка', english: 'NIGHTGOWN GIRL', number: '04', group: 'still',
    file: 'HERO-01_outfit07_nightgown_girl.png', source: 'Approved', width: 1024, height: 1024,
    sha256: '0389823142cd000855b645fbfa1b768387c22ff926098bcf4d78acbfc9a5065d',
    description: 'Белая ажурная накидка. Утверждённая третья поза.', status: 'Арт утверждён',
  },
  {
    id: 'sister', title: 'Монашка', english: 'SISTER NOIR', number: '05', group: 'still',
    file: 'HERO-01_outfit08_sister_noir.png', source: 'Approved', width: 1024, height: 1024,
    sha256: 'db2efb76e57db2b678578692e66b274564bf089d5dda0c6548a1b7c2c1a4d52a',
    description: 'Утверждённый оригинал. Пальцы в чулке читаются не полностью.', status: 'Арт утверждён',
  },
  {
    id: 'night-step-art', title: 'Ночной наряд · шаг', english: 'NIGHT STEP', number: '01', group: 'animated',
    file: 'HERO-01_outfit10_night_lingerie_step_pose.png', source: 'Approved', width: 1024, height: 1024,
    sha256: 'bfa845260fdaecdb44d4e01fb57f608c193910d1db98f8ed7b6d3340262729f7',
    description: 'Утверждённая поза шага к зрителю, использованная в анимации.', status: 'Арт утверждён',
  },
  {
    id: 'night-original', title: 'Ночной наряд · первый арт', english: 'NIGHT LINGERIE', number: '01', group: 'animated',
    file: 'HERO-01_outfit10_night_lingerie.png', source: 'Approved', width: 1584, height: 2816,
    sha256: '2ee84f468e3261db600f9403ed058bdfc3bca889a048894df2288827fe08460d',
    description: 'Первый утверждённый арт наряда. Эта поза не анимирована.', status: 'Арт утверждён',
  },
  {
    id: 'yoga-art', title: 'Йога', english: 'YOGA GIRL', number: '02', group: 'animated',
    file: 'HERO-01_outfit05_yoga_girl.png', source: 'Approved', width: 1534, height: 2733,
    sha256: '5cd0f5faca1f86fa3f0dfca6429615a877cc98b60c5af542ccbb99a1ff16a317',
    description: 'Утверждённый оригинал, использованный для анимации йоги.', status: 'Арт утверждён',
  },
  {
    id: 'maid-art', title: 'Горничная', english: 'PLAYFUL MAID', number: '03', group: 'animated',
    file: 'HERO-01_outfit02_playful_maid.png', source: 'Approved', width: 1184, height: 3488,
    sha256: '91111189c23d1d7ac424e85d3406202bf028e8d3330ae8c50b33223312f236fd',
    description: 'Утверждённый оригинал, общий для анимаций V1, V2 и V3.', status: 'Арт утверждён',
  },
  {
    id: 'nurse-baseline', title: 'Медсестра · сохранённая основа', english: 'NURSE / A', number: '01', group: 'pending',
    file: 'nurse_girl_saved_baseline.png', source: 'Experiments', width: 2048, height: 2048,
    sha256: '69a0ccf40df8db5f11b586e09be46feedeaf973f6994b9087f599a7e9c54030c',
    description: 'Сохранённая основа. Костюм одобрен, но конкретный утверждённый файл не указан.', status: 'Арт требует уточнения',
  },
  {
    id: 'nurse-bolder', title: 'Медсестра · смелый вариант', english: 'NURSE / B', number: '02', group: 'pending',
    file: 'nurse_girl_bolder_selected.png', source: 'Experiments', width: 2048, height: 2048,
    sha256: '6b536a33db68e7f5f41a24e63c8e79887331597228a1256dea52cbcdfd35ee4d',
    description: 'Следующий выбранный вариант. Какой файл утверждён, нужно уточнить.', status: 'Арт требует уточнения',
  },
  {
    id: 'cozy', title: 'Уютное утро', english: 'COZY MORNING', number: '03', group: 'pending',
    file: 'outfit04_cozy_morning_v1.png', source: 'Experiments', width: 896, height: 2640,
    sha256: 'ddc99a49ae3929ad45da6503c76311f8f139db8653e73311e2cfd54302385687',
    description: 'Тест домашнего образа. Итоговой оценки пока нет.', status: 'Ожидает оценки',
  },
];

export const motions = [
  {
    id: 'night', number: '01', title: 'Ночной наряд', english: 'NIGHT STEP', art: 'night-step-art',
    arts: ['night-step-art', 'night-original'],
    description: 'Шаг к зрителю, мягкое дыхание и быстрые реакции на прикосновения.',
    badge: 'Анимация одобрена', meta: 'Интерактив · 13 зон',
    variants: [{ id: 'step', label: 'Night Step', verdict: 'Анимация одобрена', path: '../',
      detail: 'Утверждённый интерактивный этюд. Прикасайся к ногам, рукам, лицу и волосам.',
      note: 'Внутри сохранена прежняя подпись о проверке; анимация впоследствии одобрена. Исходник — 1024 × 1024, не 4K.' }],
  },
  {
    id: 'yoga', number: '02', title: 'Йога', english: 'YOGA GIRL', art: 'yoga-art', arts: ['yoga-art'],
    description: 'Своя пластика, движение хвоста и реакции в позе йоги.',
    badge: 'Анимация одобрена', meta: 'Интерактив · 13 зон',
    variants: [{ id: 'yoga', label: 'Yoga Girl', verdict: 'Анимация одобрена', path: './motion/yoga/',
      detail: 'Утверждённый интерактивный предпросмотр с независимыми суставами и 13 зонами касания.',
      note: 'Внутри сохранена прежняя подпись «на проверке»; показанная анимация позже одобрена.' }],
  },
  {
    id: 'maid', number: '03', title: 'Горничная', english: 'PLAYFUL MAID', art: 'maid-art', arts: ['maid-art'],
    description: 'Три версии движения одного образа: от базовой V1 до интерактивной V3.',
    badge: '3 версии движения', meta: 'V1 / V2 / V3',
    variants: [
      { id: 'v3', label: 'V3', verdict: 'Утверждённый эталон', path: './motion/maid-v3/',
        detail: 'Интерактивная версия с суставами, мимикой и зонами касания — утверждённый эталон качества.', note: 'Создана на основе V1; это отдельная версия, не замена оригинала.' },
      { id: 'v1', label: 'V1', verdict: 'База одобрена', path: './motion/maid-v1/',
        detail: 'Ранее утверждённая базовая анимация: дыхание, волосы и моргание.', note: 'В этой версии нет интерактивных реакций на касания.' },
      { id: 'v2', label: 'V2', verdict: 'Эксперимент', path: './motion/maid-v2/',
        detail: 'Отдельный эксперимент с дыханием, прядями волос и морганием.', note: 'V2 не заменяет утверждённую базу V1 и не считается одобренной версией.' },
    ],
  },
];

export const artById = Object.fromEntries(art.map(item => [item.id, item]));
export const motionById = Object.fromEntries(motions.map(item => [item.id, item]));
export const artUrl = item => `./art/${item.file}?v=${item.sha256.slice(0, 12)}`;
