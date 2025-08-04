import ora from 'ora'

function SpinnerLogger(visualLogger) {
  const spinner = ora()
  const logger = {
    start: message => visualLogger ? spinner.start(message) : console.log(message),
    log(message) {
      if (visualLogger) {
        spinner.text = message
        return message
      }

      return console.log(message)
    },
    succeed: message => visualLogger ? spinner.succeed(message) : console.log(message),
    fail: message => (
      visualLogger
        ? spinner.fail(
          `Error >> ${
            typeof message === 'string'
              ? message
              : (message.message || JSON.stringify(message))
          }`)
        : console.error(message)
    ),
  }

  return logger
}

export default SpinnerLogger
