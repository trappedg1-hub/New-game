# Stage 4 — Наряд 04: «Уютное утро», v1

## Запрос и статус

После APPROVE вечернего образа пользователь попросил предложить следующий костюм. Предложен
домашний образ: короткий белый топ на тонких бретелях, короткие мягкие сиреневые шорты с
высокой талией, босиком, мягкий утренний свет и спокойная слегка игривая поза. Пользователь:
«Ну давай тест, только сделай его быстрее и будем уже приступать к следующему этапу».
Согласие относится к тесту, а не к автоматическому утверждению результата.

## Референсы и инструмент

1. `Generated/Approved/HERO-01_outfit01_beach.png` — утверждённая внешность, фигура, полный
   рост и анатомия босых стоп; купальник заменяется домашней одеждой.
2. `Generated/Approved/HERO-01_canon_portrait.png` — дополнительный референс идентичности.
3. `Style/references/style_ref_01_fullbody.png` — исключительно стиль, не внешность, одежда
   или поза изображённого там персонажа.

`generate_image`, `offer_options=true`: один тест с выбором кандидата, затем отдельная оценка
APPROVE / PARTIAL / REJECT. Выбран кандидат **1/2**: `Generated/Experiments/outfit04_cozy_morning_v1.png`,
PNG 896×2640. Выбор в пикере не является утверждением образа; оценка пользователя **ожидается**.
Невыбранный кандидат в доступных каталогах workspace не обнаружен; его не считать сохранённым.
Названия моделей, seed и sampler инструментом не раскрываются.

## Первичная проверка

Белый укороченный топ, сиреневые трикотажные шорты и босые стопы показаны в полный рост.
У героини золотистые волны, фиолетовые глаза и видимые следы загара на руке и у талии;
аксессуаров для волос и украшений не видно. Поза близка к пляжному референсу. Фон получился
тёмным нейтральным, поэтому ощущение утренней домашней сцены выражено слабо; посадка шорт
скорее средняя, чем явно высокая. Оценка остаётся за пользователем.

## Prompt (EN)

Identity and composition: The FIRST attached image is the approved adult character, full-body proportions and barefoot anatomy reference; the SECOND is an identity reference for the SAME woman. Keep her recognisable mature face, violet-purple eyes, golden-blonde waves, warm tan skin and natural tan lines, and show her from the top of her hair to both bare feet without cropping. Replace the swimsuit in the first reference completely with the cozy outfit below. The THIRD attached image is the art-style reference ONLY: never copy that character's face, hair, eyes, clothing or pose.

a beautiful adult anime woman in her late 20s, long beautiful golden-blonde hair with strong glossy waves and high-shine bright highlights reaching her lower back, large expressive violet-purple anime eyes with glassy radial-gradient irises and a large upper highlight, elegantly arched eyebrows, slender nose, soft full lips, strongly defined feminine hourglass figure with a clearly sculpted narrow waist and wide hips, smooth firm body contour, lightly tanned skin with clearly visible natural tan lines showing elegant soft skin-tone contrast, beautiful slender elegant legs with refined anatomy. Her face is mature and elegant, NOT teenage. Violet eyes, NOT blue. NO straight bangs, NO hair clips, NO hairpins, NO hair accessories, NO jewelry.

Outfit: a fitted, opaque white cropped knit camisole top with thin shoulder straps and soft fabric, paired with short, high-waisted lilac lounge shorts made of cozy knit fabric. Clearly show two pieces of loungewear, not a swimsuit, bra or underwear. Bare legs and bare feet, with naturally shaped toes and ankles. Keep the clothing tasteful and SFW, fully covering underwear and intimate areas. Preserve clearly visible natural tan lines on the exposed shoulders, arms and waist where visible, with soft realistic skin-tone transitions.

Pose and mood: an adult woman in a relaxed full-body stance with a gentle playful smile and natural arms; do not copy the third reference's hand-to-lips gesture. Soft warm morning-inspired light, calm uncluttered neutral backdrop, clean readable silhouette, no extra figures, props, jewelry, panels or text. Artistic and non-explicit.

Style: in EXACTLY the art style of the attached reference images — same lineart character, same shading method, same rendering quality, same lighting, same clean high-clarity color palette. Reproduce the style faithfully, do not invent a new style, do not copy the reference characters' faces or identities. Thin uniform warm dark lineart, bright airy cel shading with soft warm gradients and subtle ambient occlusion, smooth glossy skin with minimal texture, large bright open anime eyes with glassy radial-gradient irises and a large upper highlight, simple small nose, small plump glossy lips, soft round cheeks with subtle blush, glossy wavy hair with strong bright highlight bands and distinct strand clumps, dark neutral backdrop, soft studio key light with gentle rim light, low-contrast elegant lighting, crisp polished official game artwork.
