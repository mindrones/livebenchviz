const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const pathsToCheck = [
  'pipeline/out/livebench.csv',
  'pipeline/out/livebench_categories.json',
  'pipeline/out/livebench_release.txt',
  'pipeline/out/livebench_scores.json',
  'pipeline/out/livebench_model_config.json',
  'pipeline/out/openrouter_models.json',
  'pipeline/out/livebench_normalized.json',
  'pipeline/out/ollama.json',
  'pipeline/out/benchmark_lb.json',
  'website/static/livebench.csv',
  'website/static/benchmark_lb.json',
  'website/static/data-hash.json',
  'website/src/lib/pipeline_graph.json'
];

function getFileHash(relativeFilePath) {
  const fullPath = path.join(PROJECT_ROOT, relativeFilePath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(fullPath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch (err) {
    console.error(`Error reading ${relativeFilePath}:`, err.message);
    return null;
  }
}

function notify(title, subtitle, message) {
  const escapedMessage = message.replace(/"/g, '\\"');
  const escapedTitle = title.replace(/"/g, '\\"');
  const escapedSubtitle = subtitle.replace(/"/g, '\\"');
  
  const appleScript = `display notification "${escapedMessage}" with title "${escapedTitle}" subtitle "${escapedSubtitle}" sound name "Glass"`;
  const osascript = spawn('osascript', ['-e', appleScript]);
  
  osascript.on('error', (err) => {
    console.error('Failed to display macOS notification:', err);
  });
}

async function main() {
  console.log('🔍 Calculating initial file hashes...');
  const beforeHashes = {};
  for (const relPath of pathsToCheck) {
    beforeHashes[relPath] = getFileHash(relPath);
  }

  console.log('\n🚀 Running the pipeline: pnpm --filter pipeline run all ...');
  
  const pipelineProcess = spawn('pnpm', ['--filter', 'pipeline', 'run', 'all'], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit'
  });

  pipelineProcess.on('close', (code) => {
    console.log(`\n🏁 Pipeline process exited with code ${code}`);
    
    if (code !== 0) {
      console.error('❌ Pipeline execution failed.');
      notify('Pipeline Failed', 'Execution Error', `Process exited with code ${code}`);
      process.exit(code);
    }

    console.log('\n🔍 Calculating post-run file hashes...');
    const afterHashes = {};
    const changedFiles = [];

    for (const relPath of pathsToCheck) {
      const before = beforeHashes[relPath];
      const after = getFileHash(relPath);
      afterHashes[relPath] = after;

      if (before !== after) {
        changedFiles.push(relPath);
      }
    }

    if (changedFiles.length > 0) {
      console.log('\n✨ The following files changed:');
      for (const file of changedFiles) {
        console.log(`  - ${file}`);
      }
      
      const fileNames = changedFiles.map(f => path.basename(f)).join(', ');
      notify(
        'Pipeline Complete',
        'Data Updated 📈',
        `Changes detected in: ${fileNames}`
      );
    } else {
      console.log('\n✅ Pipeline completed. No changes detected.');
      notify(
        'Pipeline Complete',
        'No Changes ➔',
        'No changes were detected in the output files.'
      );
    }
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
