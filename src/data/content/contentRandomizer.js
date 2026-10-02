export function createPrng(seed = "default-seed") {
  // Simple string hasher for seed initialization
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(31, hash) + seed.charCodeAt(i) | 0;
  }
  let s = hash >>> 0;
  
  // Mulberry32
  return function next() {
    let t = (s += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickWithPrng(array, prng) {
  if (!Array.isArray(array) || array.length === 0) return null;
  const idx = Math.floor(prng() * array.length);
  return array[idx];
}
