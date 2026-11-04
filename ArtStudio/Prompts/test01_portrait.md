# Test 01 — Портрет (максимальная детализация лица)

Статус: v1 REJECTED, v2 REJECTED (фидбэк: «слишком самостоятельно») → **v3 запущен**
Модель: v1 — кандидат 1/2, v2 — кандидат 2/2 (режим сравнения)
Файлы: v1 — `test01_portrait_v1.png`, v2 — `test01_portrait_v2.png`, v3 — `test01_portrait_v3.png`

## Prompt v3 (EN) — ТЕКУЩИЙ (Style Replication Protocol)

**Референсы (images):** `Style/references/style_ref_01_fullbody.png`
(первый портрет — только основной референс; ref_02 добавляется с test03)

Chest-up portrait. Our character is a completely different woman from the characters in the
attached reference images — do not copy their faces, hair colors or identities; use the reference
images ONLY as the target art style.

Subject: a beautiful mature anime woman in her late 20s, long dark chocolate-brown slightly wavy
hair reaching her lower back, large expressive crimson-red anime eyes, warm lightly tanned
sun-kissed skin with a warm olive undertone, elegant mature facial features with a soft defined
jawline, delicate arched eyebrows, slender nose and full lips, voluptuous hourglass figure with a
narrow defined waist and wide hips.

Composition: face turned slightly toward the viewer, warm confident soft smile, head barely
off-axis; waist-length wavy hair over one shoulder with strong bright glossy highlight bands and
distinct strand clumps. Large bright open anime eyes with glassy radial-gradient crimson irises,
large upper highlight, limbal ring, clean thick upper lash line; simple small nose, small plump
glossy lips, soft round cheeks with subtle blush. She wears a simple black off-shoulder top with a
delicate neckline. No jewelry, no accessories. Dark neutral backdrop, soft studio key light with
gentle rim light on the hair, low-contrast elegant lighting.

Style: in EXACTLY the art style of the attached reference images — same lineart character, same
shading method, same rendering quality, same lighting, same clean high-clarity color palette.
Reproduce the style faithfully, do not invent a new style. Thin uniform warm dark lineart,
bright airy cel shading with soft warm gradients and subtle ambient occlusion, smooth glossy skin
with minimal texture, crisp polished official game artwork.

### Изменения v2 → v3 (по фидбэку пользователя — протокольное изменение, а не микро-правка)
1. **Протокол:** референсные изображения приложены к генерации как основной визуальный ориентир
   (images-параметр) + дословная формула «in EXACTLY the art style of the attached reference
   images» + запрет копировать персонажей с референсов.
2. **Микро-признаки стиля** вместо generic-тегов: bright open eyes with glassy radial-gradient
   iris + large upper highlight; thin uniform warm dark lineart; bright airy cel shading; strong
   bright hair highlight bands; clean high-clarity palette; black clothing.
3. **Канон-ограничители:** no jewelry/no accessories; simple black off-shoulder top (чёрная
   база палитры референсов); dark neutral backdrop.

## Prompt v2 (EN) — отклонён (архив)

Ultra-detailed chest-up portrait of a beautiful mature anime woman in her late 20s, long dark
chocolate-brown slightly wavy hair reaching her lower back, large expressive crimson-red anime eyes,
warm lightly tanned sun-kissed skin with a healthy warm olive undertone, elegant mature facial
features with a soft defined jawline, delicate arched eyebrows, slender nose and full lips,
voluptuous hourglass figure with a narrow defined waist and wide hips. Her face is turned slightly
toward the viewer with a calm, confident smile; head barely off-axis. Waist-length wavy hair
cascades over one shoulder, glossy strands with strong highlight bands and fine separation.
Refined crimson irises with layered highlights, smooth warm skin with soft blush. Dark teal
gradient studio backdrop with soft bokeh. Premium anime game character art in the style of
high-end anime game CG, clean consistent dark lineart, flat cel shading with soft airbrushed
gradients and subtle ambient occlusion, smooth glossy skin with warm tone and minimal texture,
large detailed anime eyes with layered iris highlights, glossy wavy hair with strong highlight
bands and fine strand separation, soft studio key light with gentle rim light, low-contrast
elegant lighting, polished official game artwork.

## Changelog

- v1 — generic premium CG prompt. **REJECTED** (semi-realistic drift, pale skin).
- v2 — Style Anchor v2. **REJECTED** (фидбэк: слишком самостоятельно, отличалось от манеры
  референсов — глаза, линия, палитра).
- v3 — Style Replication Protocol: референсы как визуальный ориентир + микро-признаки +
  чёрный top без ювелирки. Запущен 2026-11-04.
