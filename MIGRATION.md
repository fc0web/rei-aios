# Rei-AIOS 分離ガイド

## 概要

`rei-automator` から `src/aios/`, `src/agi/`, `src/core/` を `rei-aios` パッケージに分離。

## 変更された相互依存（2ファイル）

以下のファイルは `rei-automator` の `parser` / `ReiRuntime` / `AutoController` を直接
インポートしていたが、**インターフェース経由の依存性注入**に変更済み。

| ファイル | 変更内容 |
|---|---|
| `src/aios/action-executor.ts` | `import { getReiAIOSDeps }` に変更 |
| `src/aios/rei-runtime/rei-sandbox.ts` | 同上 |

## rei-automator 側で必要な変更

### 1. rei-aios をローカル参照として追加

```jsonc
// rei-automator/package.json
{
  "dependencies": {
    "rei-aios": "file:../rei-aios"
  }
}
```

### 2. 初期化コードを追加（main.ts の先頭付近）

```typescript
// rei-automator/src/main/main.ts
import { initReiAIOSDeps } from 'rei-aios';
import { parse } from '../lib/core/parser';
import { ReiRuntime } from '../lib/core/runtime';
import { AutoController } from '../lib/auto/controller';

// rei-aios に parser/runtime/controller を注入
initReiAIOSDeps({
  parse,
  createRuntime: (controller) => new ReiRuntime(controller),
  createController: (backend) => new AutoController(backend),
});
```

### 3. import パスの変更（5ファイル）

```typescript
// Before (rei-automator 内の直接パス)
import { AIOSEngine } from '../aios/aios-engine';
import { initAGILayer } from '../agi/index';

// After (rei-aios パッケージ経由)
import { AIOSEngine, initAGILayer } from 'rei-aios';
```

対象ファイル:
- `src/main/main.ts`
- `src/main/main-aios-additions.ts`
- `src/main/main-phase4-aios-additions.ts`
- `src/main/main-theme-j-additions.ts`
- `src/main/main-toyosatomi-additions.ts`

### 4. src/aios, src/agi, src/core を削除

分離完了後、`rei-automator` から以下を削除:
```
rm -rf src/aios src/agi src/core
```

## ファイル構成

```
rei-aios/
├── README.md
├── LICENSE
├── package.json
├── tsconfig.json
├── MIGRATION.md          ← このファイル
└── src/
    ├── index.ts          ← メインエントリーポイント
    ├── interfaces/
    │   └── rei-runtime-interface.ts  ← 外部依存の注入 IF
    ├── aios/             ← 92ファイル (22,528行)
    ├── agi/              ← 9ファイル  (3,807行)
    └── core/             ← 14ファイル (2,879行)
```
