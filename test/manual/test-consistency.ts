// D-FUMT 全理論 整合性レポート
import { DFUMTConsistencyChecker } from '../../src/axiom-os/dfumt-consistency-checker';

const checker = new DFUMTConsistencyChecker();
const report = checker.checkAll();
console.log(checker.formatReport(report));
