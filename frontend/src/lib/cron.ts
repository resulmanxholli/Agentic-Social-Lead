import cronstrue from 'cronstrue';

export function describeCron(expression: string): string | null {
  try {
    return cronstrue.toString(expression, { throwExceptionOnParseError: true });
  } catch {
    return null;
  }
}
