import fs from 'fs/promises'
import { Gitlab } from '@gitbeaker/rest'
import { simpleGit } from 'simple-git'

if (!process.env.GITLAB_TOKEN) throw new Error('Missing env GITLAB_TOKEN')
process.chdir('repos')

const api = new Gitlab({
  token: process.env.GITLAB_TOKEN,
})
const git = simpleGit()

const pn = (await api.Groups.all()).find((g) => g.path === 'polinetwork')
if (!pn) throw new Error('You need to be part of the PoliNetwork group')

const repos = await api.Groups.allProjects(pn.id)
repos.length = 2

async function dirExists(dir: string) {
  try {
    await fs.stat(dir)
    return true
  } catch {
    return false
  }
}

for (const repo of repos) {
  const dir = repo.path
  if (await dirExists(dir)) {
    console.log(`Pulling ${dir}`)
    await git.pull(dir)
  } else {
    console.log(`Cloning ${dir}`)
    await git.clone(repo.http_url_to_repo)
  }
}
