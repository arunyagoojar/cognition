import assert from 'node:assert/strict';
import { buildPracticeInsights } from '../src/utils/focusedPractice.js';

const objective = Object.fromEntries([1,2,3].flatMap(part => Array.from({length:4},(_,i)=>[`${part}-${i}`,{part,questionType:'multiple_choice',finalResult:'INCORRECT'}])));
const examples = {
  reading:{itemResults:objective},
  listening:{itemResults:objective},
  writing:{task1Band:7.5,task2Band:5},
  speaking:{transcripts:{'0_0':'I live near my family.','1_0':'We was travelling to the mountains.','2_0':'Public transport helps people reach work.'},partDiagnostics:{part2:{needsPractice:true,evidence:'We was travelling to the mountains.',reason:'Agreement needs attention.',nextAction:'Use the corrected form in another answer.'}}},
};
for(const [skill,result] of Object.entries(examples)) {
  const otherSkill=skill==='reading'?'listening':'reading';
  const recent=Array.from({length:41},(_,i)=>({id:`${otherSkill}-${i}`,type:otherSkill,status:'completed',[otherSkill]:{band:9}}));
  const source={id:`older-${skill}`,type:skill,status:'completed',testId:100,[skill]:result};
  const before=structuredClone([...recent,source]);
  const model=buildPracticeInsights([...recent,source]);
  const found=model.recommendations.filter(item=>item.skill===skill);
  assert(found.length>0,`Recent ${otherSkill} tests must not hide ${skill}'s most recent detailed result.`);
  assert(model.bySkill[skill].hasDetailedResults);
  assert(!model.missingDetailedSkills.includes(skill));
  assert(found.every(item=>item.sourceAttemptId===source.id));
  assert.deepEqual([...recent,source],before);
  console.log(`✓ ${skill}: recommendations retain the skill's own evidence after 41 tests in another skill`);
}
