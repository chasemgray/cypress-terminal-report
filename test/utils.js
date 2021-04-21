const {exec} = require('child_process');
const {expect} = require('chai');
const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');

let commandPrefix = 'node ./node_modules/.bin/cypress';

if (process.platform === 'win32') {
  commandPrefix = 'npx cypress';
}

export const ICONS = (() => {
  if (process.platform !== 'win32' || process.env.CI || process.env.TERM === 'xterm-256color') {
    return {error: '✘', warning: '❖', success: '✔', info: '✱', route: '➟', debug: '⚈'};
  } else {
    return {error: 'x', warning: '!', success: '+', info: 'i', route: '~', debug: '%'};
  }
})();

export const PADDING = '                    ';

export const commandBase = (env = [], specs = []) =>
  `${commandPrefix} run --env "${env.join(',')}" --headless --config video=false -s ${specs.map(s => `cypress/integration/${s}`)}`;

let lastRunOutput = '';
export const logLastRun = () => {
  console.log(chalk.yellow('-- Cypress output start --\n\n'));
  console.log(lastRunOutput);
  console.log(chalk.yellow('-- Cypress output end --\n\n\n\n'));
};

export const runTest = async (command, callback) => {
  await new Promise(resolve => {
    exec(command, (error, stdout, stderr) => {
      if (stderr) {
        console.error(stderr);
      }

      let from = stdout.indexOf('Running:  ');
      let to = stdout.lastIndexOf('(Results)');
      if (from !== -1 && to !== -1) {
        stdout = stdout.slice(from, to);
      }

      lastRunOutput = stdout;
      // Normalize line endings for unix.
      const normalizedStdout = stdout.replace(/\r\n/g, "\n");
      callback(error, normalizedStdout, stderr);
      expect(normalizedStdout).to.not.contain("CypressError: `cy.task('ctrLogMessages')` failed");

      resolve();
    });
  });
};

export const outputCleanUpAndInitialization = (testOutputs, outRoot) => {
  outRoot.value = path.join(__dirname, 'output');
  testOutputs.value = ['out.txt', 'out.json', 'out.cst'];
  testOutputs.value.forEach((out) => {
    if (fs.existsSync(path.join(outRoot.value, out))) {
      fs.unlinkSync(path.join(outRoot.value, out));
    }
  });
}

const osSpecificEol = (str) =>
  // Change line endings to win32 if needed
  (os.EOL === '\r\n' ? str.replace(/\n/g, '\r\n') : str);

export const clean = (str, removeSlow = false) =>
  // Clean error trace as it changes from test to test.
  str.replace(/at [^(]+ \([^)]+\)/g, '')
    // Clean new line of white space at the end.
    .replace(/\s+$/, '')
    // Clean slow test.
    .replace(/ \([\d.]+ ?m?s\)/g, removeSlow ? '' : ' (X ms)')
    // Normalize line endings across os.
    .replace(/\r\n/g, "\n");

export const expectOutFilesMatch = (outputPath, specPath) => {
  const expectedBuffer = fs.readFileSync(specPath);
  const valueBuffer = fs.readFileSync(outputPath);
  let value = clean(valueBuffer.toString());
  if (path.sep === '\\') {
    if (outputPath.endsWith('json')) {
      value = value.replace(/cypress\\\\integration\\\\/g, 'cypress/integration/');
    }

    value = value.replace(/cypress\\integration\\/g, 'cypress/integration/');
  }

  let expected = clean(expectedBuffer.toString());
  if (outputPath.endsWith('.txt')) {
    expected = osSpecificEol(expected);
  }

  expect(clean(value), `Check ${outputPath} matched ${specPath}.`).to.eq(clean(expected));
}

export const expectOutputFilesToBeCorrect = (testOutputs, outRoot, specFiles, specExtName) => {
  testOutputs.value.forEach((out) => {
    expectOutFilesMatch(
      path.join(outRoot.value, out),
      path.join(outRoot.value, out.replace(/\.([a-z]+)$/, '.spec.' + specExtName + '.$1'))
    );
  });
}

export const expectConsoleLogForOutput = (stdout, outRoot, fileNames = [''], toNot = false) => {
  fileNames.forEach((fileName) => {
    let ext = path.extname(fileName).substring(1);
    if (!['json', 'txt'].includes(ext)) {
      ext = 'custom';
    }
    let logString = '[cypress-terminal-report] Wrote ' + ext +
      ' logs to ' + path.join(outRoot.value, fileName);

    if (toNot) {
      expect(stdout).to.not.contain(logString);
    } else {
      expect(stdout).to.contain(logString);
    }
  });
}
