# Происхождение экспериментальных век

Все файлы в этой папке — технические материалы **прототипа**, не утверждённый арт.

1. `approved_face_crop.png` — неизменённый кроп 570 × 570 утверждённого `Generated/Approved/HERO-01_outfit02_playful_maid.png`, координаты исходника `(300, 40)–(870, 610)`.
2. `closed_eyes_candidate.png` — AI-generated редактирование этого кропа для проверки закрытых век. Дополнительно передавались утверждённый `Generated/Approved/HERO-01_canon_portrait.png` как identity-reference и `Style/references/style_ref_01_fullbody.png` только как style-reference. Кандидат не утверждался пользователем.
3. `scripts/prepare_blink.py` привязывает кандидата к исходнику через SIFT + RANSAC, ограничивает использование мягкими масками глаз и создаёт экспериментальные RGBA-фрагменты в `public/derived/`. Для промежуточной подложки ресницы удаляются локальным inpaint. В рантайме исходник используется напрямую; остальная часть сгенерированного лица не используется.

## Запрос кандидата

> Edit the FIRST attached image, which is a crop of the approved character. Create the exact same single portrait with both eyes gently, completely closed for one natural relaxed blink. Render the closed eyelids and eyelashes in the same detailed anime lineart style. The head angle, facial proportions, eyebrows, nose, mouth and smile, skin shading, hair strands, surrounding dark background, lighting and framing must remain as close to the first image as possible. This is a blink-state asset for a character rig: only the eyelids change. No new objects, no duplicated face, no text, no panels. This is the same clearly adult woman with long golden-blonde waves, no bangs, no hair accessories, and warm lightly tanned skin. The SECOND image is the approved identity reference for the same character; the THIRD is a style reference ONLY, not a face or hair reference. Preserve the original illustration's style and identity, do not copy the style-reference character.

## Дополнение V2

4. `nearly_closed_candidate.png` — отдельное AI-исследование почти закрытых век на том же утверждённом кропе; это технический кандидат, а не утверждённая новая версия лица. `scripts/prepare_v2_assets.py` выравнивает его к исходнику SIFT/RANSAC (360 совпадений, 308 inliers при закреплённых версиях зависимостей), использует только локальные области глаз и сохраняет экспериментальные 33-кадровые атласы. Переход к близким состояниям использует локальный optical flow; остальная часть кандидата не выводится.
5. Два фрагмента прядей получены напрямую из утверждённого исходника с восстановлением небольшого фона и RGBA-маттированием. Они не являются новыми утверждёнными арт-слоями. На нейтральном кадре восстановленный фон и прядь вместе приближаются к исходным пикселям; координаты и размеры сохранены в `public/derived/rig-v2.json`.
