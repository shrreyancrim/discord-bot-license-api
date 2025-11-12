import { getUncachableGitHubClient } from '../server/github-setup';

async function createGitHubRepo() {
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
        auto_init: true,
        gitignore_template: 'Node',
      });
      repo = data;
      console.log(`✅ Repository created: ${repo.html_url}`);
    } catch (error: any) {
      if (error.status === 422) {
        // Repository already exists
        console.log('ℹ️  Repository already exists');
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
    
    console.log('\n✅ SUCCESS! Repository is ready on GitHub!');
    console.log(`\n🔗 Repository URL: ${repo.html_url}`);
    console.log(`🔗 Clone URL: ${repo.clone_url}`);
    console.log(`\n📚 To deploy this API on your own server:`);
    console.log(`\n   1. Download the code from this Replit (use the download button or export)`);
    console.log(`   2. Push to GitHub manually:`);
    console.log(`      git init`);
    console.log(`      git add .`);
    console.log(`      git commit -m "Initial commit"`);
    console.log(`      git branch -M main`);
    console.log(`      git remote add origin ${repo.clone_url}`);
    console.log(`      git push -u origin main`);
    console.log(`\n   3. Deploy on any hosting service (VPS, AWS, DigitalOcean, Heroku, etc.):`);
    console.log(`      - Clone: git clone ${repo.clone_url}`);
    console.log(`      - Install: npm install`);
    console.log(`      - Configure environment variables (see .env.example)`);
    console.log(`      - Start: npm run dev (or npm start for production)`);
    console.log(`\n   4. Update your Discord bots to use the new API URL`);
    console.log(`\n💡 The API will be accessible at your server's domain/IP address!`);
    
    return repo;
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

createGitHubRepo();
