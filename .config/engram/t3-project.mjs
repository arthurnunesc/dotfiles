import { realpathSync, statSync, lstatSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

// Return a default only when all evidence supports a non-repository scratch directory.
export function getT3ScratchDefaultProject(directory, env = process.env) {
  if (env.ENGRAM_PROJECT?.trim()) return null
  const base = env.T3CODE_HOME || (env.HOME && join(env.HOME, '.t3'))
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

  try {
    // lstat also treats a broken config symlink as an explicit local config.
    lstatSync(join(cwd, '.engram', 'config.json'))
    return null
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error
  }

  // Even a malformed Git marker must not turn a potential repository into scratch.
  for (let dir = cwd; ; dir = dirname(dir)) {
    try {
      lstatSync(join(dir, '.git'))
      return null
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error
    }
    if (dirname(dir) === dir) break
  }

  const result = spawnSync('git', ['--no-optional-locks', 'rev-parse', '--is-inside-work-tree'], {
    cwd, encoding: 'utf8', env: { ...env, LC_ALL: 'C' },
  })
  if (result.status === 0) return null
  if (!result.error && result.status === 128 && /^fatal: not a git repository \(or any of the parent directories\): \.git\s*$/.test(result.stderr)) return 'arthur'
  throw new Error(`Cannot determine Git repository for ${cwd}: ${result.error?.message || result.stderr?.trim() || `git exited ${result.status}`}`)
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
