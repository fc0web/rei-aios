<div align="center">

# 零 Rei-AIOS

### Axiomatic Operating System

**従来のOSカーネルを公理体系で再構築する — D-FUMT理論に基づく知的計算基盤**

[![Version](https://img.shields.io/badge/version-0.5.0-blue.svg)](https://github.com/fc0web/rei-aios)
[![License](https://img.shields.io/badge/license-Apache_2.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-3178C6.svg)](https://www.typescriptlang.org/)

</div>

---

Rei-AIOS is an axiomatic operating system layer that reimagines traditional OS concepts — scheduling, IPC, fault recovery, resource management — through the lens of [D-FUMT](https://doi.org/10.5281/zenodo.18651614) (Dimensional Fujimoto Universal Mathematical Theory).

Where conventional operating systems manage hardware resources, Rei-AIOS manages **cognitive resources**: multiple LLMs, axiom-based reasoning, multi-agent formations, and self-repairing computation.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Rei-AIOS                          │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │              AGI Layer                        │   │
│  │  Task Planner · D-FUMT Engine · Self-Repair  │   │
│  └──────────────────┬───────────────────────────┘   │
│                     │                                │
│  ┌──────────────────┴───────────────────────────┐   │
│  │              AIOS Engine                      │   │
│  │  LLM Manager · Axiom Brancher · Chat Store   │   │
│  └──────────────────┬───────────────────────────┘   │
│                     │                                │
│  ┌──────────┬───────┴────────┬──────────────────┐   │
│  │ Rei      │  Formation     │  Toyosatomi      │   │
│  │ Kernel   │  Engine        │  Pipeline         │   │
│  │          │                │                   │   │
│  │ Scheduler│  Diamond       │  Multi-AI         │   │
│  │ IPC      │  Triangle      │  Comparison       │   │
│  │ Fault    │  Infinite      │  & Consensus      │   │
│  │ Recovery │                │                   │   │
│  │ Boundary │  Multi-Agent   │  Knowledge        │   │
│  │ Check    │  Discussion    │  arXiv · OEIS     │   │
│  │ Resource │  Engine        │  Math Simulator   │   │
│  │ Collector│                │                   │   │
│  └──────────┴────────────────┴──────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │         LLM Adapters (14+ providers)          │   │
│  │  Claude · OpenAI · Ollama · Groq · Gemini ·  │   │
│  │  Cohere · OpenAI-Compatible · Local Models    │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

---

## Core Subsystems

### Rei Kernel — 公理的カーネル

Traditional OS kernels manage CPU time and memory. Rei Kernel manages **cognitive resources** through D-FUMT axioms.

| Component | Traditional OS | Rei Kernel | D-FUMT Basis |
|-----------|---------------|------------|--------------|
| Scheduler | CPU time slicing | σ/κ priority-based task scheduling | Center-periphery weighting |
| IPC | Pipes, sockets | Indra's Net message passing | Interconnection axiom |
| Fault Recovery | Kernel panic, restart | Axiom-based self-repair | Boundary check + restoration |
| Resource Collector | Garbage collection | Resource capture with release semantics | 捨 (sha) — letting go |
| Boundary Check | Memory protection | Layer boundary verification | Layer transition axiom |

### AIOS Engine — 統合AI管理

The AIOS Engine coordinates LLM interactions with axiom-based reasoning:

- **LLM Manager**: Unified interface across 14+ providers with automatic failover and cost optimization
- **Axiom Brancher**: Every AI response is analyzed along three axiom axes, generating alternative perspectives
- **Chat Store**: Persistent conversation history with session management
- **Agent Loop**: Autonomous task execution with screen observation and intent recognition

### AGI Layer — 知的タスク分解

- **Task Planner**: Decomposes natural language instructions into executable subtasks
- **D-FUMT Engine**: Compensates for LLM structural weaknesses using D-FUMT operations (8 weakness categories)
- **Axiom Evaluator**: Multi-angle task evaluation through center-periphery-flow-boundary pattern
- **Theory Router**: Selects optimal D-FUMT theory from 66+ theories for each problem type
- **Self-Repair**: Autonomous error detection and recovery

### Formation Engine — マルチエージェント陣形

Multiple AI agents coordinate in formations inspired by D-FUMT topology:

- **Diamond Formation**: 4 agents — proposer, critic, mediator, synthesizer
- **Triangle Formation**: 3 agents — specialized roles with rotating leadership
- **Infinite Formation**: Dynamically scaling agent pool for complex tasks

### Toyosatomi Pipeline — 豊聡耳

Named after Prince Shōtoku's legendary ability to listen to ten people simultaneously:

- Multi-AI comparison: same question sent to multiple LLMs in parallel
- Axiom-based consensus building across divergent AI responses
- Confusion detection: identifies when agents are uncertain and escalates to multi-model consultation

### Knowledge System — 知識探索

- **arXiv Fetcher**: Academic paper retrieval and analysis
- **OEIS Fetcher**: Integer sequence identification and mathematical pattern matching
- **Math Simulator**: Interactive mathematical concept exploration

---

## D-FUMT Foundation

Rei-AIOS is grounded in D-FUMT's four axioms:

| Axiom | Principle | Application in AIOS |
|-------|-----------|---------------------|
| **Center-Periphery** | Every value is a field, not a point | User intent (center) → AI responses, axioms, context (periphery) |
| **Flow** | Computation flows outward from center | Task decomposition → parallel execution → synthesis |
| **Layer** | Reality has depth structure | Perception → Cognition → Awareness processing layers |
| **Boundary** | Transitions between layers have rules | Layer boundary checks, fault isolation, resource scoping |

---

## LLM Provider Support

| Provider | Adapter | Status |
|----------|---------|--------|
| Anthropic Claude | claude-adapter.ts | ✅ |
| OpenAI (GPT-4, etc.) | openai-adapter.ts | ✅ |
| Ollama (local) | ollama-adapter.ts | ✅ |
| Groq | openai-compat-adapter.ts | ✅ |
| Google Gemini | openai-compat-adapter.ts | ✅ |
| Cohere | openai-compat-adapter.ts | ✅ |
| OpenAI-Compatible | openai-compat-adapter.ts | ✅ |
| Local Models (GGUF) | local-llm-adapter.ts | ✅ |

Smart Model Router automatically selects the optimal model based on task complexity, cost, and latency.

---

## Project Scale

| Component | Files | Lines of Code |
|-----------|-------|---------------|
| AIOS Engine & Subsystems | 96 | 22,528 |
| AGI Layer | 9 | 3,807 |
| **Total** | **105** | **26,335** |

---

## Relationship to Rei Ecosystem

```
rei-lang (npm)          ← Language runtime & interpreter (2,011 tests)
rei-pl                  ← Compiler: Source → WASM (286 tests)
rei-aios (this repo)    ← Axiomatic OS: cognitive resource management
rei-automator           ← PC automation GUI (Electron desktop app)
```

Rei-AIOS was originally developed within `rei-automator` and is being extracted as an independent project. The automator provides the desktop GUI shell; Rei-AIOS provides the cognitive computation layer beneath it.

---

## Roadmap

| Phase | Status | Content |
|-------|--------|---------|
| Foundation | ✅ Done | Rei Kernel, AIOS Engine, LLM Manager, Axiom Brancher |
| Multi-Agent | ✅ Done | Formation Engine, Discussion Engine, Toyosatomi Pipeline |
| AGI Layer | ✅ Done | Task Planner, D-FUMT Engine, Self-Repair |
| Separation | 🔄 Active | Extract from rei-automator, independent package |
| Standalone | 🔲 Next | CLI mode, headless operation, npm package |

---

## License

Apache License 2.0. See [LICENSE](LICENSE).

Theory documents under CC BY-NC-SA 4.0.

## Author

**Nobuki Fujimoto** (藤本伸樹)

- GitHub: [@fc0web](https://github.com/fc0web)
- Theory: [D-FUMT on Zenodo](https://doi.org/10.5281/zenodo.18651614)

## Citation

```bibtex
@software{fujimoto2026reiaios,
  author       = {Fujimoto, Nobuki},
  title        = {Rei-AIOS: Axiomatic Operating System based on D-FUMT},
  year         = {2026},
  license      = {Apache-2.0},
  url          = {https://github.com/fc0web/rei-aios}
}
```

---

<div align="center">

**零** — *What if an operating system were built on axioms, not abstractions?*

</div>
