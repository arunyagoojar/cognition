import {
  getPackagesByTestType,
  getAllSpeakingPackages
} from './contentRepository.js';

/**
 * Validates a listening section to ensure it is structurally sound.
 */
function isValidListeningSection(section) {
  if (!section) return false;
  if (!section.audio || !section.audio.exists || !section.audio.canonical_path) return false;
  if (!section.question_groups || section.question_groups.length === 0) return false;
  
  // Ensure at least some questions exist
  const hasQuestions = section.question_groups.some(g => g.questions && g.questions.length > 0);
  if (!hasQuestions) return false;
  
  return true;
}

/**
 * Validates a reading passage.
 */
function isValidReadingPassage(passage) {
  if (!passage) return false;
  if (!passage.question_groups || passage.question_groups.length === 0) return false;
  const hasQuestions = passage.question_groups.some(g => g.questions && g.questions.length > 0);
  if (!hasQuestions) return false;
  
  return true;
}

/**
 * Returns an array of valid Listening Sections matching the given sectionNumber and testType.
 * Each item returned has { packageId, section }
 */
export function getValidListeningSections(sectionNumber, testType) {
  const packages = getPackagesByTestType('listening', testType);
  const validSections = [];
  
  for (const pkg of packages) {
    if (pkg.validation_state !== 'VERIFIED') continue;
    if (!pkg.sections) continue;
    
    for (const sec of pkg.sections) {
      if (sec.section_number === sectionNumber && isValidListeningSection(sec)) {
        validSections.push({
          packageId: pkg.canonical_id,
          section: sec
        });
      }
    }
  }
  
  return validSections;
}

/**
 * Returns an array of valid Reading Passages matching the given passageNumber and testType.
 * Each item returned has { packageId, passage }
 */
export function getValidReadingPassages(passageNumber, testType) {
  const packages = getPackagesByTestType('reading', testType);
  const validPassages = [];
  
  for (const pkg of packages) {
    if (pkg.validation_state !== 'VERIFIED') continue;
    if (!pkg.passages) continue;
    
    for (const pas of pkg.passages) {
      if (pas.passage_number === passageNumber && isValidReadingPassage(pas)) {
        validPassages.push({
          packageId: pkg.canonical_id,
          passage: pas
        });
      }
    }
  }
  
  return validPassages;
}

/**
 * Returns valid Writing Tasks (Task 1 or Task 2).
 */
export function getValidWritingTasks(taskNumber, testType) {
  const packages = getPackagesByTestType('writing', testType);
  const validTasks = [];
  
  for (const pkg of packages) {
    if (pkg.validation_state !== 'VERIFIED') continue;
    if (!pkg.tasks) continue;
    
    for (const t of pkg.tasks) {
      if (t.task_number === taskNumber) {
        // Image validation for Task 1
        let valid = true;
        if (taskNumber === 1 && t.images) {
          for (const img of t.images) {
            if (!img.exists || !img.canonical_path) valid = false;
          }
        }
        if (valid) {
          validTasks.push({
            packageId: pkg.canonical_id,
            task: t
          });
        }
      }
    }
  }
  
  return validTasks;
}

/**
 * Returns valid Speaking Packages.
 */
export function getValidSpeakingPackages() {
  // Speaking test types are usually UNKNOWN so we don't strictly filter by testType yet
  const packages = getAllSpeakingPackages();
  const valid = [];
  
  for (const pkg of packages) {
    if (pkg.validation_state !== 'VERIFIED') continue;
    valid.push(pkg);
  }
  
  return valid;
}
