import fs from 'fs/promises'

export async function dirExists(dir: string) {
  try {
    const stats = await fs.stat(dir)
    return stats.isDirectory()
  } catch {
    return false
  }
}
