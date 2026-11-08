import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, copyFileSync, chmodSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { getT3ScratchDefaultProject as getProject } from '../t3-project.mjs'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const helper = join(repo, '.config/engram/t3-project.mjs')
const launcher = join(repo, '.local/bin/engram-mcp')

function fixture(fn) {
  const home = mkdtempSync(join(tmpdir(), 'engram-t3-test-'))
  try {
    const scratch = join(home, '.t3/scratch')
    const one = join(scratch, 'one')
    const two = join(scratch, 'two')
    mkdirSync(one, { recursive: true })
    mkdirSync(two)
    return fn({ home, scratch, one, two, env: { HOME: home, ENGRAM_DATA_DIR: join(home, 'engram-data'), PATH: process.env.PATH } })
  } finally { rmSync(home, { recursive: true, force: true }) }
}

test('only physical strict descendants of the configured scratch root qualify', () => fixture(({ home, scratch, one, two, env }) => {
  assert.equal(getProject(one, env), 'general')
  assert.equal(getProject(two, env), 'general')
  assert.equal(getProject(scratch, env), null)
  assert.equal(getProject(home, env), null)
  const sibling = `${scratch}-sibling`
  mkdirSync(sibling)
  assert.equal(getProject(sibling, env), null)
  assert.equal(getProject(join(scratch, 'missing'), env), null)
  assert.equal(getProject(one, { ...env, HOME: join(home, 'missing') }), null)
  const outside = join(home, 'outside')
  mkdirSync(outside)
  symlinkSync(outside, join(scratch, 'escape'))
  assert.equal(getProject(join(scratch, 'escape'), env), null)
  const custom = join(home, 'custom')
  mkdirSync(join(custom, 'scratch', 'child'), { recursive: true })
  assert.equal(getProject(join(custom, 'scratch', 'child'), { ...env, T3CODE_HOME: custom }), 'general')
  assert.equal(getProject(one, { ...env, T3CODE_HOME: 'relative' }), null)
  assert.equal(getProject(one, { ...env, T3CODE_HOME: '  ' }), null)
  assert.equal(getProject(one, { ...env, T3CODE_HOME: '' }), null)
  assert.equal(getProject(one, { ...env, GIT_TRACE: '1' }), 'general')
}))

