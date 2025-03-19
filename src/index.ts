import fs from 'fs/promises'
import path from 'path'
import { Gitlab } from '@gitbeaker/rest'
import { CheckRepoActions, simpleGit } from 'simple-git'
import { CronJob } from 'cron'

import { dirExists } from './utils.ts'
import { logger } from './logger.ts'

if (!process.env.GITLAB_TOKEN) throw new Error('Missing env GITLAB_TOKEN')
if (!(await dirExists('repos'))) await fs.mkdir('repos')

const api = new Gitlab({
  token: process.env.GITLAB_TOKEN,
})

const pn = (await api.Groups.all()).find((g) => g.path === 'polinetwork')
if (!pn) throw new Error('You need to be part of the PoliNetwork group')

const syncJob = CronJob.from({
  cronTime: '0 0 */24 * * *', // every 24 hours
  onTick: (cb) => {
    logger.info('Running sync job')
    syncAll()
      .catch((e) => {
        logger.error('Uncaught error in sync job')
        logger.error(e)
      })
      .finally(() => cb())
  },
  onComplete: () => {
    logger.info('Sync job completed')
  },
  runOnInit: true,
})
syncJob.start()

async function syncAll() {
  logger.info('Fetching all repositories')
  const repos = await api.Groups.allProjects(pn!.id, { visibility: 'public' })

  // for testing purposes
  if (process.env.TRUNCATE_REPOS) {
    const n = parseInt(process.env.TRUNCATE_REPOS)
    if (n > 0) repos.length = n
  }
  logger.info(`Found ${repos.length} repositories`)

  for (const repo of repos) {
    const dir = path.join('repos', repo.path)
    if (await dirExists(dir)) {
      const git = simpleGit(dir)
      logger.info(`Fetching updates for ${repo.path}`)
      if (await git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT)) {
        try {
          await git.fetch()
          const res = await git.pull()
          if (res.files.length)
            logger.info(
              `Successfully pulled ${repo.path}: +${res.summary.changes} -${res.summary.deletions} ~${res.summary.insertions}`
            )
        } catch (e) {
          logger.error(`Failed to pull ${repo.path}`)
          logger.error(e)
        }
      } else {
        logger.error(`Not a git repository: ${repo.path}. How did this happen?`)
      }
    } else {
      logger.info(`Cloning ${repo.path}`)
      try {
        const res = await simpleGit('repos').clone(repo.http_url_to_repo, {
          '--filter': 'tree:0',
          '--single-branch': null,
        })
        logger.info(`Successfully cloned ${repo.path}: +${res}`)
      } catch (e) {
        logger.error(`Failed to clone ${repo.path}`)
        logger.error(e)
      }
    }
  }
}
