import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { ViewState } from '../types'

const PANE = 'my-index'
const PREVIEW = 80
const EXCERPT = 400

const view = atom(
  { plugin: 'my-index', key: 'view' } as const,
  { query: '', open: null } as ViewState,
  { shape: 'view-1' },
)

type Msg = { role: string; text: string; toolResults?: unknown[] }

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n).trimEnd() + '…' : s)

// Cada pregunta del usuario con su respuesta: el primer texto del asistente tras ella.
const pairsOf = (msgs: Msg[]) => {
  const out: Array<{ n: number; question: string; answer: string }> = []
  msgs.forEach((m, i) => {
    if (m.role !== 'user' || m.text.trim() === '' || m.toolResults?.length) return
    const reply = msgs.slice(i + 1).find(x => x.role === 'assistant' && x.text.trim() !== '')
    out.push({
      n: out.length + 1,
      question: m.text.replace(/\s+/g, ' ').trim(),
      answer: reply ? reply.text.replace(/\s+/g, ' ').trim() : '',
    })
  })
  return out
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    void $.ui.open({ id: PANE, title: 'My Index' })
    return next(e)
  })

  // Se refresca al enviar cada pregunta y al empezar su turno.
  on('prompt.submit', async ($, e, next) => {
    const r = await next(e)
    void $.ui.invalidate('ui.render')
    return r
  })
  on('turn.start', async ($, e, next) => {
    const r = await next(e)
    void $.ui.invalidate('ui.render')
    return r
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    // El buscador solo existe en superficies con campos (no en móvil).
    const Input = 'Input' in els ? els.Input : undefined
    const st = await read($, view)
    const all = pairsOf(await $.session.messages())
    const q = st.query.trim().toLowerCase()
    const shown = q ? all.filter(p => p.question.toLowerCase().includes(q)) : all
    const current = st.open === null ? undefined : all.find(p => p.n === st.open)

    return (
      <Box flexDirection="column">
        <Text bold>My Index · {all.length} preguntas</Text>
        {Input && (
          <Input
            key="q"
            placeholder="Buscar en tus preguntas…"
            value={st.query}
            onInput={(v: string) => void update($, view, s => ({ ...s, query: v }))}
            onSubmit={() => undefined}
          />
        )}

        {all.length === 0 && <Text dimColor>Aún no has hecho preguntas.</Text>}
        {q && shown.length === 0 && <Text dimColor>Ninguna pregunta coincide.</Text>}

        {shown.map(p => (
          <Button
            key={`p-${p.n}`}
            plain
            label={`${p.n}. ${clip(p.question, PREVIEW)}`}
            onPress={press => {
              // Copia la pregunta al portapapeles para pegarla en tu búsqueda.
              void $.ui.copy({ text: p.question, surface: press.surface })
              void update($, view, s => ({ ...s, open: s.open === p.n ? null : p.n }))
            }}
          />
        ))}

        {current && (
          <Box flexDirection="column">
            <Text> </Text>
            <Text bold>Pregunta {current.n} de {all.length}</Text>
            <Text>{current.question}</Text>
            <Text> </Text>
            <Text dimColor>Respuesta: {current.answer ? clip(current.answer, EXCERPT) : 'sin respuesta de texto'}</Text>
            <Button
              key="close"
              plain
              label="Cerrar detalle"
              onPress={() => void update($, view, s => ({ ...s, open: null }))}
            />
          </Box>
        )}
      </Box>
    )
  })
}
