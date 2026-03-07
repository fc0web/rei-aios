// PrometheusProtocol — 84理論を人間可読形式で表示
import { PrometheusProtocol } from '../../src/axiom-os/prometheus-protocol';

const p = new PrometheusProtocol();

console.log('=== Level 1（七価記号 + 1行）最初の10件 ===');
const report1 = p.descendAll(1, 'human');
for (const packet of report1.packets.slice(0, 10)) {
  console.log(packet.content);
}

console.log('\n=== Level 3（コード例付き、最初の3件）===');
const report3 = p.descendAll(3, 'human');
for (const packet of report3.packets.slice(0, 3)) {
  console.log(packet.content);
  console.log('---');
}
