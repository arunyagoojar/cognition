import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const v3Path = path.join(__dirname, '../src/data/content-v3');
const rawHtmlPath = '/Users/arunyagoojar/Downloads/ielts-website';

function checkReadingSemantics() {
    console.log("==========================================");
    console.log("7. Semantic Reading Audit (Sample of 50)");
    console.log("==========================================");
    const testsPath = path.join(v3Path, 'reading', 'tests');
    const jsonFiles = fs.readdirSync(testsPath).filter(f => f.endsWith('.json'));
    
    let allQuestions = [];
    for (const file of jsonFiles) {
        const data = JSON.parse(fs.readFileSync(path.join(testsPath, file), 'utf8'));
        if (data.questions) {
            allQuestions = allQuestions.concat(data.questions);
        }
    }
    
    const sampleSize = 50;
    let valid = 0;
    let errors = [];
    
    for (let i = 0; i < sampleSize; i++) {
        const q = allQuestions[i * Math.floor(allQuestions.length / sampleSize)];
        let isValid = true;
        let err = [];
        if (!q.prompt || q.prompt.length < 5) { isValid = false; err.push('Prompt too short'); }
        if (q.inputType === 'SINGLE_SELECT' || q.inputType === 'MULTI_SELECT') {
            if (!q.options || q.options.length < 2) { isValid = false; err.push('Missing options for MCQ'); }
        }
        if (isValid) valid++;
        else errors.push({ id: q.id, err });
    }
    
    console.log(`Sampled 50 Reading questions.`);
    console.log(`Semantically valid: ${valid}/50`);
    if (errors.length > 0) console.log(`Errors:`, errors);
}

function checkWritingTasks() {
    console.log("\n==========================================");
    console.log("8. Writing Task Visual/Semantic Validation");
    console.log("==========================================");
    const t1Path = path.join(v3Path, 'writing', 'task1');
    if (fs.existsSync(t1Path)) {
        const files = fs.readdirSync(t1Path).filter(f => f.endsWith('.json'));
        console.log(`Found ${files.length} Task 1 files.`);
        let validVisuals = 0;
        for (const file of files) {
            const data = JSON.parse(fs.readFileSync(path.join(t1Path, file), 'utf8'));
            if (data.visual && data.visual.type === 'TABLE' && data.visual.tableData) {
                if (data.visual.tableData.rows && data.visual.tableData.rows.length > 0) {
                    validVisuals++;
                }
            }
        }
        console.log(`Task 1 with valid structured table data: ${validVisuals}/${files.length}`);
    } else {
        console.log("No writing task 1 found.");
    }
}

function checkListeningAudio() {
    console.log("\n==========================================");
    console.log("5b. Listening Audio Duplication Check");
    console.log("==========================================");
    const testsPath = path.join(v3Path, 'listening', 'tests');
    const jsonFiles = fs.readdirSync(testsPath).filter(f => f.endsWith('.json'));
    
    const audioMap = new Map();
    for (const file of jsonFiles) {
        const data = JSON.parse(fs.readFileSync(path.join(testsPath, file), 'utf8'));
        if (data.sections && data.sections.length > 0) {
            const audioPath = data.sections[0].audio.path;
            if (audioMap.has(audioPath)) {
                audioMap.get(audioPath).push(file);
            } else {
                audioMap.set(audioPath, [file]);
            }
        }
    }
    
    for (const [audio, tests] of audioMap.entries()) {
        if (tests.length > 1) {
            console.log(`Audio ${audio} is shared by tests:`, tests);
        }
    }
}

function readOneSpeakingFile() {
    console.log("\n==========================================");
    console.log("9. Speaking Hallucination Check");
    console.log("==========================================");
    const speakingDir = path.join(rawHtmlPath, 'ielts-speaking-cue-card-1');
    const file = path.join(speakingDir, 'index.html');
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        console.log(`File: ${file}`);
        console.log(`Contains 'cue card': ${content.toLowerCase().includes('cue card')}`);
        console.log(`Contains 'model answer': ${content.toLowerCase().includes('model answer')}`);
        console.log("Sample content (first 500 chars of body):");
        const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
            console.log(bodyMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 500));
        }
    } else {
        console.log("Test speaking file not found.");
    }
}

checkReadingSemantics();
checkWritingTasks();
checkListeningAudio();
readOneSpeakingFile();
