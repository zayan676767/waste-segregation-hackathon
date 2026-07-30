# Sample photos (camera-free fallback)

Drop 4 photos in this folder named:

```
sample-1.jpg
sample-2.jpg
sample-3.jpg
sample-4.jpg
```

`.jpeg`, `.png` and `.webp` also work, and slots 5 and 6 are picked up too if
present. Whichever files exist are shown automatically — no code change needed.

## They must be real photographs

The classifier is MobileNet, which recognises **real objects**. A drawing, icon
or placeholder graphic will not classify correctly. Good choices:

| File | Suggested subject | Expected category |
| ---- | ----------------- | ----------------- |
| `sample-1.jpg` | plastic water bottle | Recyclable |
| `sample-2.jpg` | banana or apple | Biodegradable |
| `sample-3.jpg` | battery, old phone or charger | Hazardous |
| `sample-4.jpg` | cardboard box | Recyclable |

Clear, well-lit, single object on a plain background works best.

## Why this mode matters

It is the demo's hard fallback. It works when camera permission is denied, when
there is no camera at all, and when the page is served over plain http where
browsers block `getUserMedia` entirely.
