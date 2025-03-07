import * as fs from 'fs'
import * as core from '@actions/core'

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    core.debug(`DEBUG: Procesing file...`)
    console.log(`CONSOLE: Procesing file...`)
    // Assuming `file` is a JSON string.
    const file = core.getInput('file')
    const fileContent = fs.readFileSync(file, 'utf8')
    const data = JSON.parse(fileContent)
    const results = data.results || {}
    const summary = results.summary || {}
    const tests = results.tests || []
    const failedTestsByFile: { [key: string]: Test[] } = {}

    interface Test {
      name: string
      status: string
      duration: number
      message?: string
      trace?: string
      rawStatus: string
      type: string
      filePath: string
      retries: number
      flaky: boolean
      browser: string
    }

    function processTest(test: Test): void {
      const filePath = test.filePath
      if (test.status === 'failed') {
        if (!failedTestsByFile[filePath]) {
          failedTestsByFile[filePath] = []
        }
        failedTestsByFile[filePath].push(test)
      }
    }

    tests.forEach(processTest)

    let processedContent: string | undefined
    if (
      Object.keys(summary).length > 0 &&
      Object.keys(failedTestsByFile).length > 0
    ) {
      processedContent = JSON.stringify({
        summary: summary,
        failed_tests_by_file: failedTestsByFile
      })
      core.setOutput('output', processedContent)
    } else {
      core.setOutput('output', 'All tests were successfull!')
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('An unknown error occurred.')
    }
  }
}
