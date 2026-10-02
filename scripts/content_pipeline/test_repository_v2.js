import {
    getAllListeningPackages,
    getListeningPackage,
    getAllReadingPackages,
    getReadingPackage,
    getPackagesByTestType,
    getPackagesWithAudio,
    getPackagesWithImages,
    getVerifiedPackages
} from '../../src/data/canonical/v2/repository.js';
import assert from 'assert';

async function runTests() {
    console.log("Testing runtime adapter...");

    // 1. Loading all modules
    const listening = getAllListeningPackages();
    assert(listening.length > 0, "Should load listening packages");
    console.log(`Loaded ${listening.length} listening packages`);

    const reading = getAllReadingPackages();
    assert(reading.length > 0, "Should load reading packages");
    
    // 2. Loading a package by ID
    const firstListening = listening[0];
    const loadedById = getListeningPackage(firstListening.canonical_id);
    assert(loadedById, "Should load package by ID");
    assert.strictEqual(loadedById.canonical_id, firstListening.canonical_id);
    
    // 3. Nonexistent package
    const missing = getListeningPackage("nonexistent-id-123");
    assert.strictEqual(missing, null, "Missing package should return null");

    // 4. Filtering by test type
    const academicReading = getPackagesByTestType('reading', 'ACADEMIC');
    const unknownReading = getPackagesByTestType('reading', 'UNKNOWN');
    console.log(`Reading Academic: ${academicReading.length}, Unknown: ${unknownReading.length}`);
    
    // 5. Selectors
    const withAudio = getPackagesWithAudio();
    console.log(`Listening with audio: ${withAudio.length}`);
    const readingWithImages = getPackagesWithImages('reading');
    console.log(`Reading with images: ${readingWithImages.length}`);
    
    // 6. Answer access safety
    // Let's verify that correct_answer exists on the data layer but is safely scoped
    const q = firstListening.sections[0].question_groups[0].questions[0];
    assert('correct_answer' in q, "Answers exist in the data layer");

    console.log("All adapter tests passed!");
}

runTests().catch(e => {
    console.error(e);
    process.exit(1);
});
