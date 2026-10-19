const base = process.env.TEST_BASE || 'http://127.0.0.1:8787'
const questions = [
  '有哪些适合本地部署、同时支持 RAG 的开源项目？',
  '最近一周增长最快的项目是哪个？背后有哪些信号？',
  '对比 Dify 和 n8n，我应该先深入研究哪一个？',
  'RAG 是什么？',
  'langgenius/dify 解决什么问题？',
  '你好，你能做什么？'
]

let failures = 0
for (const question of questions) {
  const response = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: question, history: [] })
  })
  const body = await response.text()
  const error = body.match(/event: error\r?\ndata: (.*)/)?.[1]
  const deltas = [...body.matchAll(/event: delta\r?\ndata: (.*)/g)]
    .map((match) => {
      try {
        return JSON.parse(match[1]).text
      } catch {
        return ''
      }
    })
    .join('')
  const meta = body.match(/event: meta\r?\ndata: (.*)/)?.[1]
  let sourceCount = 0
  let mode = 'unknown'
  try {
    const parsed = JSON.parse(meta || '{}')
    sourceCount = parsed.sources?.length || 0
    mode = parsed.mode || 'unknown'
  } catch {
    // The missing meta event is reported below.
  }
  const ok = response.ok && !error && deltas.length > 80 && !deltas.includes('++')
  if (!ok) failures += 1
  console.log(
    `${ok ? 'PASS' : 'FAIL'} | ${question}\n     mode=${mode} sources=${sourceCount} chars=${deltas.length}${error ? ` error=${error}` : ''}`
  )
}

if (failures) {
  console.error(`\n${failures} chat checks failed`)
  process.exit(1)
}
console.log('\nAll chat intent checks passed.')
