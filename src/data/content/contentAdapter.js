/**
 * Content Adapter
 * Maps the canonical V2 manifest format directly into the shape expected by the UI modules.
 * This completely shields the UI from needing to know about V2 schemas.
 */

function formatAudioPath(path) {
  if (!path) return '';
  if (path.startsWith('assets/')) {
    return `/src/data/canonical/v2/${path}`;
  }
  return path;
}

import { sanitizeSourceHtml, parseOptions, deriveInputType } from './contentModel.js';

export function getListeningTestAdapter(manifest, includeAnswers = false) {
  if (!manifest || manifest.status !== 'OK' || !manifest.modules?.listening) {
    return {
      testId: 'error-empty',
      title: 'Content Unavailable',
      isRandomized: false,
      durationMinutes: 32,
      parts: []
    };
  }

  const { listening } = manifest.modules;
  const sections = listening.sections || [];

  return {
    testId: manifest.generationId,
    title: `IELTS Listening - ${manifest.generationId}`,
    isRandomized: manifest.mode === 'dynamic_practice',
    audioUrl: formatAudioPath(sections[0]?.audio),
    durationMinutes: 32,
    parts: sections.map((sec, idx) => {
      // Map questions from the canonical groups
      const allQuestions = [];
      if (sec.section.question_groups) {
        sec.section.question_groups.forEach(g => {
          if (g.questions) {
            g.questions.forEach(q => {
              allQuestions.push({
                id: q.question_id || q.id || `q-${idx}-${allQuestions.length}`,
                prompt: q.question_text || q.prompt || '',
                questionNumber: q.question_number || (allQuestions.length + 1),
                questionType: q.type || 'fill_in_blank',
                questionText: q.question_text || q.prompt || '',
                options: q.options || null,
                suffix: q.suffix || '',
                answer: includeAnswers ? (q.correct_answer || '') : null
              });
            });
          }
        });
      }

      // Preserve question group structure
      const formattedGroups = [];
      if (sec.section.question_groups) {
        sec.section.question_groups.forEach((g, gIdx) => {
          const parsedGroupOptions = parseOptions(g.options) || null;
          
          const groupQuestions = (g.questions || []).map(q => {
            const parsedQOptions = parseOptions(q.options) || parsedGroupOptions;
            return {
              id: q.question_id || q.id || `q-${idx}-${gIdx}-${q.question_number}`,
              prompt: q.question_text || q.prompt || '',
              questionNumber: q.question_number,
              questionType: q.type || 'fill_in_blank',
              inputType: deriveInputType(q.type || 'fill_in_blank'),
              questionText: q.question_text || q.prompt || '',
              options: parsedQOptions,
              suffix: q.suffix || '',
              answer: includeAnswers ? (q.correct_answer || '') : null
            };
          });
          allQuestions.push(...groupQuestions);

          formattedGroups.push({
            groupType: g.group_type || 'unknown',
            instructions: g.instructions || '',
            htmlContent: sanitizeSourceHtml(g.shared_content_html || ''),
            options: parsedGroupOptions,
            questions: groupQuestions
          });
        });
      }

      return {
        id: `${manifest.generationId}-part${idx + 1}`,
        part: sec.sectionNumber || idx + 1,
        title: `Section ${sec.sectionNumber || idx + 1}`,
        instructions: 'Answer the questions.',
        context: '',
        audioFile: formatAudioPath(sec.audio),
        htmlContent: sanitizeSourceHtml(formattedGroups.map(g => g.htmlContent).join('<br/><br/>')),
        questions: allQuestions,
        questionGroups: formattedGroups
      };
    })
  };
}

