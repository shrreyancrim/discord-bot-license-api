import { getUncachableGitHubClient } from '../server/github-setup';
import * as fs from 'fs';
import * as path from 'path';

const REPO_OWNER = 'shrreyancrim';
const REPO_NAME = 'discord-bot-license-api';

// Files to exclude from upload
const EXCLUDE_PATTERNS = [
  /^node_modules\//,
  /^\.replit$/,
  /^replit\.nix$/,
  /^\.upm\//,
  /^\.git\//,
  /^dist\//,
  /^\.env$/,
  /^\.cache\//,
  /\.log$/,
];

function shouldExclude(filePath: string): boolean {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    const relativePath = path.relative(process.cwd(), fullPath);
    
    if (shouldExclude(relativePath)) {
      return;
    }

    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

async function initAndUpload() {
  try {
    console.log('🔗 Connecting to GitHub...');
    const octokit = await getUncachableGitHubClient();
    
    const { data: repo } = await octokit.repos.get({
      owner: REPO_OWNER,
      repo: REPO_NAME,
    });
    
    console.log('📝 Initializing repository with README...');
    
    // Create initial commit with README
    const readmeContent = fs.readFileSync('README.md', 'utf8');
    
    await octokit.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'README.md',
      message: 'Initial commit',
      content: Buffer.from(readmeContent).toString('base64'),
    });
    
    console.log('✅ Repository initialized');
    console.log('⏳ Waiting for GitHub to process...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('📁 Scanning project files...');
    const allFiles = getAllFiles(process.cwd());
    console.log(`Found ${allFiles.length} files to upload`);
    
    // Get the latest commit
    const { data: ref } = await octokit.git.getRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `heads/${repo.default_branch}`,
    });
    
    const { data: commit } = await octokit.git.getCommit({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      commit_sha: ref.object.sha,
    });
    
    console.log('📦 Uploading files...');
    
    // Create blobs for all files
    const tree: Array<{
      path: string;
      mode: '100644';
      type: 'blob';
      sha: string;
    }> = [];
    let uploadedCount = 0;
    
    for (const filePath of allFiles) {
      const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
      const content = fs.readFileSync(filePath);
      
      try {
        const { data: blob } = await octokit.git.createBlob({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          content: content.toString('base64'),
          encoding: 'base64',
        });
        
        tree.push({
          path: relativePath,
          mode: '100644',
          type: 'blob',
          sha: blob.sha,
        });
        
        uploadedCount++;
        if (uploadedCount % 10 === 0) {
          console.log(`  Uploaded ${uploadedCount}/${allFiles.length} files...`);
        }
      } catch (error: any) {
        console.warn(`  ⚠️ Skipped ${relativePath}: ${error.message}`);
      }
    }
    
    console.log(`✅ All ${uploadedCount} files prepared`);
    
    // Create tree
    console.log('🌳 Creating Git tree...');
    const { data: newTree } = await octokit.git.createTree({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      tree: tree,
      base_tree: commit.tree.sha,
    });
    
    // Create commit
    console.log('💾 Creating commit...');
    const commitMessage = `Discord Bot License Verification API

✅ Instant license suspension (5-second monitoring)
✅ Guild-based activation system
✅ MongoDB storage with full CRUD API
✅ Real-time monitoring and analytics
✅ Comprehensive documentation

Features:
- Automatic bot shutdown on license suspension
- Multi-guild license support
- Verification logging and analytics
- Secure API with rate limiting
- Production-ready deployment guides`;

    const { data: newCommit } = await octokit.git.createCommit({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      message: commitMessage,
      tree: newTree.sha,
      parents: [ref.object.sha],
    });
    
    // Update reference
    console.log('🚀 Pushing to GitHub...');
    await octokit.git.updateRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `heads/${repo.default_branch}`,
      sha: newCommit.sha,
    });
    
    console.log('\n✅ SUCCESS! All files pushed to GitHub!');
    console.log(`\n🔗 Repository: https://github.com/${REPO_OWNER}/${REPO_NAME}`);
    console.log(`📝 Commit: ${newCommit.sha.substring(0, 7)}`);
    console.log(`\n📚 Your code is now live on GitHub!`);
    console.log(`\n🚀 Next steps:`);
    console.log(`   1. Clone: git clone https://github.com/${REPO_OWNER}/${REPO_NAME}.git`);
    console.log(`   2. Deploy on your server (see DEPLOYMENT.md)`);
    console.log(`   3. Configure environment variables`);
    console.log(`   4. Start the API!`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.status) {
      console.error(`Status: ${error.status}`);
    }
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

initAndUpload();
