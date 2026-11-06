import { realpathSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

// Return a default only when all evidence supports a non-repository scratch directory.
export function getT3ScratchDefaultProject(directory, env = process.env) {
  if (env.ENGRAM_PROJECT?.trim()) return null
  const base = env.T3CODE_HOME ?? (env.HOME && join(env.HOME, '.t3'))
  if (!base || !base.trim() || !isAbsolute(base)) return null

  let scratch, cwd
  try {
    scratch = realpathSync(join(base, 'scratch'))
    cwd = realpathSync(directory)
    if (!statSync(scratch).isDirectory() || !statSync(cwd).isDirectory()) return null
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null
    throw error
  }
  const rel = relative(scratch, cwd)
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return null

  const result = spawnSync('engram', ['hook', 'resolve-hook-project'], {
    cwd, env, encoding: 'utf8', input: JSON.stringify({ cwd }),
  })
  if (result.error || result.status !== 0) {
    throw new Error(`Cannot inspect Engram project for ${cwd}: ${result.error?.message || result.stderr?.trim() || `engram exited ${result.status}`}`)
  }
  let resolution
  try {
    resolution = JSON.parse(result.stdout)
  } catch {
    throw new Error(`Cannot inspect Engram project for ${cwd}: invalid JSON from engram${result.stderr?.trim() ? `: ${result.stderr.trim()}` : ''}`)
  }
  return resolution?.project_source === 'dir_basename' &&
    typeof resolution.project === 'string' && resolution.project.trim() ? 'arthur' : null
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const project = getT3ScratchDefaultProject(process.cwd())
    if (project) process.stdout.write(project)
  } catch (error) {
    console.error(`engram-mcp: ${error.message}`)
    process.exitCode = 1
  }
}
