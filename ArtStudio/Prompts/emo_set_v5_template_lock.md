# Stage 3 — эмоции v5: template lock

Дата: 2026-11-04. Запрос: шесть выражений на одном и том же портрете, без изменения камеры,
положения/наклона головы, масштаба, композиции, шеи и плеч. Сет **ожидает оценки**;
ничего из него не перенесено в `Generated/Approved/`.

## Использованные референсы и параметры

1. `ArtStudio/Generated/Experiments/emo_set_final/emo02_sad.png` — выбран как рабочий
   шаблон для упомянутой пользователем «approved image 7». Соответствие именно этому файлу
   **пока не подтверждено**; до подтверждения не называть файл утверждённым пользователем.
2. `ArtStudio/Generated/Approved/HERO-01_canon_portrait.png` — идентичность героини.
3. `ArtStudio/Style/references/style_ref_01_fullbody.png` — **только** стиль, не внешность.

Инструмент: `generate_image`, отдельный вызов на каждую эмоцию, `offer_options=false`.
Название модели, seed, sampler и steps инструментом не раскрыты; использовались настройки
инструмента по умолчанию. Размеры исходников: 896×1195 для 01–04 и 06; 608×1752 для
первого 05 (два кадра, не использовать); 896×1200 для исправленного 05.

## Исходный промпт батча (EN)

Каждый из шести вызовов = общий prefix + соответствующая строка Expression + общий suffix
ниже. Записи воспроизводят текст фактических вызовов.

### Prefix

Reference 1 is the EXACT camera and composition template: reproduce EXACTLY the same camera angle, head rotation, head tilt, head position, camera distance and zoom, face size and placement within the frame, neck and shoulder positioning, and the same composition and crop as reference 1. Everything stays identical to the template; ONLY the facial expression changes. Identity: the first two attached images show the SAME target character — keep her face, hairstyle, eye color, skin tone, tan lines and body exactly consistent with them. The last attached image is the art-style reference ONLY — take style, never identity. One single woman, one single face in the image — do not draw the same character twice, no stacked panels, no before-after, no diptych. A beautiful adult anime woman in her late 20s: long beautiful golden-blonde hair with strong glossy waves (NO straight bangs, NO hair clips, NO hairpins, NO hair accessories of any kind), large expressive violet-purple anime eyes (violet irises, NOT blue), elegantly arched eyebrows, slender nose, soft full lips, mature elegant late-20s face, lightly tanned sun-kissed skin, natural tan lines on shoulders.

### Expression

- `emo01_joy.png`: Expression (replacing the template's expression): a bright joyful open smile, eyes bright and slightly narrowed with happiness, radiant cheerful mood.
- `emo02_sad.png`: Expression (same as the template): a sad sorrowful expression, downcast eyes with lowered lashes, a soft gentle frown, slightly pouting lower lip, melancholy mood.
- `emo03_anger.png`: Expression (replacing the template's expression): furrowed brows, narrowed eyes glaring straight ahead, pressed flat lips, a calm composed elegant scowl of refined displeasure — not aggressive.
- `emo04_surprise.png`: Expression (replacing the template's expression): eyebrows lifted high, eyes wide open, mouth parted in a small round shape, a startled elegant reaction.
- `emo05_sleepy.png` (исходник с double-frame): Expression (replacing the template's expression): a sleepy drowsy expression, half-closed heavy eyes with lowered lashes, a soft relaxed face, faint parted lips as in a quiet yawn.
- `emo06_blush.png`: Expression (replacing the template's expression): a soft bashful smile, a noticeable warm blush across the cheeks and nose, a shy lowered gaze.

### Suffix

She wears a simple black off-shoulder top. Dark neutral backdrop, soft studio key light with gentle rim light. Style: in EXACTLY the art style of the last attached style reference image — same lineart character, same shading method, same rendering quality, same lighting, same clean high-clarity color palette. Reproduce the style faithfully, do not invent a new style, do not copy any reference character's face or hair. Thin uniform warm dark lineart, bright airy cel shading with soft warm gradients and subtle ambient occlusion, smooth glossy skin with minimal texture, glossy hair with strong bright highlight bands and distinct strand clumps, crisp polished official game artwork.

## Повтор 05: единичный кадр

Файл: `ArtStudio/Generated/Experiments/emo_set_v5/emo05_sleepy_retry.png`.
Референсы и порядок те же, `offer_options=false`.

> Edit the FIRST attached portrait, keeping its single-image 3:4 vertical composition unchanged. Change ONLY the expression on the existing face: her eyelids are heavy and half closed, her brows relaxed, and her lips rest softly together, conveying a calm sleepy mood. Keep the head perfectly upright and in precisely the same position and orientation, and preserve the existing eyes' violet color. Preserve exactly the first portrait's camera, zoom, face size and placement, hair, skin, lighting, shoulders, neck, black top, background and crop. One portrait of one adult woman only; one single face and one image filling the entire canvas. No duplicate or stacked portraits. The second image is an identity reference only; the third image is a drawing-style reference only. Keep the character golden-blonde with no bangs or accessories, violet eyes, and the original warm tan skin. Do not copy the style-reference character's face or hair.

## Подготовка единого кадра для просмотра

Сохранены и исходные генерации (`emo_set_v5/*.png`), и шесть отдельных изображений для
оценки (`emo_set_v5/ready/*.png`). Для 05 использован **retry**, а не double-frame исходник.
Исходники приведены к размеру шаблона 768×1024 (Lanczos, принудительное изменение размера),
затем области глаз и бровей, щёк и губ каждого наложены на сам шаблон мягкой маской.
Маска охватывает черты лица и часть соседних прядей: внутри неё попиксельная неизменность
всего, кроме мимики, не гарантируется. Вне ненулевой области маски шесть выходов попиксельно
совпадают с шаблоном (ImageMagick difference: mean = 0); это фиксирует фон, общий кадр,
шею, плечи и одежду. Это постобработка, а не свойство, гарантированное генератором.

Воспроизведение для одного изображения (`raw`, `template`, `out` — соответствующие пути):

```sh
convert -size 768x1024 xc:black -fill white \
  -draw 'roundrectangle 185,260 358,410 25,25 roundrectangle 410,260 583,410 25,25 roundrectangle 220,375 548,478 30,30 roundrectangle 300,476 468,557 22,22' \
  -blur 0x7 -depth 8 mask.png
convert "$raw" -filter Lanczos -resize '768x1024!' normalized.png
convert normalized.png mask.png -alpha off -compose CopyOpacity -composite layer.png
convert "$template" layer.png -compose over -composite -depth 8 "$out"
```

`review_sheet.png` — собранный ImageMagick контактный лист только для просмотра, не новая
генерация. Отдельные PNG из `ready/` — файлы, предназначенные для оценки пользователем.