test('preserves inherited project, local config and Git markers', () => fixture(({ home, one, two, env }) => {
  assert.equal(getProject(one, { ...env, ENGRAM_PROJECT: ' other ' }), null)
  assert.equal(getProject(one, { ...env, ENGRAM_PROJECT: '  ' }), 'general')
  mkdirSync(join(one, '.engram'))
  writeFileSync(join(one, '.engram/config.json'), 'invalid json')
  assert.equal(getProject(one, env), null)
  const init = spawnSync('git', ['init', '-q', two], { env: { ...env, GIT_CONFIG_NOSYSTEM: '1' }, encoding: 'utf8' })
  assert.equal(init.status, 0, init.stderr)
  mkdirSync(join(two, 'nested'))
  assert.equal(getProject(join(two, 'nested'), env), null)
  const commit = spawnSync('git', ['-C', two, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-q', '--allow-empty', '-m', 'fixture'], { env, encoding: 'utf8' })
  assert.equal(commit.status, 0, commit.stderr)
  const worktree = join(home, '.t3/scratch/worktree')
  const add = spawnSync('git', ['-C', two, 'worktree', 'add', '-q', '--detach', worktree], { env, encoding: 'utf8' })
  assert.equal(add.status, 0, add.stderr)
  assert.equal(getProject(worktree, env), null)
  const linked = join(home, '.t3/scratch/linked')
  mkdirSync(linked)
  writeFileSync(join(linked, '.git'), 'gitdir: /nonexistent\n')
  assert.equal(getProject(linked, env), null)
  const bare = join(home, '.t3/scratch/bare')
  const bareInit = spawnSync('git', ['init', '-q', '--bare', bare], { env, encoding: 'utf8' })
  assert.equal(bareInit.status, 0, bareInit.stderr)
  assert.equal(getProject(bare, env), null)
  assert.equal(getProject(join(home, '.t3/scratch'), { ...env, PATH: '' }), null)
}))

test('inspector failure is closed and CLI emits only the optional project', () => fixture(({ home, one, env }) => {
  assert.throws(() => getProject(one, { ...env, PATH: '' }), /Cannot inspect Engram project/)
  const run = (cwd, extra = {}) => spawnSync(process.execPath, [helper], { cwd, env: { ...env, ...extra }, encoding: 'utf8' })
  const selected = run(one)
  assert.equal(selected.status, 0)
  assert.equal(selected.stdout, 'general')
  assert.equal(selected.stderr, '')
  assert.equal(run(home).stdout, '')
  assert.equal(run(one, { ENGRAM_PROJECT: 'chosen' }).stdout, '')
}))


test('inspector uses physical cwd and ignores diagnostics, but fails on uncertainty', () => fixture(({ home, one, env }) => {
  const bin = join(home, 'bin')
  mkdirSync(bin)
  const fake = join(bin, 'engram')
  const fakeEnv = { ...env, PATH: `${bin}:${env.PATH}` }
  const script = (body) => { writeFileSync(fake, `#!/bin/sh\n${body}\n`); chmodSync(fake, 0o755) }
  script(`test "$1 $2" = "hook resolve-hook-project" || exit 10
input=$(cat)
test "$input" = '{"cwd":"${realpathSync(one)}"}' || exit 11
printf 'diagnostic: filesystem boundary reached\n' >&2
printf '{"project_source":"dir_basename","project":"one"}'`)
  assert.equal(getProject(one, fakeEnv), 'general')
  const alias = join(home, '.t3/scratch/alias')
  symlinkSync(one, alias)
  assert.equal(getProject(alias, fakeEnv), 'general')
  script("printf '{}'")
  assert.equal(getProject(one, fakeEnv), null)
  script("printf '{\"project_source\":\"git_remote\",\"project\":\"repo\"}'")
  assert.equal(getProject(one, fakeEnv), null)
  script("printf '{\"project_source\":\"dir_basename\",\"project\":\" \"}'")
  assert.equal(getProject(one, fakeEnv), null)
  script("printf 'not json'; echo 'bad inspector output' >&2")
  assert.throws(() => getProject(one, fakeEnv), /invalid JSON.*bad inspector output/)
  script("echo 'inspector failed' >&2; exit 17")
  assert.throws(() => getProject(one, fakeEnv), /inspector failed/)
  const cli = spawnSync(process.execPath, [helper], { cwd: one, env: fakeEnv, encoding: 'utf8' })
  assert.notEqual(cli.status, 0)
  assert.equal(cli.stdout, '')
  assert.match(cli.stderr, /inspector failed/)
}))

test('launcher forwards args, stdin, exit status and environment without protocol noise', () => fixture(({ home, one, env }) => {
  const bin = join(home, 'bin')
  mkdirSync(bin)
  const fake = join(bin, 'engram')
  writeFileSync(fake, '#!/bin/sh\nif [ "$1 $2" = "hook resolve-hook-project" ]; then\n  cat >/dev/null\n  printf \'{"project_source":"dir_basename","project":"one"}\'\n  exit 0\nfi\nprintf "ARGS:%s\\n" "$*"\nprintf "PROJECT:%s\\n" "${ENGRAM_PROJECT-unset}"\ncat\nexit 23\n')
  chmodSync(fake, 0o755)
  const run = (extra = {}) => spawnSync(launcher, ['--tools=agent', '--project', 'explicit'], {
    cwd: one, env: { ...env, PATH: `${bin}:${env.PATH}`, ...extra }, input: 'protocol input\n', encoding: 'utf8',
  })
  const result = run()
  assert.equal(result.status, 23)
  assert.equal(result.stdout, 'ARGS:mcp --tools=agent --project explicit\nPROJECT:general\nprotocol input\n')
  assert.equal(result.stderr, '')
  assert.match(run({ ENGRAM_PROJECT: 'chosen' }).stdout, /PROJECT:chosen/)
  const help = spawnSync(launcher, ['--help'], { cwd: one, env: { PATH: '' }, encoding: 'utf8' })
  assert.equal(help.status, 0)
  assert.match(help.stdout, /Examples:/)
  const missingNode = spawnSync(launcher, [], { cwd: one, env: { PATH: '' }, encoding: 'utf8' })
  assert.equal(missingNode.stdout, '')
  assert.match(missingNode.stderr, /node not found/)
  const nodeOnly = join(home, 'node-only')
  mkdirSync(nodeOnly)
  symlinkSync(process.execPath, join(nodeOnly, 'node'))
  const missingEngram = spawnSync(launcher, [], { cwd: one, env: { PATH: nodeOnly }, encoding: 'utf8' })
  assert.equal(missingEngram.stdout, '')
  assert.match(missingEngram.stderr, /engram not found/)
  const isolated = join(home, 'layout/.local/bin')
  mkdirSync(isolated, { recursive: true })
  const copy = join(isolated, 'engram-mcp')
  copyFileSync(launcher, copy)
  chmodSync(copy, 0o755)
  const missingHelper = spawnSync(copy, [], { cwd: one, env: { ...env, PATH: `${bin}:${env.PATH}` }, encoding: 'utf8' })
  assert.equal(missingHelper.stdout, '')
  assert.match(missingHelper.stderr, /helper not found/)
}))
