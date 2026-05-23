export function folderLeaf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}
