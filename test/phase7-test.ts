/**
 * Phase 7a/7b Test
 */

import { DFUMTTaskManager } from '../src/agi/dfumt-task-manager';
import { getAllProcessors, SubterraneanProcessor } from '../src/agi/persona-task-processor';
import { ALIEN_INTELLIGENCE_DB, getAlienPersona, getUnifiedFormula } from '../src/aios/historians/alien-intelligence-personas';

async function runTests() {
  console.log('=== Phase 7 Tests ===\n');
  let passed = 0; let failed = 0;

  const assert = (cond: boolean, msg: string) => {
    if (cond) { console.log(`  \u2713 ${msg}`); passed++; }
    else { console.error(`  \u2717 ${msg}`); failed++; }
  };

  // Test 1: Persona definitions
  console.log('--- 1. Alien Intelligence Personas ---');
  assert(ALIEN_INTELLIGENCE_DB.length === 5, '5 personas defined');
  assert(getAlienPersona('ANCIENT') !== undefined, 'Ancient persona exists');
  assert(getAlienPersona('ALIEN')?.dfumtValue === 'INFINITY', 'Alien D-FUMT value is INFINITY');
  assert(getAlienPersona('SUBTERRANEAN')?.dfumtValue === 'ZERO', 'Subterranean D-FUMT value is ZERO');
  assert(getAlienPersona('EXTRADIMENSIONAL')?.dfumtValue === 'FLOWING', 'Extradimensional D-FUMT value is FLOWING');
  assert(getAlienPersona('INFINITE')?.dfumtValue === 'TRUE', 'Infinite D-FUMT value is TRUE');
  assert(getUnifiedFormula().includes('fix'), 'Unified formula contains fix');
  assert([...ALIEN_INTELLIGENCE_DB.map(p => p.theoryId)].every((id, i, arr) => arr.indexOf(id) === i), 'Theory IDs are unique (71-75)');

  // Test 2: Phase 7a Task Manager
  console.log('\n--- 2. DFUMT Task Manager (Phase 7a) ---');
  const manager = new DFUMTTaskManager();
  const task = manager.createTask({ title: 'test task', depth: 5, probability: 0.8 });
  assert(task.state === '\uff5e', 'Initial state is \uff5e (pending)');

  manager.transitionState(task.id, '\u221e', 'execution start');
  const t2 = manager.getAllTasks().find(t => t.id === task.id)!;
  assert(t2.state === '\u221e', 'Transition to \u221e (in progress)');
  assert(t2.stateHistory.length === 1, 'State history recorded');

  manager.transitionState(task.id, '\u22a4', 'completed');
  assert(manager.getAllTasks().find(t => t.id === task.id)!.state === '\u22a4', 'Transition to \u22a4 (complete)');

  // Invalid transition test
  const task2 = manager.createTask({ title: 'transition test' });
  manager.transitionState(task2.id, '\u221e');
  manager.transitionState(task2.id, '\u22a4');
  let threw = false;
  try { manager.transitionState(task2.id, '\u221e'); } catch { threw = true; }
  assert(threw, 'Error on transition from terminal state');

  // Test 3: Phase 7b Processors
  console.log('\n--- 3. Persona Task Processors (Phase 7b) ---');
  const processors = getAllProcessors();
  assert(processors.length === 5, '5 processors exist');

  const procTask = manager.createTask({ title: 'processing test', depth: 7, probability: 0.8, dimension: 4 });
  manager.transitionState(procTask.id, '\u221e');

  for (const proc of processors) {
    const result = await proc.process(procTask);
    assert(result.processorId === proc.personaId, `${proc.personaName} processes correctly`);
    assert(result.processingTimeMs >= 0, `${proc.personaName} processing time measured`);
    assert(result.output.length > 0, `${proc.personaName} output exists`);
  }

  // Test 4: Priority sorting
  console.log('\n--- 4. Prioritization ---');
  const tasks = [
    manager.createTask({ title: 'A', depth: 2 }),
    manager.createTask({ title: 'B', depth: 8 }),
    manager.createTask({ title: 'C', depth: 5 }),
  ];
  const sorted = new SubterraneanProcessor().prioritize(tasks);
  assert(sorted[0].depth! >= sorted[1].depth!, 'Subterranean sorts by depth descending');
  assert(sorted[1].depth! >= sorted[2].depth!, 'Subterranean sort is consistent');

  // Test 5: Task evaluation
  console.log('\n--- 5. Task Evaluation ---');
  const evalTask = manager.createTask({ title: 'evaluation test', depth: 6, probability: 0.75 });
  manager.transitionState(evalTask.id, '\u221e');
  manager.transitionState(evalTask.id, '\u22a4');
  const eval_ = manager.evaluateTask(evalTask.id);
  assert(eval_.state === '\u22a4', 'Evaluation retrieves task state');
  assert(eval_.personaEvaluation.ANCIENT !== undefined, 'Ancient evaluation exists');
  assert(eval_.infiniteEvaluation.includes('U = fix(U)'), 'Infinite evaluation contains U=fix(U)');
  assert(eval_.dimensionalAnalysis.dimension4 === true, 'Completed task succeeds in 4th dimension');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed === 0 ? 0 : 1);
}

runTests().catch(e => { console.error(e); process.exit(1); });
