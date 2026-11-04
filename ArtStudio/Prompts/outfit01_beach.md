# Stage 4 — Наряд 01: пляжный, v1

Статус: пользователь выбрал пляжный образ; из двух кандидатов v1 выбран **2/2**, итоговая
оценка **APPROVE / PARTIAL / REJECT ожидается**. Образ по умолчанию: непрозрачный светлый
купальник, полный рост, нейтральный фон. Изображение — художественное и неэксплицитное.

## Референсы по порядку

1. `Generated/Approved/HERO-01_canon_portrait.png` — идентичность: лицо, волосы, глаза, кожа.
2. `Generated/Approved/HERO-01_test01_portrait.png` — дополнительный identity-референс.
3. `Style/references/style_ref_01_fullbody.png` — **только стиль**; не копировать личность,
   одежду или позу персонажа на нём.

Инструмент: `generate_image`; один тест, `offer_options=true` — два кандидата для выбора.
Имена моделей и seed не раскрываются; остальные параметры инструмента по умолчанию.
Выбран кандидат 2/2: `Generated/Experiments/outfit01_beach_v1.png`, PNG 1184×3456.
Невыбранный кандидат в доступных каталогах workspace не обнаружен; его не считать сохранённым.
Выбор в пикере не является финальным APPROVE.

## Первичная проверка

В одном кадре — взрослая блондинка с фиолетовыми глазами, без аксессуаров, в полный рост;
следы загара видны на руке и у талии, ноги и ступни в кадре. Верх купальника получился
бандо, а посадка низа ниже описанной в промпте high-waisted. Это наблюдение, не оценка
пользователя; нужен его отзыв, прежде чем менять промпт или переносить файл в Approved/.

## Prompt (EN)

Identity: The first two attached images show the SAME target character — keep her face, hairstyle, eye color, skin tone, tan lines and body exactly consistent with them. The third attached image is the art-style reference ONLY — take style, never identity, face, hair, eye color, clothing or pose.

One single adult woman, one full-body portrait, head to toe, with no other figures or panels. A beautiful adult anime woman in her late 20s, long beautiful golden-blonde hair with strong glossy waves and high-shine bright highlights reaching her lower back, large expressive violet-purple anime eyes with glassy radial-gradient irises and a large upper highlight, elegantly arched eyebrows, slender nose, soft full lips, strongly defined feminine hourglass figure with a clearly sculpted narrow waist and wide hips, smooth firm body contour, lightly tanned skin with clearly visible natural tan lines showing elegant soft skin-tone contrast, beautiful slender elegant legs with refined anatomy. Her face is mature and elegant, NOT teenage. Violet eyes, NOT blue. NO straight bangs, NO hair clips, NO hairpins, NO hair accessories of any kind, and NO jewelry.

Wardrobe: a tasteful SFW beach outfit consisting of an opaque ivory classic two-piece swimsuit, with a simple bikini top and matching high-waisted bottoms. Bare feet, no extra garments or accessories. Natural prominent tan lines: clearly visible, soft but distinct transitions between sun-kissed and lighter skin across her shoulders, upper arms and waist or hips, as appropriate to previous sun exposure. Avoid random stripe patterns. Preserve the natural skin detail, graceful legs, defined knees, calves, ankles and anatomically correct feet.

Pose and framing: relaxed confident standing contrapposto, slight three-quarter turn toward the viewer, arms resting naturally at her sides, soft smile. Full body visible from the top of her hair to both feet, without cropping; keep the face recognisable. One figure only. A dark neutral studio backdrop, soft key light and gentle rim light, clean elegant silhouette. Non-explicit.

Style: in EXACTLY the art style of the attached reference images — same lineart character, same shading method, same rendering quality, same lighting, same clean high-clarity color palette. Reproduce the style faithfully, do not invent a new style, do not copy the reference characters' faces or identities. Thin uniform warm dark lineart, bright airy cel shading with soft warm gradients and subtle ambient occlusion, smooth glossy skin with minimal texture, large bright open anime eyes with glassy radial-gradient irises and a large upper highlight, simple small nose, small plump glossy lips, soft round cheeks with subtle blush, glossy wavy hair with strong bright highlight bands and distinct strand clumps, dark neutral backdrop, soft studio key light with gentle rim light, low-contrast elegant lighting, crisp polished official game artwork.
