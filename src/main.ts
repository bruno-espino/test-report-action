import * as fs from 'fs'
import * as core from '@actions/core'
import * as github from '@actions/github'

interface CommitEventPayload {
  ref: string
  repository: {
    html_url: string
    full_name: string
  }
  head_commit: {
    timestamp: string
    url: string
    message: string
    id: string
    author: {
      name: string
      username?: string
      email: string
    }
  }
  sender: {
    login: string
  }
}

interface PREventPayload {
  action: string
  pull_request: {
    html_url: string
    created_at: string
    title: string
    user: {
      login: string
    }
    head: {
      ref: string
    }
    base: {
      ref: string
    }
  }
  repository: {
    html_url: string
    full_name: string
  }
  sender: {
    login: string
  }
}

type GitEventPayload = CommitEventPayload | PREventPayload

interface ParsedGitEvent {
  type: 'commit' | 'pull_request'
  repoUrl: string
  eventUrl: string
  user: string
  time: string
  branch: string
  message: string
  commitId?: string
}

/**
 * Parses the GitHub event payload into a simplified format.
 *
 * @param payload - The GitHub event payload.
 * @returns The parsed Git event.
 * @throws Error if the payload is unsupported.
 */
function parseGitEvent(payload: GitEventPayload): ParsedGitEvent {
  if ('pull_request' in payload) {
    const { pull_request: pr, repository } = payload as PREventPayload
    return {
      type: 'pull_request',
      repoUrl: repository.html_url,
      eventUrl: pr.html_url,
      user: pr.user.login,
      time: pr.created_at,
      branch: pr.head.ref,
      message: pr.title
    }
  } else if ('head_commit' in payload) {
    const commit = (payload as CommitEventPayload).head_commit
    // Extract branch name from the ref (format "refs/heads/<branch>")
    const branch = payload.ref.split('/').pop() || payload.ref
    return {
      type: 'commit',
      repoUrl: payload.repository.html_url,
      eventUrl: commit.url,
      user: commit.author.username,
      time: commit.timestamp,
      branch: branch,
      message: commit.message,
      commitId: commit.id
    }
  }
  throw new Error('Unsupported GitHub event payload')
}

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const parsedEvent = parseGitEvent(
      github.context.payload as unknown as GitEventPayload
    )
    core.info(
      '\u001b[32mEvent relevant information: ' +
        JSON.stringify(parsedEvent, null, 2) +
        '\u001b[0m'
    )
    core.info('\u001b[33m..........................\u001b[0m')
    core.info('\u001b[34mCONSOLE: Processing file...\u001b[0m')

    const file = core.getInput('file', { required: true })
    const fileContent = fs.readFileSync(file, 'utf8')
    const data = JSON.parse(fileContent)

    let results = data.results ?? {}
    const summary = results.summary ?? {}
    const tests = results.tests ?? []
    if (results.environment) {
      environment = results.environment
    } else {
      environment = { repositoryUrl: parsedEvent.repoUrl, branchName: parsedEvent.branch, commit: parsedEvent.type === "commit" ? parsedEvent.commitId : ""  }
    }
    const context = { type: parsedEvent.type, actor: parsedEvent.user, eventURL: parsedEvent.eventUrl }
    const payload = { results: { summary, tests, environment }, context}
    if (
      Object.keys(summary).length > 0 && summary.failed > 0
    ) {
      core.info('\u001b[31mSome tests failed\u001b[0m')
      core.info(`Results: ${payload}`)
    } else {
      core.info('\u001b[32mAll tests were successful!\u001b[0m')
      core.info(`Results: ${payload}`)
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('An unknown error occurred.')
    }
  }
}
