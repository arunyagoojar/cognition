import { V2_BUNDLE, V2_INDEX } from './browser_bundle.js';

let cachedIndex = V2_INDEX;

function getIndex() {
  return cachedIndex;
}

function loadPackage(moduleName, id) {
  return V2_BUNDLE[moduleName]?.[id] || null;
}

// Listening
export function getAllListeningPackages() {
  const index = getIndex();
  return index.modules.listening.map(entry => loadPackage('listening', entry.id)).filter(Boolean);
}

export function getListeningPackage(id) {
  return loadPackage('listening', id);
}

// Reading
export function getAllReadingPackages() {
  const index = getIndex();
  return index.modules.reading.map(entry => loadPackage('reading', entry.id)).filter(Boolean);
}

export function getReadingPackage(id) {
  return loadPackage('reading', id);
}

// Writing
export function getAllWritingPackages() {
  const index = getIndex();
  return index.modules.writing.map(entry => loadPackage('writing', entry.id)).filter(Boolean);
}

export function getWritingPackage(id) {
  return loadPackage('writing', id);
}

// Speaking
export function getAllSpeakingPackages() {
  const index = getIndex();
  return index.modules.speaking.map(entry => loadPackage('speaking', entry.id)).filter(Boolean);
}

export function getSpeakingPackage(id) {
  return loadPackage('speaking', id);
}

// Selectors / Helpers
export function getPackagesByTestType(moduleName, testType) {
  const index = getIndex();
  const entries = index.modules[moduleName] || [];
  return entries
    .filter(entry => entry.test_type === testType)
    .map(entry => loadPackage(moduleName, entry.id))
    .filter(Boolean);
}

export function getVerifiedPackages(moduleName) {
  const index = getIndex();
  const entries = index.modules[moduleName] || [];
  return entries.map(entry => loadPackage(moduleName, entry.id)).filter(Boolean);
}

export function getPackagesWithAudio() {
  const allListening = getAllListeningPackages();
  return allListening.filter(pkg => 
    pkg.sections && pkg.sections.some(sec => sec.audio && sec.audio.canonical_path)
  );
}

export function getPackagesWithImages(moduleName) {
  if (moduleName === 'reading') {
    return getAllReadingPackages().filter(pkg => 
      pkg.passages && pkg.passages.some(p => p.images && p.images.length > 0)
    );
  } else if (moduleName === 'writing') {
    return getAllWritingPackages().filter(pkg => 
      pkg.tasks && pkg.tasks.some(t => t.images && t.images.length > 0)
    );
  }
  return [];
}
