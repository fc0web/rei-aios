# Rei-AIOS 🧠

> **世界初** — D-FUMT理論（次元藤本普遍数学理論）と七価論理を基盤とした
> 公理OS。AIが迷ったときの「公理的拠り所」として機能する。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-182%20passed-brightgreen)]()
[![Axioms](https://img.shields.io/badge/axioms-75-orange)]()
[![Compression](https://img.shields.io/badge/compression-6.7%25-red)]()

---

## 📊 現在の成果

| 指標 | 結果 |
|------|------|
| **公理OS圧縮率** | **6.7%**（75理論 → 1,717bytes） |
| **実装済みロードマップ** | **10/10 完了** |
| **テスト数** | **182 passed, 0 failed** |
| **公理理論数** | **75理論** |

---

## 🌟 世界初の機能

### 1. 公理OS（75理論・6.7%圧縮）
D-FUMT 75理論をわずか **1,717バイト**の種（seed）に圧縮。
圧縮された種から完全な公理体系を再生成できる。

```
フルデータ（25,789 bytes）
    ↓ AxiomEncoder + Brotli
圧縮種（1,717 bytes = 6.7%）
    ↓ decompress + TheoryGenerator
75理論 完全復元
```

### 2. 七価論理AI相談システム
AIが推論に迷ったとき、公理チェーンで判断根拠を提示：

| 七価値 | 意味 | AI相談での役割 |
|--------|------|--------------|
| ⊤ | TRUE | 確定的な公理的根拠あり |
| both | BOTH | 矛盾を許容・保留 |
| ～ | FLOWING | 流動的・追加情報待ち |
| 〇 | ZERO | 未観測・データ不足 |

### 3. 実装済みロードマップ（全10機能）

| # | 機能 | テスト | コミット |
|---|------|--------|---------|
| ① | 説明可能性エンジン | 14 ✅ | 5960a32 |
| ② | 矛盾検出（ContradictionDetector） | 17 ✅ | 完了 |
| ③ | 理論進化（TheoryEvolution） | 13 ✅ | 3f73695 |
| ④ | ローカルLLM統合（LocalAxiomLLM） | 17 ✅ | be08ec4 |
| ⑤ | 時間軸推論（TemporalReasoning） | 18 ✅ | 0669131 |
| ⑥ | 公理ACL（AxiomACL） | 16 ✅ | a8dc963 |
| ⑦ | 分散協調推論（ConsensusEngine） | 15 ✅ | 63f56de |
| ⑧ | Formula Axiomizer | 17 ✅ | 3838bd7 |
| ⑨ | 認知負荷モニター（CognitiveLoadMeter） | 15 ✅ | b443c26 |
| ⑩ | 種ベース知識転送（SeedTransfer） | 13 ✅ | 75ec559 |

### 4. 分散公理抽出パイプライン（Team2ch型）
任意のコードから公理を自動抽出し、分散ノードで合意形成：

```
コード入力
    ↓ CodeAxiomExtractor（Step1）
公理候補
    ↓ DistributedAxiomPipeline × ConsensusEngine（Step2）
合意公理
    ↓ AxiomDistributionHub × SeedTransferProtocol（Step3）
世界に配布
    ↓ ReiPLSelfAxiomizer（Step4）
Rei-PL自己公理化
```

---

## 🚀 クイックスタート

```bash
git clone https://github.com/fc0web/rei-aios.git
cd rei-aios
npm install
npm test
```

---

## 📐 主要モジュール

```
src/axiom-os/
├── compressed-kernel.ts      # 公理OS圧縮エンジン（6.7%）
├── axiom-encoder.ts          # D-FUMT記号エンコーダ
├── theory-generator.ts       # 種から理論を再生成
├── theory-evolution.ts       # 理論の自己進化
├── contradiction-detector.ts # 七価論理矛盾検出
├── explainability-engine.ts  # 公理チェーン説明
├── temporal-reasoning.ts     # 時間軸推論
├── consensus-engine.ts       # 分散協調合意
├── cognitive-load-meter.ts   # AI認知負荷計測
├── formula-axiomizer.ts      # 自然言語→公理→Rei-PL
├── axiom-acl.ts              # 公理ベースACL
├── local-axiom-llm.ts        # ローカルLLM×公理統合
├── seed-transfer.ts          # 種の配布プロトコル
├── code-axiom-extractor.ts   # コード→公理抽出
├── distributed-axiom-pipeline.ts # 分散抽出パイプライン
├── axiom-distribution-hub.ts # 公理配布ハブ
└── rei-pl-self-axiomizer.ts  # Rei-PL自己公理化
```

---

## 🧘 設計思想

> 「AIが迷ったとき、公理に帰れ」

Rei-AIOSは以下の3つの軸で設計されている：

1. **D-FUMT理論研究** — 66理論の数学的基盤
2. **PC自動化** — 公理に基づく自律タスク処理
3. **教育支援** — 説明可能なAI推論

### LLMの構造的弱点を公理で補う

| LLMの弱点 | Rei-AIOSの対応 |
|-----------|--------------|
| ハルシネーション | ContradictionDetector |
| 推論の不透明さ | ExplainabilityEngine |
| 時系列の混乱 | TemporalReasoningEngine |
| 認知過負荷 | CognitiveLoadMeter |

---

## 📚 関連リポジトリ

| リポジトリ | 説明 |
|-----------|------|
| [fc0web/rei-pl](https://github.com/fc0web/rei-pl) | Rei-PL言語（WASM コンパイラ） |
| [fc0web/rei-lang](https://github.com/fc0web/rei-lang) | Rei言語コア理論 |

---

## 👤 Author

**Nobuki Fujimoto（藤本伸樹）**
D-FUMT（次元藤本普遍数学理論）開発者
- GitHub: [@fc0web](https://github.com/fc0web)
- note: [D-FUMT理論](https://note.com)

---

## 📄 License

MIT © 2024 Nobuki Fujimoto