export function getReadingTestAdapter(manifest) {
  if (!manifest || manifest.status !== 'OK' || !manifest.modules?.reading) {
    return {
      testId: 'error-empty',
      title: 'Content Unavailable',
      isRandomized: false,
      durationMinutes: 60,
      passages: []
    };
  }

  const { reading } = manifest.modules;
  const passages = reading.passages || [];

  return {
    testId: manifest.generationId,
    title: `IELTS Reading - ${manifest.generationId}`,
    isRandomized: manifest.mode === 'dynamic_practice',
    durationMinutes: 60,
    passages: passages.map((pas, idx) => {
      const allQuestions = [];
      const formattedGroups = [];

      if (pas.passage.question_groups) {
        pas.passage.question_groups.forEach((g, gIdx) => {
          const parsedGroupOptions = parseOptions(g.options) || null;
          
          const groupQuestions = [];
          if (g.questions) {
            g.questions.forEach(q => {
              const parsedQOptions = parseOptions(q.options) || parsedGroupOptions;
              const qData = {
                id: q.question_id || q.id || `q-${idx}-${gIdx}-${allQuestions.length}`,
                prompt: q.question_text || q.prompt || '',
                questionNumber: q.question_number || (allQuestions.length + 1),
                questionType: q.type || 'fill_in_blank',
                inputType: deriveInputType(q.type || 'fill_in_blank'),
                questionText: q.question_text || q.prompt || '',
                options: parsedQOptions,
                suffix: q.suffix || '',
                answer: q.correct_answer || ''
              };
              groupQuestions.push(qData);
              allQuestions.push(qData);
            });
          }

          formattedGroups.push({
            groupType: g.group_type || 'unknown',
            instructions: g.instructions || '',
            htmlContent: sanitizeSourceHtml(g.shared_content_html || ''),
            options: parsedGroupOptions,
            questions: groupQuestions
          });
        });
      }

      return {
        id: `${manifest.generationId}-pass${idx + 1}`,
        passageNumber: pas.passageNumber || idx + 1,
        title: pas.passage.title || `Passage ${idx + 1}`,
        htmlContent: sanitizeSourceHtml(pas.passage.content_html || ''),
        questions: allQuestions,
        questionGroups: formattedGroups
      };
    })
  };
}

export function getWritingTestAdapter(manifest) {
  if (!manifest || manifest.status !== 'OK' || !manifest.modules?.writing) {
    return { testId: 'error-empty', title: 'Unavailable', isRandomized: false, tasks: [] };
  }

  const { writing } = manifest.modules;
  const tasks = writing.tasks || [];
  
  const t1 = tasks.find(t => t.taskNumber === 1);
  const t2 = tasks.find(t => t.taskNumber === 2);

  const formatTask = (t) => {
    if (!t) return { instructions: '', promptHtml: '' };
    // Replace image paths in html if needed
    let html = t.task.prompt_html || '';
    if (t.task.images) {
      t.task.images.forEach(img => {
        if (img.canonical_path) {
          html += `<br/><img src="/src/data/canonical/v2/${img.canonical_path}" style="max-width: 100%;" />`;
        }
      });
    }
    return {
      id: `${manifest.generationId}-t${t.taskNumber}`,
      instructions: t.task.word_requirement || '',
      promptHtml: html
    };
  };

  return {
    testId: manifest.generationId,
    title: `IELTS Writing - ${manifest.generationId}`,
    isRandomized: manifest.mode === 'dynamic_practice',
    durationMinutes: 60,
    task1: formatTask(t1),
    task2: formatTask(t2)
  };
}

export function getSpeakingTestAdapter(manifest) {
  if (!manifest || manifest.status !== 'OK' || !manifest.modules?.speaking) {
    return { testId: 'error-empty', title: 'Unavailable', isRandomized: false, parts: [] };
  }

  const { speaking } = manifest.modules;
  const pkg = speaking.package;

  // Since most V2 Speaking packages are cue cards (Part 2), we'll adapt it directly.
  return {
    testId: manifest.generationId,
    title: `IELTS Speaking - ${manifest.generationId}`,
    isRandomized: manifest.mode === 'dynamic_practice',
    parts: [
      {
        part: pkg.part || 'Part 2',
        instructions: pkg.topic || 'Describe the topic.',
        prompts: pkg.prompts || [pkg.supporting_text || pkg.content_type]
      }
    ]
  };
}
