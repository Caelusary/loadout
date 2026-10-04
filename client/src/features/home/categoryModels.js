import { PlugsConnected, Headphones, Keyboard, Mouse, Rectangle, Webcam } from '@phosphor-icons/react';

// The hero shows one model per category, never a specific product.
// `modelUrl` reuses a seed product's Sketchfab .glb (credits in README); if it fails to load,
// the procedural model for `stand` renders instead. `fill` is the share of the
// stage frame the model may use, so small gear (a mouse) doesn't blow up to keyboard size.
export const CATEGORY_MODELS = {
  keyboard: {
    icon: Keyboard,
    blurb: 'Switches and layouts',
    fill: 1,
    shot: 'northpaw-aster-75-wireless',
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
    modelUrl: '/products/models/glide-vane-pro.glb',
    stand: { _id: 'category-mouse', category: 'mouse', name: 'Mouse', specs: { weightGrams: 60 } },
  },
  headset: {
    icon: Headphones,
    blurb: 'Wired or wireless',
    fill: 0.9,
    shot: 'hush-veil-wireless',
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
    modelUrl: '/products/models/hush-frame-4k.glb',
    stand: { _id: 'category-webcam', category: 'webcam', name: 'Webcam', specs: { resolution: '4k' } },
  },
  mousepad: {
    icon: Rectangle,
    blurb: 'Cloth or speed',
    fill: 1,
    shot: 'glide-cloth-xl',
    modelUrl: '/products/models/glide-cloth-xl.glb',
    stand: { _id: 'category-mousepad', category: 'mousepad', name: 'Mousepad', specs: { weightGrams: 430 } },
  },
  accessory: {
    icon: PlugsConnected,
    blurb: 'Cables and numpads',
    fill: 0.85,
    shot: 'northpaw-coiled-usb-c-cable',
    modelUrl: '/products/models/northpaw-coiled-usb-c-cable.glb',
    stand: { _id: 'category-accessory', category: 'accessory', name: 'Coiled cable', specs: {} },
  },
};

export const categoryModel = (category) => {
  const entry = CATEGORY_MODELS[category];
  return entry.modelUrl ? { ...entry.stand, modelUrl: entry.modelUrl } : entry.stand;
};
