# Происхождение экспериментальных век

Все файлы в этой папке — технические материалы **прототипа**, не утверждённый арт.

1. `approved_face_crop.png` — неизменённый кроп 570 × 570 утверждённого `Generated/Approved/HERO-01_outfit02_playful_maid.png`, координаты исходника `(300, 40)–(870, 610)`.
2. `closed_eyes_candidate.png` — AI-generated редактирование этого кропа для проверки закрытых век. Дополнительно передавались утверждённый `Generated/Approved/HERO-01_canon_portrait.png` как identity-reference и `Style/references/style_ref_01_fullbody.png` только как style-reference. Кандидат не утверждался пользователем.
3. `scripts/prepare_blink.py` привязывает кандидата к исходнику через SIFT + RANSAC, ограничивает использование мягкими масками глаз и создаёт экспериментальные RGBA-фрагменты в `public/derived/`. Для промежуточной подложки ресницы удаляются локальным inpaint. В рантайме исходник используется напрямую; остальная часть сгенерированного лица не используется.

## Запрос кандидата

> Edit the FIRST attached image, which is a crop of the approved character. Create the exact same single portrait with both eyes gently, completely closed for one natural relaxed blink. Render the closed eyelids and eyelashes in the same detailed anime lineart style. The head angle, facial proportions, eyebrows, nose, mouth and smile, skin shading, hair strands, surrounding dark background, lighting and framing must remain as close to the first image as possible. This is a blink-state asset for a character rig: only the eyelids change. No new objects, no duplicated face, no text, no panels. This is the same clearly adult woman with long golden-blonde waves, no bangs, no hair accessories, and warm lightly tanned skin. The SECOND image is the approved identity reference for the same character; the THIRD is a style reference ONLY, not a face or hair reference. Preserve the original illustration's style and identity, do not copy the style-reference character.

## Экспериментальные выражения V3

Файлы `happy_candidate.png`, `surprised_candidate2.png`, `shy_candidate.png`, `playful_candidate.png` и `sad_candidate.png` — AI-generated изменения только V1-кропа с запросом изменить соответствующее выражение, сохраняя лицо, волосы, палец, ракурс и стиль. Это **не утверждённые** изображения и не замена исходника. Отклонены первый surprised-кандидат (изменил персонажа и одежду) и второй happy-кандидат (чрезмерно широкая зубастая улыбка).

`scripts/prepare_expressions.py` выравнивает кандидаты по V1 через SIFT/RANSAC; только область рта переносится в небольшие прозрачные атласы V3. Глаза, волосы, тело и край поднятого пальца остаются из V1. На соседних кадрах использована локальная оптическая интерполяция, поэтому при крупном масштабе возможна кратковременная мягкость/двоение во время перехода. Румянец — прозрачный цветовой слой, а не замена изображения. Никакой результат не помещён в `Generated/Approved/`.

`sleepy_candidate.png` создан из того же V1-кропа с запросом только на полузакрытые веки и сохранение исходных фиолетовых глаз. Из выровненного кандидата извлечены только две области глаз с прежней маской V1. Во время моргания они затухают, чтобы закрытые веки V1 оставались видимыми; исходное автоматическое и ручное моргание не заменено. Кандидат экспериментальный и не утверждён.

## Эксперимент с подложкой для поднятой руки, 2026-11-05

`experiments/handless_face_underlay_study.png` — AI-generated редактирование только исходного `approved_face_crop.png`: предполагалось удалить поднятый палец и восстановить видимое лицо/волосы под ним. Кандидат не утверждён, не экспортирован в `public/` и **не используется в рантайме**; утверждённый рисунок не заменялся. SHA-256: `d608e11422c2f6fe6a43824dd2e95066d225de89bf08935c25ccedbc1fec3246`.

Исследовательское SIFT/RANSAC-выравнивание дало 427 совпадений и 404 inliers, но высокий счёт не доказывает идеальной локальной маски или качества стыков. В выровненном изображении изменились пиксели и вне пальца (например, в проверенном прямоугольнике глаз средняя абсолютная разница составила около 2.71/255, а 6.7% пикселей имели разницу больше 10 хотя бы в одном канале). Поднятая кисть также соединена с предплечьем, а маски выражений защищают её прежний край. Без надёжно проверенных слоёв руки, скрытого лица и волос безопасно отделить их не удалось, поэтому использована только ограниченная деформация общего оригинала. Эти измерения — причина не интегрировать кандидат, а не доказательство, что отдельный вариант невозможен.
