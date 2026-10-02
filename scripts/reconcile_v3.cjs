const fs = require('fs');
const path = require('path');
const glob = require('glob'); // Need to check if glob is available, or use a custom recursive search

const v3Path = path.join(__dirname, '../src/data/content-v3');
const rawHtmlPath = '/Users/arunyagoojar/Downloads/ielts-website';

function findFiles(dir, ext) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(findFiles(file, ext));
        } else { 
            if (file.endsWith(ext)) results.push(file);
        }
    });
    return results;
}

function analyzeListening() {
    console.log("==========================================");
    console.log("1. Reconciling Listening Counts");
    console.log("==========================================");
    const testsPath = path.join(v3Path, 'listening');
    if (!fs.existsSync(testsPath)) {
        console.log("No listening path found.");
        return;
    }
    const testDirs = fs.readdirSync(testsPath).filter(d => fs.statSync(path.join(testsPath, d)).isDirectory());
    console.log(`Total test directories: ${testDirs.length}`);
    
    let totalSections = 0;
    let testsWith4Sections = 0;
    let testsWithOtherSections = [];
    let allAudioFiles = new Set();
    
    let totalQuestions = 0;
    let inlineBlankErrors = 0;

    for (const testDir of testDirs) {
        const p = path.join(testsPath, testDir);
        const jsonFiles = fs.readdirSync(p).filter(f => f.endsWith('.json'));
        totalSections += jsonFiles.length;
        if (jsonFiles.length === 4) {
            testsWith4Sections++;
        } else {
            testsWithOtherSections.push({ test: testDir, sections: jsonFiles.length });
        }
        
        for (const file of jsonFiles) {
            const data = JSON.parse(fs.readFileSync(path.join(p, file), 'utf8'));
            if (data.audioPath) {
                allAudioFiles.add(data.audioPath);
            }
            if (data.questions) {
                totalQuestions += data.questions.length;
                for (const q of data.questions) {
                    const str = JSON.stringify(q);
                    if (str.includes('[BLANK]') || str.includes('______') || str.includes('_____')) {
                        inlineBlankErrors++;
                    }
                }
            }
        }
    }
    
    console.log(`Total tests with 4 sections: ${testsWith4Sections}`);
    console.log(`Total sections: ${totalSections}`);
    console.log(`Tests with other sections:`, testsWithOtherSections);
    console.log(`Total audio references: ${allAudioFiles.size}`);
    console.log(`Total questions in sections: ${totalQuestions}`);
    console.log(`Questions with [BLANK] or ______: ${inlineBlankErrors}`);
}

function analyzeReading() {
    console.log("\n==========================================");
    console.log("2. Reconciling Reading Counts");
    console.log("==========================================");
    const testsPath = path.join(v3Path, 'reading');
    if (!fs.existsSync(testsPath)) {
        console.log("No reading path found.");
        return;
    }
    const testDirs = fs.readdirSync(testsPath).filter(d => fs.statSync(path.join(testsPath, d)).isDirectory());
    console.log(`Total Reading tests (directories): ${testDirs.length}`);
    
    let totalPassages = 0;
    let totalQuestions = 0;
    
    for (const testDir of testDirs) {
        const p = path.join(testsPath, testDir);
        const jsonFiles = fs.readdirSync(p).filter(f => f.endsWith('.json'));
        totalPassages += jsonFiles.length;
        
        for (const file of jsonFiles) {
            const data = JSON.parse(fs.readFileSync(path.join(p, file), 'utf8'));
            if (data.groups) {
                for (const g of data.groups) {
                    if (g.questions) {
                        totalQuestions += g.questions.length;
                    }
                }
            }
        }
    }
    
    console.log(`Total Reading tests found: ${testDirs.length}`);
    console.log(`Total Reading passages: ${totalPassages}`);
    console.log(`Total Reading questions in tests: ${totalQuestions}`);
}

function checkQuarantineReading() {
    console.log("\n==========================================");
    console.log("3. Investigating Loss of 5 Reading Tests");
    console.log("==========================================");
    const qPath = path.join(v3Path, 'quarantine', 'reading');
    if (fs.existsSync(qPath)) {
        const qFiles = fs.readdirSync(qPath).filter(f => f.endsWith('.json'));
        console.log(`Found ${qFiles.length} files in reading quarantine.`);
        // Just checking unique tests
        const tests = new Set(qFiles.map(f => f.split('_')[0] + '_' + f.split('_')[1]));
        console.log(`Quarantined Reading Tests (approx): ${tests.size}`);
    } else {
        console.log("No reading quarantine found.");
    }
}

function recursiveSpeakingSearch() {
    console.log("\n==========================================");
    console.log("4. Speaking Recursive Search in Source");
    console.log("==========================================");
    // Find all HTML files in raw source that have "speaking" in the path or name
    const allHtml = findFiles(rawHtmlPath, '.html');
    const speakingHtml = allHtml.filter(f => f.toLowerCase().includes('speaking'));
    console.log(`Found ${speakingHtml.length} HTML files related to speaking.`);
    
    let examPrompts = 0;
    let sampleAnswers = 0;
    
    for (const file of speakingHtml) {
        const content = fs.readFileSync(file, 'utf8').toLowerCase();
        if (content.includes('model answer') || content.includes('sample answer')) {
            sampleAnswers++;
        }
        if (content.includes('cue card') || content.includes('describe a')) {
            examPrompts++;
        }
    }
    console.log(`Files containing 'model answer' / 'sample answer': ${sampleAnswers}`);
    console.log(`Files containing 'cue card' / 'describe a' (could be genuine prompts or model answers): ${examPrompts}`);
}

analyzeListening();
analyzeReading();
checkQuarantineReading();
recursiveSpeakingSearch();

