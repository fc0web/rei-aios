/**
 * 再生成コード — カテゴリ: expansion
 * 公理数: 12
 * このファイルは rei-regenerate により自動生成されました
 */

// [再生成:semi-fidelity] f: A→Promise<B> — 非同期写像 [Promise]
async function rei_async<T>(fn: () => Promise<T>): Promise<T> {
  return await fn();
}

// [再生成:semi-fidelity] f: A→Promise<B> — 非同期写像 [await]
async function rei_async<T>(fn: () => Promise<T>): Promise<T> {
  return await fn();
}

// [再生成:semi-fidelity] f: A→Promise<B> — 非同期写像 [async]
async function rei_async<T>(fn: () => Promise<T>): Promise<T> {
  return await fn();
}

// [再生成:semi-fidelity] f: A→B — 変換写像 [map]
function transform<A, B>(input: A, fn: (a: A) => B): B {
  return fn(input);
}

// [再生成:semi-fidelity] f: A→B — 変換写像 [parse]
function transform<A, B>(input: A, fn: (a: A) => B): B {
  return fn(input);
}

// [再生成:semi-fidelity] f: A→B — 変換写像 [convert]
function transform<A, B>(input: A, fn: (a: A) => B): B {
  return fn(input);
}

// [再生成:semi-fidelity] f: A→Promise<B> — 非同期写像 [EventEmitter]
async function rei_async<T>(fn: () => Promise<T>): Promise<T> {
  return await fn();
}

// [再生成:semi-fidelity] f: A→B — 変換写像 [flatMap]
function transform<A, B>(input: A, fn: (a: A) => B): B {
  return fn(input);
}

// [再生成:semi-fidelity] f: A→B — 変換写像 [transform]
function transform<A, B>(input: A, fn: (a: A) => B): B {
  return fn(input);
}

// [再生成:semi-fidelity] f: A→B — 変換写像 [serialize]
function transform<A, B>(input: A, fn: (a: A) => B): B {
  return fn(input);
}

// [再生成:semi-fidelity] f: A→Promise<B> — 非同期写像 [Observable]
async function rei_async<T>(fn: () => Promise<T>): Promise<T> {
  return await fn();
}

// [再生成:semi-fidelity] f: A→Promise<B> — 非同期写像 [Stream]
async function rei_async<T>(fn: () => Promise<T>): Promise<T> {
  return await fn();
}
