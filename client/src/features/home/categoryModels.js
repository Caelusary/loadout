import { PlugsConnected, Headphones, Keyboard, Mouse, Rectangle, Webcam } from '@phosphor-icons/react';

// The hero shows one model per category, never a specific product.
// `modelUrl` reuses a seed product's Sketchfab .glb (credits in README); if it fails to load,
// the procedural model for `stand` renders instead. `fill` is the share of the
// stage frame the model may use, so small gear (a mouse) doesn't blow up to keyboard size.
// `shotSize` is the share of its square photo the product covers (width, height; solid pixels, ignoring the
// shared floor shadow) and `shotCm` its real width in centimetres. The photo fallback draws every product at one
// real-world scale (the keyboard spanning most of the stage), shrinking only what would not fit.
// `shotCenter` is the product's centre in its photo (x, y as fractions), so the fallback can centre the product
// itself rather than the photo, whose floor shadow sits below it. Re-measure both if a photo is replaced.
export const CATEGORY_MODELS = {
  keyboard: {
    icon: Keyboard,
    blurb: 'Switches and layouts',
    fill: 1,
    shot: 'northpaw-aster-75-wireless',
    shotSize: [0.72, 0.18],
    shotCm: 32,
    shotCenter: [0.5, 0.51],
    modelUrl: '/products/models/northpaw-aster-75-wireless.glb',
    stand: {
      _id: 'category-keyboard',
      category: 'keyboard',
      name: 'Keyboard',
      specs: { layout: '75', switchType: 'tactile' },
    },
  },
  mouse: {
    icon: Mouse,
    blurb: 'Weight, sensor, DPI',
    fill: 0.58,
    shot: 'glide-vane-pro',
    shotSize: [0.47, 0.33],
    shotCm: 12.5,
    shotCenter: [0.52, 0.57],
    modelUrl: '/products/models/glide-vane-pro.glb',
    stand: { _id: 'category-mouse', category: 'mouse', name: 'Mouse', specs: { weightGrams: 60 } },
  },
  headset: {
    icon: Headphones,
    blurb: 'Wired or wireless',
    fill: 0.9,
    shot: 'hush-veil-wireless',
    shotSize: [0.67, 0.74],
    shotCm: 18,
    shotCenter: [0.46, 0.53],
    modelUrl: '/products/models/hush-veil-wireless.glb',
    stand: {
      _id: 'category-headset',
      category: 'headset',
      name: 'Headset',
      specs: { connectivity: 'wireless' },
    },
  },
  webcam: {
    icon: Webcam,
    blurb: 'Resolution and fps',
    fill: 0.72,
    shot: 'hush-frame-4k',
    shotSize: [0.43, 0.81],
    shotCm: 9,
    shotCenter: [0.52, 0.54],
    modelUrl: '/products/models/hush-frame-4k.glb',
    stand: { _id: 'category-webcam', category: 'webcam', name: 'Webcam', specs: { resolution: '4k' } },
  },
  mousepad: {
    icon: Rectangle,
    blurb: 'Cloth or speed',
    fill: 1,
    shot: 'glide-cloth-xl',
    shotSize: [0.78, 0.37],
    shotCm: 90,
    shotCenter: [0.51, 0.52],
    modelUrl: '/products/models/glide-cloth-xl.glb',
    stand: { _id: 'category-mousepad', category: 'mousepad', name: 'Mousepad', specs: { weightGrams: 430 } },
  },
  accessory: {
    icon: PlugsConnected,
    blurb: 'Cables and numpads',
    fill: 0.85,
    shot: 'northpaw-coiled-usb-c-cable',
    shotSize: [0.63, 0.42],
    shotCm: 16,
    shotCenter: [0.47, 0.55],
    modelUrl: '/products/models/northpaw-coiled-usb-c-cable.glb',
    stand: { _id: 'category-accessory', category: 'accessory', name: 'Coiled cable', specs: {} },
  },
};

export const categoryModel = (category) => {
  const entry = CATEGORY_MODELS[category];
  return entry.modelUrl ? { ...entry.stand, modelUrl: entry.modelUrl } : entry.stand;
};
