/**
 * contentModel.js
 * 
 * Defines the normalized runtime contract between canonical JSON and React components.
 * 
 * 1. Strips interactive/source-specific HTML tags (inputs, radio, select).
 * 2. Establishes a strict separation of 'question type' (semantic) and 'input type' (UI interaction).
 * 3. Formalizes group ownership over options and instructions.
 */

export function sanitizeSourceHtml(html) {
  if (!html) return '';
  let clean = html;
  // Remove option inputs (e.g., radio buttons with A/B/C labels) FIRST
  clean = clean.replace(/<input[^>]*type=["'](?:radio|checkbox)["'][^>]*>/gi, '');
  // Remove form inputs
  clean = clean.replace(/<input[^>]*>/gi, '______');
  clean = clean.replace(/<select[^>]*>[\s\S]*?<\/select>/gi, '______');
  clean = clean.replace(/<textarea[^>]*>[\s\S]*?<\/textarea>/gi, '______');
  // Remove buttons
  clean = clean.replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '');
  
  // Clean up any double blank spaces
  clean = clean.replace(/(_{6,})/g, '______');
  return clean;
}

export function parseOptions(optionsArray) {
  if (!optionsArray || !Array.isArray(optionsArray)) return null;
  // Convert string options into structured objects
  // Expected input: ["A museum", "B castle", "C fireworks"] or just ["True", "False"]
  return optionsArray.map(opt => {
    if (typeof opt !== 'string') return opt;
    
    // Check if it starts with A-Z followed by space (e.g., "A museum")
    const match = opt.match(/^([A-Z])[\.\s]+(.+)$/);
    if (match) {
      return { id: match[1], label: match[2].trim() };
    }
    
    return { id: opt, label: opt };
  });
}

export function deriveInputType(questionType) {
  switch(questionType) {
    case 'multiple_choice':
    case 'true_false_not_given':
    case 'yes_no_not_given':
    case 'matching':
      return 'single_select';
    case 'multiple_selection':
      return 'multi_select';
    case 'fill_in_blank':
    case 'form_completion':
    case 'note_completion':
    case 'sentence_completion':
    case 'table_completion':
    case 'short_answer':
      return 'text';
    case 'map_labeling':
      return 'map_select';
    default:
      return 'unknown';
  }
}
