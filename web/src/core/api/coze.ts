// 动态引入以避免未安装依赖时的类型检查错误

export type CozeCreateOptions = {
  token: string
  text: string
}

export async function createCozePodcast({ token, text }: CozeCreateOptions): Promise<string> {
  const { CozeAPI, COZE_CN_BASE_URL, RoleType, ChatStatus }: any = await import('@coze/api')
  const api = new CozeAPI({ token, baseURL: COZE_CN_BASE_URL })
  const result = await api.chat.createAndPoll({
    bot_id: '7573264483272409151',
    additional_messages: [
      { role: RoleType.User, content: text, content_type: 'text' },
    ],
  })

  if (result?.chat?.status !== ChatStatus.COMPLETED) {
    throw new Error('Coze 聊天未完成或失败')
  }
  const mp3Url = extractMp3Url(result?.messages || [])
  if (!mp3Url) throw new Error('未找到可播放的 MP3 链接')
  return mp3Url
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractMp3Url(msgs: any): string | undefined {
  const items: any[] = Array.isArray((msgs as any)?.data) ? (msgs as any).data : ((msgs as any) || [])
  for (const m of items) {
    const pieces = flattenStrings((m as any)?.content ?? m)
    for (const s of pieces) {
      const url = matchMp3(s)
      if (url) return url
    }
    if ((m as any)?.audio_url) {
      const url = matchMp3(String((m as any).audio_url))
      if (url) return url
    }
    if ((m as any)?.url) {
      const url = matchMp3(String((m as any).url))
      if (url) return url
    }
  }
  return undefined
}

function matchMp3(s: string): string | undefined {
  const re = /(https?:\/\/[^\s\"]+?\.mp3)(?!\w)/i
  const m = s.match(re)
  return m?.[1]
}

function flattenStrings(x: any): string[] {
  if (x == null) return []
  if (typeof x === 'string') return [x]
  if (Array.isArray(x)) {
    const out: string[] = []
    for (const i of x) out.push(...flattenStrings(i))
    return out
  }
  const out: string[] = []
  if (typeof x === 'object') {
    for (const k of ['content', 'text', 'url', 'audio_url', 'value']) {
      const v = (x as any)[k]
      if (v != null) out.push(...flattenStrings(v))
    }
  }
  return out
}
