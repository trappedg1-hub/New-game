# Stage 4 — Наряд 01: пляжный, v2 (мини-бикини)

## Причина точечной правки

v1 получил **PARTIAL**. Слова пользователя: «Купальник: я бы сделал мини-бикини если это
возможно, все остальное хорошо». Поэтому изменяется **только купальник**; персонаж, поза,
кадр, свет, фон и остальные детали сохраняются. Всё художественно и неэксплицитно.

## Референсы по порядку

1. `Generated/Experiments/outfit01_beach_v1.png` — исходное изображение для редактирования;
   фиксирует внешность, позу и композицию.
2. `Generated/Approved/HERO-01_canon_portrait.png` — только идентичность героини.
3. `Style/references/style_ref_01_fullbody.png` — только визуальный стиль, не личность,
   одежда или поза персонажа на нём.

Инструмент: `generate_image`, одиночная правка ранее выбранного изображения,
`offer_options=false`. Имя модели, seed и sampling-параметры инструмент не раскрывает.
Исходный результат генерации: `Generated/Experiments/outfit01_beach_v2.png` (608×1775).
Оценённый вариант: `Generated/Experiments/outfit01_beach_v2_locked.png` (1184×3456).
Статус: **APPROVE** — пользователь: «APPROVE Последнюю версию». Побайтно идентичная копия:
`Generated/Approved/HERO-01_outfit01_beach.png`; исходные эксперименты сохранены.

## Prompt (EN)

Edit the FIRST attached image. Change ONLY the swimsuit: replace the ivory bandeau and bottoms with a tasteful ivory-white mini bikini, with small opaque triangle cups, slender straps and matching low-rise bottoms with narrow side ties. The fabric must be opaque and cover intimate areas; the result is artistic, SFW and non-explicit.

Keep everything else as close to the FIRST image as possible: the same clearly adult woman in her late 20s, mature face, violet-purple eyes, golden-blonde glossy waves, body proportions, naturally tanned skin and existing tan lines. Preserve the same head-to-toe framing, camera, pose, arms, hands, legs, bare feet, background, light, colors and rendering. Only skin newly uncovered by the smaller swimsuit may need to be filled in naturally. Do not add jewelry, hair accessories, bangs, objects, extra figures or panels.

The second image is an identity reference for the same character; the third image is a style reference ONLY. Preserve the first image's established illustrated style and use the third only for its drawing style, never for its character's face, hair, eyes, outfit or pose.

## Подготовка варианта для оценки

Исходная правка получилась 608×1775, тогда как v1 имеет 1184×3456. Чтобы сохранить исходную
композицию и качество остальной картинки, правка масштабирована Lanczos до размера v1, а
области купальника и соседней кожи перенесены на v1 через две мягкие маски. Маски частично
охватывают прилегающие пряди и кожу: внутри маски попиксельная неизменность всего остального
не гарантируется. **Вне ненулевой области маски результат попиксельно совпадает с v1**
(проверка ImageMagick difference: mean = 0). Исходная генерация v2 сохранена отдельно.

Воспроизведение (`base` — v1, `raw` — исходная генерация v2, `out` — вариант для оценки):

```sh
convert "$raw" -filter Lanczos -resize '1184x3456!' v2_resized.png
convert -size 1184x3456 xc:black -fill white \
  -draw 'roundrectangle 100,520 840,1190 70,70 roundrectangle 130,1300 930,1840 70,70' \
  -blur 0x18 -depth 8 mask.png
convert v2_resized.png mask.png -alpha off -compose CopyOpacity -composite layer.png
convert "$base" layer.png -compose over -composite -depth 8 "$out"
```

Первичная визуальная проверка: одна взрослая героиня, violet-глаза, golden-blonde волны,
без аксессуаров; полный рост, ноги, ступни и естественные tan lines сохранены. Мини-бикини
непрозрачно, изображение неэксплицитно. Пользователь утвердил именно этот вариант.
