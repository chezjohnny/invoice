/** 'Rosé  50cl ' → 'rose 50cl': how names compare, without case, accents or extra spaces. */
export function searchKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
