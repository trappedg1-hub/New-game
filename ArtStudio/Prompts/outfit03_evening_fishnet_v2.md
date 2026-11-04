# Stage 4 — Наряд 03: вечерний образ, v2

## Причина точечной правки

v1 получил **PARTIAL**. Пользователь: «чулки должны быть без дырок под пальцы, чулки сделай
в сеточку, платье более оттягивающее и короче». Интерпретация: закрытый цельный мысок
сетчатого чулка без вырезов для пальцев; открытый мысок туфель сохраняется, а пальцы видны
**через сетку**, не босыми. Чёрное платье — более облегающее и заметно короче. Остальные
детали по возможности сохраняются; образ художественный и неэксплицитный.

## Референсы по порядку

1. `Generated/Experiments/outfit03_evening_open_toe_v1.png` — выбранный v1 как шаблон
   внешности, позы, обуви и композиции; он не утверждён.
2. `Generated/Approved/HERO-01_canon_portrait.png` — только идентичность героини.
3. `Style/references/style_ref_01_fullbody.png` — только стиль, не внешность или поза
   персонажа стилевого референса.

Инструмент: `generate_image`, одиночная правка выбранного изображения,
`offer_options=false`. Название модели, seed и sampler инструментом не раскрываются.
Сырой результат: `Generated/Experiments/outfit03_evening_fishnet_v2.png`; подготовленный
к оценке вариант: `Generated/Experiments/outfit03_evening_fishnet_v2_adjusted.png`.
Статус: **ожидает оценки пользователя**; ни один файл не утверждён.

## Prompt (EN)

Edit the FIRST attached portrait and change only the requested clothing details. Make the same opaque black evening dress visibly shorter and more closely body-hugging, with a higher upper-thigh hem while still fully covering underwear and intimate areas. Replace the smooth thigh-high stockings with black fishnet thigh-high stockings: a regular diamond mesh with lace tops, continuing uninterrupted over the whole foot and every toe. The stocking toe is closed and intact, with no separate toe holes, cutouts, open-toe hosiery or bare toes. The tiny openings that form the fishnet weave are part of the fabric, not openings for the toes.

Keep the same black open-toe high-heeled sandals from the first image. The toes should remain visible through the fishnet fabric in the open fronts of the shoes, but covered by the continuous closed-toe stocking. Maintain natural foot and toe anatomy and make the mesh legible on the legs, feet and toes. The outfit is tasteful, opaque where appropriate, SFW and non-explicit.

Keep everything else as close to the FIRST image as possible: the same clearly adult woman in her late 20s, mature face, violet-purple eyes, golden-blonde glossy waves, proportions, warm tan skin and existing natural tan lines. Preserve the same pose, hands, leg and foot positions, head-to-toe camera framing, background, lighting, colors and established rendering. Do not add jewelry, hair accessories, bangs, objects, extra figures or panels.

The SECOND image is an identity reference for the same character; the THIRD is a style reference ONLY. Preserve the established illustrated style of the first image and use the third only for its drawing style, never for that character's face, hair, eyes, clothing or pose.

## Результат и локальная обработка

- Сырой v2 — 608×1775; v1 был 592×1728. Модель нарисовала сетчатые чулки и сохранила
  открытые туфли: на увеличении сетка продолжается поверх пальцев, отдельного выреза для
  них не видно. Сетка на пальцах очень мелкая, поэтому сами пальцы различимы не очень чётко.
- Генерация почти не изменила длину и плотность посадки платья по сравнению с v1.
  Для варианта к оценке подол дополнительно укорочен локальной геометрической правкой:
  нижняя часть платья сжата, существующий участок кожи бедра растянут, кромка подола
  поднята приблизительно на 35 px с плавными переходами. Посадка осталась близкой к v1;
  усиление облегания не следует считать надёжно выполненным.
- Обработка использовала только сырой v2, без замены частей другим изображением;
  около левой руки вручную восстановлена тонкая линия контура. Пересэмплирование может
  затронуть соседнюю кожу, контур и край кружева. Точная процедура:
  `Tools/outfit03_shorten_hem.py` (Pillow 13.0.0, NumPy 2.4.6).
- При сравнении RGB-пикселей с сырым v2 изменены 62 605 пикселей, все внутри
  включительного прямоугольника `(100, 795)–(468, 1035)`; вне него пиксели совпадают.
  Стопы и туфли при локальной правке не изменялись. Это сравнение **с сырым v2**, а не
  попиксельная гарантия совпадения с v1, который был перегенерирован моделью.
- Оба изображения остаются в Experiments/. Исходный v1, канон и утверждённые изображения
  не перезаписаны. Имя модели, seed и sampler не раскрываются; оценка пользователя ожидается.
