// How far (radians, far edge up) to tip a downloaded .glb toward the camera, by category. Models are
// stored facing front and resting flat, so flat gear (keyboards, pads) needs the most tilt to read at a
// glance. Procedural models are built already posed and ignore this.
export const MODEL_TILT = {
  keyboard: 0.5,
  mouse: 0.35,
  headset: 0.1,
  webcam: 0.1,
  mousepad: 0.75,
  accessory: 0.45,
};
