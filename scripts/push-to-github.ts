import { getUncachableGitHubClient } from '../server/github-setup';
import { execSync } from 'child_process';
import * as fs from 'fs';

async function pushToGitHub() {
  try {
    console.log('🔗 Connecting to GitHub...');
    const octokit = await getUncachableGitHubClient();
    
    // Get authenticated user
    const { data: user } = await octokit.users.getAuthenticated();
    console.log(`✅ Connected as: ${user.login}`);
    
    const repoName = 'discord-bot-license-api';
    const description = 'Discord Bot License Verification API - Secure license management system with real-time monitoring and guild-based activation';
    
    console.log(`\n📦 Creating repository: ${repoName}...`);
    
    let repo;
    try {
      // Try to create new repository
      const { data } = await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        description: description,
        private: false,
        auto_init: false,
      });
      repo = data;
      console.log(`✅ Repository created: ${repo.html_url}`);
    } catch (error: any) {
      if (error.status === 422) {
        // Repository already exists
        console.log('ℹ️  Repository already exists, using existing one...');
        const { data } = await octokit.repos.get({
          owner: user.login,
          repo: repoName,
        });
        repo = data;
        console.log(`✅ Using existing repository: ${repo.html_url}`);
      } else {
        throw error;
      }
    }
    
    // Initialize git if not already initialized
    if (!fs.existsSync('.git')) {
      console.log('\n🔧 Initializing git repository...');
      execSync('git init', { stdio: 'inherit' });
      execSync('git branch -M main', { stdio: 'inherit' });
    }
    
    // Create .gitignore if it doesn't exist
    const gitignoreContent = `node_modules/
.env
.env.local
dist/
.replit
.upm
replit.nix
*.log
.DS_Store
`;
    
    if (!fs.existsSync('.gitignore')) {
      console.log('📝 Creating .gitignore...');
      fs.writeFileSync('.gitignore', gitignoreContent);
    }
    
    // Add remote
    const remoteUrl = `https://github.com/${user.login}/${repoName}.git`;
    console.log(`\n🔗 Adding remote: ${remoteUrl}`);
    
    try {
      execSync('git remote remove origin', { stdio: 'ignore' });
    } catch (e) {
      // Remote doesn't exist, that's fine
    }
    
    execSync(`git remote add origin ${remoteUrl}`, { stdio: 'inherit' });
    
    // Stage all files
    console.log('\n📋 Staging files...');
    execSync('git add .', { stdio: 'inherit' });
    
    // Commit
    console.log('💾 Creating commit...');
    try {
      execSync('git commit -m "Initial commit: Discord Bot License Verification API with instant suspension support"', { stdio: 'inherit' });
    } catch (e) {
      console.log('ℹ️  No changes to commit or commit already exists');
    }
    
    // Push to GitHub
    console.log('🚀 Pushing to GitHub...');
    execSync('git push -u origin main --force', { stdio: 'inherit' });
    
    console.log('\n✅ SUCCESS! Your code is now on GitHub!');
    console.log(`\n🔗 Repository URL: ${repo.html_url}`);
    console.log(`\n📚 Next steps:`);
    console.log(`   1. Clone the repository on your server: git clone ${repo.clone_url}`);
    console.log(`   2. Install dependencies: npm install`);
    console.log(`   3. Set up environment variables (see README.md)`);
    console.log(`   4. Start the API: npm run dev`);
    console.log(`\n💡 Your bot clients can now use this API for license verification!`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

pushToGitHub();
