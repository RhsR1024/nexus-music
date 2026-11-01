export type PlaybackTraceStage = 'resolution' | 'offline' | 'match' | 'source' | 'cache' | 'native';
export type PlaybackTraceStatus = 'info' | 'success' | 'fallback' | 'failed' | 'cancelled';
export type PlaybackTraceRunStatus = 'running' | 'ready' | 'error' | 'cancelled';

export interface PlaybackTraceEvent {
  readonly sequence: number;
  readonly at: number;
  readonly stage: PlaybackTraceStage;
  readonly status: PlaybackTraceStatus;
  readonly title: string;
  readonly detail?: string;
  readonly sourceId?: string;
  readonly sourceName?: string;
  readonly platform?: string;
  readonly quality?: string;
}

export interface PlaybackTraceEventInput extends Omit<PlaybackTraceEvent, 'sequence' | 'at'> {}

export interface PlaybackTraceRun {
  readonly version: 1;
  readonly id: string;
  readonly entryId: string;
  readonly generation: number;
  readonly trackTitle: string;
  readonly trackArtist: string;
  readonly startedAt: number;
  readonly finishedAt?: number;
  readonly status: PlaybackTraceRunStatus;
  readonly events: readonly PlaybackTraceEvent[];
}

export type PlaybackTraceSink = (event: PlaybackTraceEventInput) => void;

/**
 * Playback diagnostics are intentionally structured and bounded. URLs,
 * headers, script output and resolver exception text never enter this model.
 */
export function safePlaybackTraceText(value: unknown, maximum = 180): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(/\b(?:https?|file|ipod-library):\/\/\S+/gi, '[地址隐藏]')
    .replace(/\b(?:authorization|proxy-authorization)\s*[:=]\s*(?:bearer\s+)?\S+/gi, '[凭据隐藏]')
    .replace(/\b(?:access[_-]?token|refresh[_-]?token|api[_-]?key|password|passwd|secret|credentials?)\s*[:=]\s*\S+/gi, '[凭据隐藏]')
    .replace(/\bbearer\s+[a-z0-9._~+/=-]+/gi, '[凭据隐藏]')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.slice(0, maximum) : undefined;
}

const traceStageLabels: Record<PlaybackTraceStage, string> = {
  resolution: '解析',
  offline: '离线',
  match: '匹配',
  source: '选源',
  cache: '缓存',
  native: '解码',
};

const traceRunLabels: Record<PlaybackTraceRunStatus, string> = {
  running: '采集中',
  ready: '已就绪',
  error: '失败',
  cancelled: '已取消',
};

const traceEventLabels: Record<PlaybackTraceStatus, string> = {
  info: '进行',
  success: '完成',
  fallback: '降级',
  failed: '失败',
  cancelled: '取消',
};

/**
 * Builds a shareable text report from the latest bounded runs. Every field is
 * sanitized again at this boundary so callers cannot leak an address even if a
 * future producer constructs a trace event directly.
 */
export function formatPlaybackDiagnosticsReport(
  runs: readonly PlaybackTraceRun[],
  generatedAt: Date = new Date(),
): string {
  const latest = runs.slice(-6).reverse();
  const lines = [
    '音枢播放链路诊断',
    `生成时间：${generatedAt.toISOString()}`,
    '说明：仅包含最近 6 次解析的有界结构化阶段；音频地址、请求头、凭据、脚本输出和异常原文已排除。',
    '',
  ];
  if (!latest.length) {
    lines.push('尚无播放解析记录。');
    return lines.join('\n');
  }
  latest.forEach((run, index) => {
    const title = safePlaybackTraceText(run.trackTitle, 120) ?? '未命名歌曲';
    const artist = safePlaybackTraceText(run.trackArtist, 120) ?? '未知歌手';
    lines.push(
      `[${index + 1}] ${title} · ${artist} · 第 ${run.generation} 代 · ${traceRunLabels[run.status]}`,
    );
    if (!run.events.length) {
      lines.push('  已开始解析，等待首个结构化阶段。');
    }
    run.events.forEach((event) => {
      const seconds = Math.max(0, event.at - run.startedAt) / 1000;
      const eventTitle = safePlaybackTraceText(event.title, 140) ?? '播放链路事件';
      const sourceName = safePlaybackTraceText(event.sourceName, 80);
      const quality = safePlaybackTraceText(event.quality, 24);
      const platform = safePlaybackTraceText(event.platform, 24);
      const metadata = [
        traceEventLabels[event.status],
        sourceName,
        quality && `音质 ${quality}`,
        platform && `平台 ${platform}`,
      ].filter((value): value is string => Boolean(value));
      lines.push(
        `  +${seconds.toFixed(2)}s ${traceStageLabels[event.stage]} · ${eventTitle} [${metadata.join(' · ')}]`,
      );
      const detail = safePlaybackTraceText(event.detail, 220);
      if (detail) lines.push(`    ${detail}`);
    });
    lines.push('');
  });
  lines.push('“原生媒体已就绪”只证明本次媒体容器通过原生加载准备，不等同于完成全曲播放、真机音质或签名验收。');
  return lines.join('\n').trimEnd();
}
