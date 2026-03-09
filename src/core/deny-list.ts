import { minimatch } from 'minimatch';

export function isDenied(relativePath: string, denyList: string[]): boolean {
  return denyList.some((pattern) =>
    minimatch(relativePath, pattern, {
      dot: true,
      matchBase: true,
    }),
  );
}
