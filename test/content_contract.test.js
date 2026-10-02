import { sanitizeSourceHtml, parseOptions, deriveInputType } from '../src/data/content/contentModel.js';
import { getListeningTestAdapter } from '../src/data/content/contentAdapter.js';
import assert from 'assert';

try {
  // Test sanitizeSourceHtml
  assert.strictEqual(sanitizeSourceHtml('<input type="text" name="fname"/>'), '______');
  assert.strictEqual(sanitizeSourceHtml('some <input type="radio"> text'), 'some  text');
  
  // Test deriveInputType
  assert.strictEqual(deriveInputType('multiple_choice'), 'single_select');
  assert.strictEqual(deriveInputType('fill_in_blank'), 'text');
  
  // Test parseOptions
  assert.deepStrictEqual(parseOptions(['A museum', 'B castle']), [{ id: 'A', label: 'museum' }, { id: 'B', label: 'castle' }]);
  assert.deepStrictEqual(parseOptions(['TRUE', 'FALSE']), [{ id: 'TRUE', label: 'TRUE' }, { id: 'FALSE', label: 'FALSE' }]);

  console.log('Contract validation passed.');
} catch(e) {
  console.error('Contract validation failed.', e);
  process.exit(1);
}
