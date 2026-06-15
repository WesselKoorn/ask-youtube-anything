export interface CliConfig {
  /** A channel URL like https://youtube.com/@truedialog (auto-lists videos). */
  channelUrl?: string;
  /** Or a file of explicit video IDs / URLs, one per line. */
  videosFile?: string;
  /** File of SEO questions, one per line (`#` comments allowed). */
  questionsFile: string;
  /** Cap on how many of the channel's most recent videos to mine. */
  maxVideos: number;
  /** LLM model used for the matching step. */
  model: string;
  /** Drop candidates below this confidence (0-1). */
  minConfidence: number;
  /** Approx. transcript tokens to pack into a single model call. */
  tokenBudget: number;
  /** Where reports are written. */
  outDir: string;
  /** Where timestamped transcripts are cached. */
  cacheDir: string;
  /** Re-use cached transcripts when present. */
  useCache: boolean;
}

const HELP = `
find-clips — find SEO-answer moments in a YouTube channel's videos

Usage:
  npm run find-clips -- --channel <url> [options]
  npm run find-clips -- --videos <file> [options]

Source (one required):
  --channel <url>        Channel URL, e.g. https://youtube.com/@truedialog
                         (auto-lists recent videos; needs YOUTUBE_DATA_API_KEY)
  --videos <file>        File of video IDs or URLs, one per line
                         (works with only OPENAI_API_KEY)

Options:
  --questions <file>     Questions file (default: questions.txt)
  --max-videos <n>       Max videos to mine (default: 50)
  --model <name>         LLM model (default: $LLM_MODEL or gpt-5.5;
                         use gpt-5.4-mini to cut cost on large channels)
  --min-confidence <n>   Min confidence 0-1 to keep a clip (default: 0.55)
  --token-budget <n>     Transcript tokens per model call (default: 50000)
  --out <dir>            Report output dir (default: data/reports)
  --cache-dir <dir>      Transcript cache dir (default: data/transcripts)
  --no-cache             Always re-fetch transcripts
  -h, --help             Show this help

Env (.env): OPENAI_API_KEY (required), YOUTUBE_DATA_API_KEY (for --channel)
`;

export function printHelp(): void {
  process.stdout.write(HELP);
}

export function parseArgs(argv: string[]): CliConfig | null {
  const config: CliConfig = {
    questionsFile: "questions.txt",
    maxVideos: 50,
    model: process.env.LLM_MODEL || "gpt-5.5",
    minConfidence: 0.55,
    tokenBudget: 50000,
    outDir: "data/reports",
    cacheDir: "data/transcripts",
    useCache: true,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) throw new Error(`Missing value for ${arg}`);
      return value;
    };

    switch (arg) {
      case "-h":
      case "--help":
        printHelp();
        return null;
      case "--channel":
        config.channelUrl = next();
        break;
      case "--videos":
        config.videosFile = next();
        break;
      case "--questions":
        config.questionsFile = next();
        break;
      case "--max-videos":
        config.maxVideos = Number(next());
        break;
      case "--model":
        config.model = next();
        break;
      case "--min-confidence":
        config.minConfidence = Number(next());
        break;
      case "--token-budget":
        config.tokenBudget = Number(next());
        break;
      case "--out":
        config.outDir = next();
        break;
      case "--cache-dir":
        config.cacheDir = next();
        break;
      case "--no-cache":
        config.useCache = false;
        break;
      default:
        throw new Error(`Unknown argument: ${arg} (try --help)`);
    }
  }

  if (!config.channelUrl && !config.videosFile) {
    throw new Error("Provide --channel <url> or --videos <file> (try --help)");
  }

  return config;
}
