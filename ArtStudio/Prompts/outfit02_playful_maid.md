# Stage 4 — Наряд 02: игривая горничная, v1

## Запрос и статус

Пользователь утвердил последнюю пляжную версию и попросил следующий образ: «костюм
горничной шаловливой». В неэксплицитном тесте выбран кандидат **1/2**; итоговая оценка
ещё не получена. Канон HERO-01 и стиль референсов сохраняются, тёмноволосый архив не используется.

## Референсы по порядку

1. `Generated/Approved/HERO-01_outfit01_beach.png` — утверждённая идентичность, фигура,
   общий кадр и свет; исходный купальник заменяется одеждой горничной.
2. `Generated/Approved/HERO-01_canon_portrait.png` — дополнительный identity-референс.
3. `Style/references/style_ref_01_fullbody.png` — только стиль рисунка, не лицо, причёска,
   одежда или поза изображённого на нём персонажа.

Инструмент: `generate_image`, `offer_options=true` — один тест с выбором между двумя
кандидатами. Названия моделей и seed инструмент не раскрывает; прочие параметры по умолчанию.
Выбран кандидат **1/2**: `Generated/Experiments/outfit02_playful_maid_v1.png`, PNG 1184×3488.
Невыбранный кандидат в доступных каталогах workspace не обнаружен; его не считать сохранённым.
Выбор в пикере не является итоговым APPROVE.

## Первичная проверка

Одна героиня в полный рост: golden-blonde волны, violet-глаза, аксессуаров для волос нет,
костюм и чулки неэксплицитны. При этом следы загара на видимых плечах слабо заметны, а жест
с пальцем у губ отличается от запрошенной позы и напоминает позу style-reference; это риск
переноса позы, а не утверждённое пользователем качество. Нужна оценка пользователя.

## Prompt (EN)

Identity and composition: The FIRST attached image is the approved adult character and full-body composition reference; the SECOND is an identity reference for the SAME woman. Preserve her recognisable mature face, violet-purple eyes, golden-blonde waves, warm tan skin, natural tan lines, proportions, full-body framing and dark neutral studio setting. The THIRD attached image is the art-style reference ONLY: never copy that character's face, hair, eyes, clothing or pose. Replace the swimsuit in the first reference entirely with the new outfit below.

One single adult anime woman in her late 20s, long beautiful golden-blonde hair with strong glossy waves and high-shine bright highlights reaching her lower back, large expressive violet-purple anime eyes with glassy radial-gradient irises and a large upper highlight, elegantly arched eyebrows, slender nose, soft full lips, strongly defined feminine hourglass figure with a clearly sculpted narrow waist and wide hips, smooth firm body contour, lightly tanned skin with clearly visible natural tan lines showing elegant soft skin-tone contrast, beautiful slender elegant legs with refined anatomy. Her face is mature and elegant, NOT teenage. Violet eyes, NOT blue. NO straight bangs, NO hair clips, NO headband or maid headdress, NO hair accessories of any kind, and NO jewelry.

Outfit: a playful adult maid costume, a fitted opaque black off-shoulder short dress with a flared skirt, crisp white frilled apron, white lace edging and short puff sleeves. Add elegant black thigh-high stockings with subtle lace tops and black high heels. Keep the outfit fully opaque, tasteful and SFW, with no exposed underwear or intimate anatomy. Preserve the character's natural tan and tan lines wherever the shoulders or arms are visible, and retain detailed graceful legs and accurate anatomy.

Pose and mood: a mischievous, confident smile and lively, teasing expression, while keeping the relaxed full-body three-quarter stance and natural arms of the first reference. Show the entire figure from the top of the hair to both shoes without cropping. One woman only, no other figures, no props and no panels. Dark neutral studio background, soft key light and gentle rim light; artistic and non-explicit.

Style: in EXACTLY the art style of the attached reference images — same lineart character, same shading method, same rendering quality, same lighting, same clean high-clarity color palette. Reproduce the style faithfully, do not invent a new style, do not copy the reference characters' faces or identities. Thin uniform warm dark lineart, bright airy cel shading with soft warm gradients and subtle ambient occlusion, smooth glossy skin with minimal texture, large bright open anime eyes with glassy radial-gradient irises and a large upper highlight, simple small nose, small plump glossy lips, soft round cheeks with subtle blush, glossy wavy hair with strong bright highlight bands and distinct strand clumps, dark neutral backdrop, soft studio key light with gentle rim light, low-contrast elegant lighting, crisp polished official game artwork.
