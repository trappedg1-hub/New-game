# Stage 4 — Наряд 03: короткое чёрное вечернее платье, v1

## Запрос и статус

Пользователь утвердил костюм горничной и попросил: «вечернее короткое обтягивающее черное
платье, чулки, каблуки но с открытыми пальцами ног». Для видимых пальцев в тесте предложены
чулки с открытым носком и открытые туфли на каблуке. Подготовлен один неэксплицитный тест;
изображение и пользовательская оценка ещё не получены.

## Референсы по порядку

1. `Generated/Approved/HERO-01_outfit01_beach.png` — утверждённая внешность и полный рост,
   в том числе анатомия стоп; купальник заменяется вечерним образом.
2. `Generated/Approved/HERO-01_canon_portrait.png` — дополнительный identity-референс.
3. `Style/references/style_ref_01_fullbody.png` — только стиль рисунка, не лицо, причёска,
   одежда или поза изображённого на нём персонажа.

Инструмент: `generate_image`, `offer_options=true` — один тест с выбором между двумя
кандидатами. Названия моделей и seed инструмент не раскрывает; прочие параметры по умолчанию.
Путь выбранного кандидата: `Generated/Experiments/outfit03_evening_open_toe_v1.png`.
Выбор в пикере не является итоговым APPROVE.

## Prompt (EN)

Identity and composition: The FIRST attached image is the approved adult character and full-body anatomy reference; the SECOND is an identity reference for the SAME woman. Preserve her recognisable mature face, violet-purple eyes, golden-blonde waves, warm tan skin, natural tan lines, proportions and full-body framing. The THIRD attached image is the art-style reference ONLY: never copy that character's face, hair, eyes, clothing or pose. Replace the swimsuit in the first reference completely with the evening outfit below.

One single adult anime woman in her late 20s, long beautiful golden-blonde hair with strong glossy waves and high-shine bright highlights reaching her lower back, large expressive violet-purple anime eyes with glassy radial-gradient irises and a large upper highlight, elegantly arched eyebrows, slender nose, soft full lips, strongly defined feminine hourglass figure with a clearly sculpted narrow waist and wide hips, smooth firm body contour, lightly tanned skin with clearly visible natural tan lines showing elegant soft skin-tone contrast, beautiful slender elegant legs with refined anatomy. Her face is mature and elegant, NOT teenage. Violet eyes, NOT blue. NO straight bangs, NO hair clips, NO headbands, NO hair accessories of any kind, and NO jewelry.

Outfit: an elegant short, fitted, solid black evening mini dress with an off-shoulder neckline, opaque fabric and a defined waist. She wears sheer black thigh-high stockings with refined lace tops. The stockings are specifically TOELESS: they end before the toes and leave the toes bare. Add elegant black OPEN-TOE high-heeled sandals, with the fronts open so the bare toes are clearly visible. No closed-toe shoes and no hosiery covering the toes. Render naturally shaped feet and individual toes with accurate anatomy. The dress is tasteful and SFW, with no exposed underwear or intimate anatomy. Preserve natural tan and visible tan lines on the exposed shoulders and upper arms, and render the legs, stockings, ankles and open-toe heels in fine detail.

Pose and framing: relaxed confident standing pose, slight three-quarter turn toward the viewer, hands naturally lowered away from the face, soft smile. Angle the feet so the open fronts of both heels and bare toes are visible. Show the entire figure from the top of her hair to both shoes, with enough space around the feet and no cropping. One woman only, no other figures, no props and no panels. Dark neutral studio background, soft key light and gentle rim light; artistic and non-explicit.

Style: in EXACTLY the art style of the attached reference images — same lineart character, same shading method, same rendering quality, same lighting, same clean high-clarity color palette. Reproduce the style faithfully, do not invent a new style, do not copy the reference characters' faces or identities. Thin uniform warm dark lineart, bright airy cel shading with soft warm gradients and subtle ambient occlusion, smooth glossy skin with minimal texture, large bright open anime eyes with glassy radial-gradient irises and a large upper highlight, simple small nose, small plump glossy lips, soft round cheeks with subtle blush, glossy wavy hair with strong bright highlight bands and distinct strand clumps, dark neutral backdrop, soft studio key light with gentle rim light, low-contrast elegant lighting, crisp polished official game artwork.
