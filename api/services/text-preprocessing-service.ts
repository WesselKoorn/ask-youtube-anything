export class TextPreprocessingService {
  private static readonly TIMESTAMP_REGEX = /\d{1,2}:\d{2}/g;
  private static readonly STOP_PHRASES = [
    /^hey\s+man/i,
    /^quick\s+question:/i,
    /^just\s+wondering/i,
    /^hi\s+there/i,
    /^excuse\s+me/i,
    /^sorry\s+to\s+bother/i,
    /^i\s+have\s+a\s+question/i,
    /^can\s+i\s+ask/i,
    /^i\s+was\s+wondering/i,
  ];

  static preprocessText(text: string): string {
    // Remove timestamps
    let processed = text.replace(this.TIMESTAMP_REGEX, '<TIMESTAMP>');
    
    // Remove stop phrases
    this.STOP_PHRASES.forEach(regex => {
      processed = processed.replace(regex, '');
    });
    
    // Clean up whitespace and normalize
    return processed.replace(/\s+/g, ' ').trim().toLowerCase();
  }
} 